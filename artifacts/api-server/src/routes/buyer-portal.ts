/**
 * Buyer Portal Routes
 *
 * Seller-side (requires seller JWT via verifyToken middleware):
 *   GET    /api/buyer-portal/groups?cafeId=X          list groups for a cafe
 *   POST   /api/buyer-portal/groups                   create group
 *   PUT    /api/buyer-portal/groups/:id               rename / update description
 *   DELETE /api/buyer-portal/groups/:id               delete group + members + perms
 *   POST   /api/buyer-portal/groups/:id/members       add a buyer (phone + name)
 *   DELETE /api/buyer-portal/groups/:id/members/:mid  remove a buyer
 *   PUT    /api/buyer-portal/groups/:id/permissions   set content permissions
 *   GET    /api/buyer-portal/groups/:id/preview       what a buyer in this group sees
 *
 * Buyer-side (OTP-verified phone — issues a buyer JWT then uses it):
 *   POST   /api/buyer-portal/auth/verify              OTP check → issue buyer JWT
 *   GET    /api/buyer-portal/my-access                buyer JWT → accessible listings + tokens
 */

import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import twilio from "twilio";
import {
  db,
  kvStore,
  cafesTable,
  buyersTable,
  buyerPortalGroupsTable,
  buyerPortalGroupMembersTable,
  buyerPortalGroupPermissionsTable,
  ndaSettingsTable,
  ndaSignaturesTable,
} from "@workspace/db";
import { requireAuth, verifyToken } from "../middlewares/auth";
import { sendEmail, emailShell, isValidEmail, PUBLIC_WEB_URL } from "../lib/email";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(s);
}

/** Issue a buyer portal JWT — embeds phone so my-access can use it. */
async function signBuyerToken(phone: string): Promise<string> {
  return new SignJWT({ phone, role: "buyer_portal" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

/** Normalise a phone to E.164-ish "+<digits>" so both flows key identically. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

/**
 * Upsert the canonical buyer record, keyed by phone. Sets the name only when a
 * non-empty one is supplied (so a portal login never wipes a name captured at
 * enquiry). Non-fatal by design — callers wrap this so auth never fails on it.
 */
async function upsertBuyer(phone: string, name?: string): Promise<{ phone: string; name: string | null } | null> {
  const trimmed = name?.trim();
  const [row] = await db.insert(buyersTable)
    .values({ phone, name: trimmed || null })
    .onConflictDoUpdate({
      target: buyersTable.phone,
      set: { ...(trimmed ? { name: trimmed } : {}), updatedAt: new Date() },
    })
    .returning();
  return row ? { phone: row.phone, name: row.name } : null;
}

/** Verify a buyer portal JWT — returns phone or null. */
async function verifyBuyerToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const p = payload as { phone?: string; role?: string };
    if (p.role !== "buyer_portal" || !p.phone) return null;
    return p.phone;
  } catch {
    return null;
  }
}

/** Issue a report-access token for a specific listing (unlocks approved_buyer sections). */
async function signReportAccessToken(listingId: string, phone: string): Promise<string> {
  return new SignJWT({ listingId, phone, type: "buyer-report-access" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getJwtSecret());
}

// ─── NDA (per-listing, tick-to-accept) ────────────────────────────────────────
// Buyers must accept a per-listing NDA before the confidential report unlocks.
// Backed by the existing nda_settings (mode) + nda_signatures (audit) tables.
// Policy: NDA is REQUIRED by default; a seller can disable it per listing by
// setting nda_settings.ndaMode = 'none'.

/**
 * Resolve the buyer's phone from whichever token the report page holds — the
 * per-listing report-access token (preferred) or a buyer_portal token. Returns
 * null if the token is invalid or (for a report-access token) is for a different
 * listing, so a token for listing A can never sign the NDA for listing B.
 */
async function resolveNdaPhone(token: string | undefined, listingId: string): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const p = payload as { phone?: string; type?: string; role?: string; listingId?: string };
    if (p.type === "buyer-report-access" && p.phone) {
      if (p.listingId && p.listingId !== listingId) return null;
      return p.phone;
    }
    if (p.role === "buyer_portal" && p.phone) return p.phone;
    return null;
  } catch {
    return null;
  }
}

/** Is an NDA required for this listing? Default true unless seller set 'none'. */
async function ndaRequiredForListing(listingId: string): Promise<boolean> {
  try {
    const [settings] = await db.select().from(ndaSettingsTable)
      .where(eq(ndaSettingsTable.listingId, listingId));
    if (!settings) return true;            // no explicit setting → required by default
    return settings.ndaMode !== "none";
  } catch {
    return true;
  }
}

/** Has this buyer (phone) already signed the NDA for this listing? */
async function ndaSigned(listingId: string, phone: string): Promise<boolean> {
  try {
    const [row] = await db.select().from(ndaSignaturesTable)
      .where(and(eq(ndaSignaturesTable.listingId, listingId), eq(ndaSignaturesTable.buyerPhone, phone)))
      .limit(1);
    return !!row;
  } catch {
    return false;
  }
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) throw new Error("Twilio credentials not configured");
  return twilio(sid, auth);
}
// Test sign-in numbers that skip real SMS OTP (any code accepted). Matched on the
// trailing 9 digits so any format works (0414 631 463, +61414631463, …).
const TEST_OTP_NUMBERS = ["414631463", "412708337"];
function isTestOtpPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return TEST_OTP_NUMBERS.some((n) => digits.endsWith(n));
}
function getVerifyServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SERVICE_SID not configured");
  return sid;
}

/** Confirm the requesting seller owns this cafe. */
async function requireOwner(cafeId: string, ownerId: string) {
  const [cafe] = await db.select().from(cafesTable).where(
    and(eq(cafesTable.id, cafeId), eq(cafesTable.ownerId, ownerId))
  );
  return cafe ?? null;
}

/** Confirm the seller owns the group (via its cafeId). */
async function requireGroupOwner(groupId: string, ownerId: string) {
  const [group] = await db.select().from(buyerPortalGroupsTable).where(
    and(eq(buyerPortalGroupsTable.id, groupId), eq(buyerPortalGroupsTable.ownerId, ownerId))
  );
  return group ?? null;
}

// ─── Buyer OTP auth ───────────────────────────────────────────────────────────

/**
 * POST /api/buyer-portal/auth/verify
 * Body: { phone, code }
 * Returns: { token } — a buyer JWT stored client-side as exit360_buyer_token
 */
router.post("/buyer-portal/auth/verify", async (req, res): Promise<void> => {
  const { phone, code, name } = req.body as { phone?: string; code?: string; name?: string };
  if (!phone || !code) {
    res.status(400).json({ error: "phone and code are required" });
    return;
  }
  try {
    if (!isTestOtpPhone(phone)) {
      const client = getTwilioClient();
      const check = await client.verify.v2
        .services(getVerifyServiceSid())
        .verificationChecks.create({ to: phone, code });
      if (check.status !== "approved") {
        res.status(400).json({ error: "Incorrect or expired code" });
        return;
      }
    }
    const canonical = normalisePhone(phone);
    let buyerName: string | null = null;
    try { buyerName = (await upsertBuyer(canonical, name))?.name ?? null; } catch { /* non-fatal */ }
    const token = await signBuyerToken(canonical);
    res.json({ ok: true, token, phone: canonical, name: buyerName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: msg });
  }
});

/**
 * POST /api/buyer-portal/email/set
 * Authorization: Bearer <buyer portal token>
 * Body: { email }
 * Stores the buyer's email (unverified) and sends a verification link. Changing
 * an existing email re-triggers verification (emailVerified reset to false).
 */
router.post("/buyer-portal/email/set", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const phone = bearer ? await verifyBuyerToken(bearer) : null;
  if (!phone) { res.status(401).json({ error: "Sign in required" }); return; }
  const { email } = req.body as { email?: string };
  if (!isValidEmail(email)) { res.status(400).json({ error: "A valid email is required" }); return; }
  const clean = email!.trim().toLowerCase();
  try {
    const [existing] = await db.select().from(buyersTable).where(eq(buyersTable.phone, phone));
    // Already verified with the same address? Nothing to do.
    if (existing?.email === clean && existing?.emailVerified) {
      res.json({ ok: true, email: clean, verified: true });
      return;
    }
    const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`);
    await db.update(buyersTable)
      .set({ email: clean, emailVerified: false, emailVerifyToken: token, updatedAt: new Date() })
      .where(eq(buyersTable.phone, phone));
    const link = `${PUBLIC_WEB_URL}/api/buyer-portal/email/verify?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: clean,
      subject: "Verify your email for EXIT360 message alerts",
      html: emailShell(
        "Confirm your email",
        "<p>Confirm this address to get an email whenever a seller replies to your enquiry on EXIT360.</p><p>This link expires when you next change your email.</p>",
        { label: "Verify my email", url: link },
      ),
    });
    res.json({ ok: true, email: clean, verified: false, pending: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not save email";
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/buyer-portal/email/verify?token=...
 * Public link target from the verification email. Marks the email verified and
 * redirects back to the portal with a friendly flag.
 */
router.get("/buyer-portal/email/verify", async (req, res): Promise<void> => {
  const token = String(req.query.token ?? "");
  if (!token) { res.redirect(`${PUBLIC_WEB_URL}/buyers/portal?verify=missing`); return; }
  try {
    const [row] = await db.select().from(buyersTable).where(eq(buyersTable.emailVerifyToken, token));
    if (!row) { res.redirect(`${PUBLIC_WEB_URL}/buyers/portal?verify=invalid`); return; }
    await db.update(buyersTable)
      .set({ emailVerified: true, emailVerifyToken: null, updatedAt: new Date() })
      .where(eq(buyersTable.id, row.id));
    res.redirect(`${PUBLIC_WEB_URL}/buyers/portal?verify=success`);
  } catch {
    res.redirect(`${PUBLIC_WEB_URL}/buyers/portal?verify=error`);
  }
});

/**
 * POST /api/buyer-portal/link
 * Authorization: Bearer <biz360 auth JWT from /biz360/auth/verify-otp>
 * Body: { name? }
 * Links an already phone-verified enquiry user to the unified buyer identity:
 * upserts the canonical buyer (name + phone) and issues a buyer portal token,
 * so an enquiring buyer becomes a portal buyer without a second SMS step.
 */
router.post("/buyer-portal/link", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!bearer) { res.status(401).json({ error: "Auth token required" }); return; }
  const userId = await verifyToken(bearer).catch(() => null);
  if (!userId) { res.status(401).json({ error: "Invalid or expired token" }); return; }
  const phone = normalisePhone(userId.replace(/^u-/, ""));
  if (!phone) { res.status(400).json({ error: "Token has no phone identity" }); return; }
  const { name } = req.body as { name?: string };
  let buyerName: string | null = null;
  try { buyerName = (await upsertBuyer(phone, name))?.name ?? null; } catch { /* non-fatal */ }
  const token = await signBuyerToken(phone);
  res.json({ ok: true, token, phone, name: buyerName });
});

/**
 * GET /api/buyer-portal/me
 * Authorization: Bearer <buyer JWT>
 * Returns the canonical buyer identity (phone + name).
 */
router.get("/buyer-portal/me", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!bearer) { res.status(401).json({ error: "Buyer token required" }); return; }
  const phone = await verifyBuyerToken(bearer);
  if (!phone) { res.status(401).json({ error: "Invalid or expired buyer token" }); return; }
  const [buyer] = await db.select().from(buyersTable).where(eq(buyersTable.phone, phone));
  res.json({
    phone,
    name: buyer?.name ?? null,
    email: buyer?.email ?? null,
    emailVerified: !!buyer?.emailVerified,
  });
});

// ─── Buyer portal: my listings ────────────────────────────────────────────────

/**
 * GET /api/buyer-portal/my-access
 * Authorization: Bearer <buyer JWT>
 * Returns all listings/cafes the buyer has been granted access to, with
 * per-listing permissions and a short-lived report accessToken.
 */
router.get("/buyer-portal/my-access", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!bearer) {
    res.status(401).json({ error: "Buyer token required" });
    return;
  }
  const phone = await verifyBuyerToken(bearer);
  if (!phone) {
    res.status(401).json({ error: "Invalid or expired buyer token" });
    return;
  }

  const [me] = await db.select().from(buyersTable).where(eq(buyersTable.phone, phone));
  const emailInfo = { email: me?.email ?? null, emailVerified: !!me?.emailVerified, name: me?.name ?? null };

  // Find all group memberships for this phone number
  const memberships = await db.select().from(buyerPortalGroupMembersTable)
    .where(eq(buyerPortalGroupMembersTable.phone, phone));

  if (!memberships.length) {
    res.json({ listings: [], phone, ...emailInfo });
    return;
  }

  const groupIds = memberships.map((m) => m.groupId);

  // Load groups + permissions
  const groups = await db.select().from(buyerPortalGroupsTable)
    .where(inArray(buyerPortalGroupsTable.id, groupIds));
  const permissions = await db.select().from(buyerPortalGroupPermissionsTable)
    .where(inArray(buyerPortalGroupPermissionsTable.groupId, groupIds));

  // Load cafe details for all referenced cafes
  const cafeIds = [...new Set(permissions.map((p) => p.cafeId))];
  const cafes = cafeIds.length
    ? await db.select().from(cafesTable).where(inArray(cafesTable.id, cafeIds))
    : [];

  // Build merged permissions per cafeId (OR across groups — most permissive wins)
  const mergedPerms: Record<string, {
    canViewImReport: boolean;
    canViewWalkthrough: boolean;
    canViewFinancials: boolean;
    canViewEquipment: boolean;
  }> = {};

  for (const p of permissions) {
    if (!groupIds.includes(p.groupId)) continue;
    if (!mergedPerms[p.cafeId]) {
      mergedPerms[p.cafeId] = {
        canViewImReport: false,
        canViewWalkthrough: false,
        canViewFinancials: false,
        canViewEquipment: false,
      };
    }
    if (p.canViewImReport)    mergedPerms[p.cafeId].canViewImReport    = true;
    if (p.canViewWalkthrough) mergedPerms[p.cafeId].canViewWalkthrough = true;
    if (p.canViewFinancials)  mergedPerms[p.cafeId].canViewFinancials  = true;
    if (p.canViewEquipment)   mergedPerms[p.cafeId].canViewEquipment   = true;
  }

  // Resolve the public listing name (e.g. "Bean Culture Coffee Roastery") from the
  // admin listings KV — the cafe row often carries a placeholder name like "My Business".
  const listingNameById: Record<string, string> = {};
  const listingHeroById: Record<string, string> = {};
  try {
    const kvRows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const allListings = Array.isArray(kvRows[0]?.value) ? (kvRows[0]!.value as any[]) : [];
    for (const l of allListings) {
      if (!l?.listingId) continue;
      if (l?.businessName) listingNameById[l.listingId] = l.businessName;
      const hero = l?.heroImageUrl ?? (Array.isArray(l?.photos) ? l.photos[0] : null);
      if (hero) listingHeroById[l.listingId] = hero;
    }
  } catch { /* fall back to cafe name */ }

  // Build response — one entry per cafe
  const listings = await Promise.all(
    Object.entries(mergedPerms).map(async ([cafeId, perms]) => {
      const cafe = cafes.find((c) => c.id === cafeId);
      if (!cafe) return null;
      // Only issue an accessToken if they have IM report access
      const accessToken = perms.canViewImReport && cafe.listingId
        ? await signReportAccessToken(cafe.listingId, phone)
        : null;
      const displayName =
        (cafe.listingId ? listingNameById[cafe.listingId] : null) ?? cafe.businessName ?? cafe.name;
      return {
        cafeId,
        listingId: cafe.listingId ?? null,
        businessName: displayName,
        city: cafe.city ?? null,
        businessType: cafe.businessType ?? "business",
        heroImageUrl: cafe.listingId ? (listingHeroById[cafe.listingId] ?? null) : null,
        permissions: perms,
        accessToken,
      };
    })
  );

  res.json({ listings: listings.filter(Boolean), phone, ...emailInfo });
});

// ─── Buyer NDA gate ───────────────────────────────────────────────────────────

/**
 * POST /api/buyer-portal/nda/status
 * Body: { listingId, accessToken }
 * Returns whether an NDA is required for this listing and whether THIS buyer has
 * already signed it. Called by the report page before revealing confidential
 * content. Identity comes from the token (never trust a client-supplied phone).
 */
router.post("/buyer-portal/nda/status", async (req, res): Promise<void> => {
  const { listingId, accessToken } = req.body as { listingId?: string; accessToken?: string };
  if (!listingId) { res.status(400).json({ error: "listingId required" }); return; }
  const phone = await resolveNdaPhone(accessToken, listingId);
  const required = await ndaRequiredForListing(listingId);
  // Without a resolvable identity we can't record a signature, so treat as
  // "not required" rather than trapping the viewer behind an unusable gate.
  if (!phone) { res.json({ required: false, accepted: false }); return; }
  const accepted = required ? await ndaSigned(listingId, phone) : true;
  res.json({ required, accepted });
});

/**
 * POST /api/buyer-portal/nda/accept
 * Body: { listingId, accessToken, fullName }
 * Records the buyer's tick-to-accept NDA signature for this listing.
 */
router.post("/buyer-portal/nda/accept", async (req, res): Promise<void> => {
  const { listingId, accessToken, fullName } = req.body as {
    listingId?: string; accessToken?: string; fullName?: string;
  };
  if (!listingId) { res.status(400).json({ error: "listingId required" }); return; }
  const name = (fullName ?? "").trim();
  if (name.length < 2) { res.status(400).json({ error: "Please enter your full name" }); return; }
  const phone = await resolveNdaPhone(accessToken, listingId);
  if (!phone) { res.status(401).json({ error: "Could not verify your access" }); return; }
  try {
    // Idempotent: if they've already signed, don't stack duplicate rows.
    if (!(await ndaSigned(listingId, phone))) {
      const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
        || req.socket?.remoteAddress || null;
      const ua = (req.headers["user-agent"] as string | undefined) ?? null;
      await db.insert(ndaSignaturesTable).values({
        listingId,
        buyerName: name,
        buyerPhone: phone,
        buyerIp: ip,
        userAgent: ua,
        otpVerified: true,
      });
    }
    res.json({ accepted: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not record your NDA";
    res.status(500).json({ error: msg });
  }
});

// ─── Seller: group CRUD ───────────────────────────────────────────────────────

/**
 * GET /api/buyer-portal/groups?cafeId=X
 * Returns all groups for a cafe with member list and permissions.
 */
router.get("/buyer-portal/groups", requireAuth, async (req, res): Promise<void> => {
  const { cafeId } = req.query as { cafeId?: string };
  if (!cafeId) { res.status(400).json({ error: "cafeId required" }); return; }
  const ownerId = req.user!.id;
  const cafe = await requireOwner(cafeId, ownerId);
  if (!cafe) { res.status(403).json({ error: "Forbidden" }); return; }

  const groups = await db.select().from(buyerPortalGroupsTable)
    .where(and(eq(buyerPortalGroupsTable.cafeId, cafeId), eq(buyerPortalGroupsTable.ownerId, ownerId)));

  if (!groups.length) { res.json({ groups: [] }); return; }

  const groupIds = groups.map((g) => g.id);
  const members = await db.select().from(buyerPortalGroupMembersTable)
    .where(inArray(buyerPortalGroupMembersTable.groupId, groupIds));
  const perms = await db.select().from(buyerPortalGroupPermissionsTable)
    .where(inArray(buyerPortalGroupPermissionsTable.groupId, groupIds));

  const result = groups.map((g) => ({
    ...g,
    members: members.filter((m) => m.groupId === g.id),
    permissions: perms.find((p) => p.groupId === g.id && p.cafeId === cafeId) ?? null,
  }));

  res.json({ groups: result });
});

/**
 * POST /api/buyer-portal/groups
 * Body: { cafeId, name, description? }
 */
router.post("/buyer-portal/groups", requireAuth, async (req, res): Promise<void> => {
  const { cafeId, name, description } = req.body as {
    cafeId?: string; name?: string; description?: string;
  };
  if (!cafeId || !name?.trim()) {
    res.status(400).json({ error: "cafeId and name are required" });
    return;
  }
  const ownerId = req.user!.id;
  const cafe = await requireOwner(cafeId, ownerId);
  if (!cafe) { res.status(403).json({ error: "Forbidden" }); return; }

  const [group] = await db.insert(buyerPortalGroupsTable).values({
    cafeId, ownerId, name: name.trim(), description: description ?? null,
  }).returning();

  // Auto-create a blank permissions row for this cafe
  await db.insert(buyerPortalGroupPermissionsTable).values({
    groupId: group.id, cafeId,
    canViewImReport: false, canViewWalkthrough: false,
    canViewFinancials: false, canViewEquipment: false,
  });

  res.status(201).json({ group: { ...group, members: [], permissions: null } });
});

/**
 * PUT /api/buyer-portal/groups/:id
 * Body: { name?, description? }
 */
router.put("/buyer-portal/groups/:id", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const ownerId = req.user!.id;
  const group = await requireGroupOwner(id, ownerId);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const { name, description } = req.body as { name?: string; description?: string };
  const [updated] = await db.update(buyerPortalGroupsTable)
    .set({
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      updatedAt: new Date(),
    })
    .where(eq(buyerPortalGroupsTable.id, id)).returning();
  res.json({ group: updated });
});

/**
 * DELETE /api/buyer-portal/groups/:id
 */
router.delete("/buyer-portal/groups/:id", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const ownerId = req.user!.id;
  const group = await requireGroupOwner(id, ownerId);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  await db.delete(buyerPortalGroupsTable).where(eq(buyerPortalGroupsTable.id, id));
  res.json({ ok: true });
});

// ─── Seller: group members ────────────────────────────────────────────────────

/**
 * POST /api/buyer-portal/groups/:id/members
 * Body: { phone, name? }
 */
router.post("/buyer-portal/groups/:id/members", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const ownerId = req.user!.id;
  const group = await requireGroupOwner(id, ownerId);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const { phone, name } = req.body as { phone?: string; name?: string };
  if (!phone?.trim()) { res.status(400).json({ error: "phone is required" }); return; }

  // Normalise: strip spaces
  const normalised = phone.trim().replace(/\s/g, "");

  // Check for duplicates within this group
  const [existing] = await db.select().from(buyerPortalGroupMembersTable)
    .where(and(
      eq(buyerPortalGroupMembersTable.groupId, id),
      eq(buyerPortalGroupMembersTable.phone, normalised)
    ));
  if (existing) { res.status(409).json({ error: "This number is already in the group" }); return; }

  const [member] = await db.insert(buyerPortalGroupMembersTable).values({
    groupId: id, phone: normalised, name: name?.trim() ?? null,
  }).returning();

  res.status(201).json({ member });
});

/**
 * PATCH /api/buyer-portal/groups/:id/members/:mid — update member name
 */
router.patch("/buyer-portal/groups/:id/members/:mid", requireAuth, async (req, res): Promise<void> => {
  const { id, mid } = req.params as { id: string; mid: string };
  const ownerId = req.user!.id;
  const group = await requireGroupOwner(id, ownerId);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const { name } = req.body as { name?: string };
  const [updated] = await db.update(buyerPortalGroupMembersTable)
    .set({ name: name?.trim() ?? null })
    .where(and(
      eq(buyerPortalGroupMembersTable.id, mid),
      eq(buyerPortalGroupMembersTable.groupId, id)
    )).returning();

  res.json({ member: updated });
});

/**
 * DELETE /api/buyer-portal/groups/:id/members/:mid
 */
router.delete("/buyer-portal/groups/:id/members/:mid", requireAuth, async (req, res): Promise<void> => {
  const { id, mid } = req.params as { id: string; mid: string };
  const ownerId = req.user!.id;
  const group = await requireGroupOwner(id, ownerId);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  await db.delete(buyerPortalGroupMembersTable)
    .where(and(
      eq(buyerPortalGroupMembersTable.id, mid),
      eq(buyerPortalGroupMembersTable.groupId, id)
    ));
  res.json({ ok: true });
});

// ─── Seller: permissions ──────────────────────────────────────────────────────

/**
 * PUT /api/buyer-portal/groups/:id/permissions
 * Body: { cafeId, canViewImReport, canViewWalkthrough, canViewFinancials, canViewEquipment }
 */
router.put("/buyer-portal/groups/:id/permissions", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const ownerId = req.user!.id;
  const group = await requireGroupOwner(id, ownerId);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const {
    cafeId, canViewImReport, canViewWalkthrough, canViewFinancials, canViewEquipment,
  } = req.body as {
    cafeId?: string;
    canViewImReport?: boolean;
    canViewWalkthrough?: boolean;
    canViewFinancials?: boolean;
    canViewEquipment?: boolean;
  };

  const targetCafe = cafeId ?? group.cafeId;

  const [perm] = await db
    .insert(buyerPortalGroupPermissionsTable)
    .values({
      groupId: id, cafeId: targetCafe,
      canViewImReport:    canViewImReport    ?? false,
      canViewWalkthrough: canViewWalkthrough ?? false,
      canViewFinancials:  canViewFinancials  ?? false,
      canViewEquipment:   canViewEquipment   ?? false,
    })
    .onConflictDoUpdate({
      target: [buyerPortalGroupPermissionsTable.groupId, buyerPortalGroupPermissionsTable.cafeId],
      set: {
        canViewImReport:    canViewImReport    ?? false,
        canViewWalkthrough: canViewWalkthrough ?? false,
        canViewFinancials:  canViewFinancials  ?? false,
        canViewEquipment:   canViewEquipment   ?? false,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json({ permissions: perm });
});

// ─── Seller: add buyer by phone directly (quick-grant from messages) ──────────
/**
 * POST /api/buyer-portal/quick-grant
 * Body: { cafeId, phone, name?, groupName? }
 * Creates a group named groupName (or "Direct Access") if none exists for this
 * cafe, adds the buyer, and enables all permissions. Idempotent — safe to call
 * multiple times for the same phone on the same cafe.
 */
router.post("/buyer-portal/quick-grant", requireAuth, async (req, res): Promise<void> => {
  const { cafeId, phone, name, groupName } = req.body as {
    cafeId?: string; phone?: string; name?: string; groupName?: string;
  };
  if (!cafeId || !phone?.trim()) {
    res.status(400).json({ error: "cafeId and phone are required" });
    return;
  }
  const ownerId = req.user!.id;
  const cafe = await requireOwner(cafeId, ownerId);
  if (!cafe) { res.status(403).json({ error: "Forbidden" }); return; }

  const normalised = phone.trim().replace(/\s/g, "");
  const resolvedGroupName = groupName?.trim() || "Direct Access";

  // Find or create a group with this name for this cafe
  let [group] = await db.select().from(buyerPortalGroupsTable).where(
    and(
      eq(buyerPortalGroupsTable.cafeId, cafeId),
      eq(buyerPortalGroupsTable.ownerId, ownerId),
      eq(buyerPortalGroupsTable.name, resolvedGroupName),
    )
  );

  if (!group) {
    [group] = await db.insert(buyerPortalGroupsTable).values({
      cafeId, ownerId, name: resolvedGroupName, description: null,
    }).returning();
    // Create permissions row — enable everything by default for quick-grant
    await db.insert(buyerPortalGroupPermissionsTable).values({
      groupId: group.id, cafeId,
      canViewImReport: true, canViewWalkthrough: true,
      canViewFinancials: true, canViewEquipment: true,
    });
  }

  // Add member (idempotent)
  const [existing] = await db.select().from(buyerPortalGroupMembersTable).where(
    and(
      eq(buyerPortalGroupMembersTable.groupId, group.id),
      eq(buyerPortalGroupMembersTable.phone, normalised),
    )
  );
  let member = existing;
  if (!member) {
    [member] = await db.insert(buyerPortalGroupMembersTable).values({
      groupId: group.id, phone: normalised, name: name?.trim() ?? null,
    }).returning();
  }

  res.status(201).json({ ok: true, groupId: group.id, groupName: group.name, member });
});

/**
 * GET /api/buyer-portal/groups/:id/preview
 * Seller sees what the buyer dashboard will look like for this group.
 */
router.get("/buyer-portal/groups/:id/preview", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const ownerId = req.user!.id;
  const group = await requireGroupOwner(id, ownerId);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const cafe = await requireOwner(group.cafeId, ownerId);
  if (!cafe) { res.status(403).json({ error: "Forbidden" }); return; }

  const members = await db.select().from(buyerPortalGroupMembersTable)
    .where(eq(buyerPortalGroupMembersTable.groupId, id));
  const [perms] = await db.select().from(buyerPortalGroupPermissionsTable)
    .where(and(
      eq(buyerPortalGroupPermissionsTable.groupId, id),
      eq(buyerPortalGroupPermissionsTable.cafeId, group.cafeId),
    ));

  res.json({
    group,
    cafe: {
      id: cafe.id,
      name: cafe.name,
      businessName: cafe.businessName,
      city: cafe.city,
      listingId: cafe.listingId,
    },
    members,
    permissions: perms ?? null,
    portalUrl: `/buyers?preview=1`,
  });
});

export default router;
