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
import { eq, and, inArray, desc } from "drizzle-orm";
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

// ── NDA template / body / manual-grant (KV-backed, no migration needed) ────────
const NDA_TPL_KEY    = "biz360_nda_tpl_v1";     // { [ownerBase]: templateText }
const NDA_BODY_KEY   = "biz360_nda_body_v1";    // { [listingId]: bodyText }  (per-listing override)
const NDA_MANUAL_KEY = "biz360_nda_manual_v1";  // { [listingId]: true }      (seller-grant-only)

export const DEFAULT_NDA_TEXT =
  "By signing, you agree that all financials, documents and business details in this report are strictly confidential. " +
  "You will not disclose, copy or distribute any of this information to any third party without the seller's written consent; " +
  "you will use it solely to evaluate this opportunity; you will not use it to compete with or solicit the business; and you " +
  "will return or destroy all materials on request. This agreement is legally binding. Your name, verified mobile number and " +
  "the date and time of acceptance are recorded.";

/**
 * Normalise an owner id / phone to the canonical AU mobile (national 9 digits).
 * Owner ids come in several shapes for the SAME seller: the login token is
 * `u-61414631463` while an app-created listing is `u-61414631463-1779893721125`
 * (phone + timestamp), and phones appear as 0414631463 / +61414631463 / etc.
 * Collapsing to the leading 9-digit mobile makes ownership match across all of
 * them (previously the timestamp digits made the two sides never compare equal).
 */
function ndaOwnerBase(id?: string | null): string {
  let d = String(id ?? "").replace(/^u-/, "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("61")) d = d.slice(2);
  return d.slice(0, 9);
}

async function kvMap(key: string): Promise<Record<string, any>> {
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, key));
    const v = rows[0]?.value;
    return (v && typeof v === "object" && !Array.isArray(v)) ? (v as Record<string, any>) : {};
  } catch { return {}; }
}
async function kvSaveMap(key: string, map: Record<string, any>): Promise<void> {
  await db.insert(kvStore).values({ key, value: map }).onConflictDoUpdate({ target: kvStore.key, set: { value: map } });
}

/** The listing's owner id (submittedBy) from the admin listings KV. */
async function listingOwner(listingId: string): Promise<string | null> {
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings = Array.isArray(rows[0]?.value) ? (rows[0]!.value as any[]) : [];
    return listings.find((l) => l?.listingId === listingId)?.submittedBy ?? null;
  } catch { return null; }
}

/** Resolve the NDA body for a listing: per-listing override → owner default → platform default. */
async function resolveNdaBody(listingId: string): Promise<string> {
  const perListing = await kvMap(NDA_BODY_KEY);
  if (typeof perListing[listingId] === "string" && perListing[listingId].trim()) return perListing[listingId];
  const owner = await listingOwner(listingId);
  if (owner) {
    const tpl = await kvMap(NDA_TPL_KEY);
    const t = tpl[ndaOwnerBase(owner)];
    if (typeof t === "string" && t.trim()) return t;
  }
  return DEFAULT_NDA_TEXT;
}

async function ndaManualOnly(listingId: string): Promise<boolean> {
  const m = await kvMap(NDA_MANUAL_KEY);
  return m[listingId] === true;
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) throw new Error("Twilio credentials not configured");
  return twilio(sid, auth);
}
// Test sign-in numbers that skip real SMS OTP (any code accepted). Matched on the
// trailing 9 digits so any format works (0414 631 463, +61414631463, …).
const TEST_OTP_NUMBERS = ["414631463"];
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
  const [cafe] = await db.select().from(cafesTable).where(eq(cafesTable.id, cafeId));
  if (!cafe) return null;
  // Canonical-phone match so app-created (u-<phone>) and web (u-<phone>) — and
  // any phone-format variant — resolve to the same owner.
  return ndaOwnerBase(cafe.ownerId) === ndaOwnerBase(ownerId) ? cafe : null;
}

/** Confirm the seller owns the group (via its cafeId). */
async function requireGroupOwner(groupId: string, ownerId: string) {
  const [group] = await db.select().from(buyerPortalGroupsTable).where(eq(buyerPortalGroupsTable.id, groupId));
  if (!group) return null;
  return ndaOwnerBase(group.ownerId) === ndaOwnerBase(ownerId) ? group : null;
}

/** Resolve a listing's valuation cafe for the calling owner (canonical match). */
async function resolveCafeForListing(listingId: string, ownerId: string): Promise<{ id: string; businessName: string | null } | null> {
  const rows = await db.select().from(cafesTable).where(eq(cafesTable.listingId, listingId));
  const me = ndaOwnerBase(ownerId);
  const cafe = rows.find((c) => ndaOwnerBase(c.ownerId) === me);
  return cafe ? { id: cafe.id, businessName: (cafe as any).businessName ?? (cafe as any).name ?? null } : null;
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
  const ndaText = await resolveNdaBody(listingId);
  const manualOnly = await ndaManualOnly(listingId);
  // Without a resolvable identity we can't record a signature, so treat as
  // "not required" rather than trapping the viewer behind an unusable gate.
  if (!phone) { res.json({ required: false, accepted: false, ndaText, manualOnly }); return; }
  const accepted = required ? await ndaSigned(listingId, phone) : true;
  res.json({ required, accepted, ndaText, manualOnly });
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
  // Manual-only listings can't be self-signed — the seller/broker grants access.
  if (await ndaManualOnly(listingId)) {
    res.status(403).json({ error: "manual_only", message: "Access to this report is granted directly by the seller or broker." });
    return;
  }
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

// ─── Seller/broker: NDA template + per-listing settings + manual grant ────────

async function callerOwnsListing(userId: string, listingId: string): Promise<boolean> {
  const me = ndaOwnerBase(userId);
  if (!me) return false;
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings = Array.isArray(rows[0]?.value) ? (rows[0]!.value as any[]) : [];
    const l = listings.find((x) => x?.listingId === listingId);
    if (!l) return false;
    return [l.submittedBy, l.sellerPhone, l.ownerPhone, l.phone, l.contactPhone]
      .some((f) => { const k = ndaOwnerBase(f); return !!k && k === me; });
  } catch { return false; }
}

/** GET the caller's default NDA template (used across all their listings). */
router.get("/buyer-portal/seller/nda-template", requireAuth, async (req, res): Promise<void> => {
  const tpl = await kvMap(NDA_TPL_KEY);
  const mine = tpl[ndaOwnerBase(req.user!.id)];
  res.json({ template: (typeof mine === "string" && mine.trim()) ? mine : "", default: DEFAULT_NDA_TEXT });
});

/** PUT the caller's default NDA template. Blank clears it (reverts to platform default). */
router.put("/buyer-portal/seller/nda-template", requireAuth, async (req, res): Promise<void> => {
  const { template } = req.body as { template?: string };
  const tpl = await kvMap(NDA_TPL_KEY);
  const base = ndaOwnerBase(req.user!.id);
  const clean = String(template ?? "").trim().slice(0, 8000);
  if (clean) tpl[base] = clean; else delete tpl[base];
  await kvSaveMap(NDA_TPL_KEY, tpl);
  res.json({ ok: true, template: clean });
});

/** GET a listing's NDA settings + signatures (owner only). */
router.get("/buyer-portal/seller/nda/:listingId", requireAuth, async (req, res): Promise<void> => {
  const { listingId } = req.params;
  if (!(await callerOwnsListing(req.user!.id, listingId))) { res.status(403).json({ error: "Not your listing" }); return; }
  const bodyMap = await kvMap(NDA_BODY_KEY);
  const required = await ndaRequiredForListing(listingId);
  const manualOnly = await ndaManualOnly(listingId);
  const resolved = await resolveNdaBody(listingId);
  let signatures: any[] = [];
  try {
    signatures = await db.select().from(ndaSignaturesTable)
      .where(eq(ndaSignaturesTable.listingId, listingId))
      .orderBy(desc(ndaSignaturesTable.signedAt)).limit(200);
  } catch { /* table may be empty */ }
  res.json({
    listingId,
    required,
    manualOnly,
    body: (typeof bodyMap[listingId] === "string") ? bodyMap[listingId] : "",
    resolvedBody: resolved,
    signatures: signatures.map((s) => ({ name: s.buyerName, phone: s.buyerPhone, signedAt: s.signedAt, version: s.ndaVersion })),
  });
});

/** PUT a listing's NDA settings: per-listing body override, required flag, manual-only. */
router.put("/buyer-portal/seller/nda/:listingId", requireAuth, async (req, res): Promise<void> => {
  const { listingId } = req.params;
  if (!(await callerOwnsListing(req.user!.id, listingId))) { res.status(403).json({ error: "Not your listing" }); return; }
  const { body, manualOnly, required } = req.body as { body?: string; manualOnly?: boolean; required?: boolean };

  if (body !== undefined) {
    const map = await kvMap(NDA_BODY_KEY);
    const clean = String(body ?? "").trim().slice(0, 8000);
    if (clean) map[listingId] = clean; else delete map[listingId];
    await kvSaveMap(NDA_BODY_KEY, map);
  }
  if (manualOnly !== undefined) {
    const map = await kvMap(NDA_MANUAL_KEY);
    if (manualOnly) map[listingId] = true; else delete map[listingId];
    await kvSaveMap(NDA_MANUAL_KEY, map);
  }
  if (required !== undefined) {
    // Toggle nda_settings.ndaMode between required/none.
    try {
      const [existing] = await db.select().from(ndaSettingsTable).where(eq(ndaSettingsTable.listingId, listingId));
      const mode = required ? "required" : "none";
      if (existing) await db.update(ndaSettingsTable).set({ ndaMode: mode as any, updatedAt: new Date() }).where(eq(ndaSettingsTable.listingId, listingId));
      else await db.insert(ndaSettingsTable).values({ listingId, ndaMode: mode as any });
    } catch { /* non-fatal */ }
  }
  res.json({ ok: true });
});

/** POST manually grant a buyer access to a listing's report (records an NDA signature). */
router.post("/buyer-portal/seller/nda/:listingId/grant", requireAuth, async (req, res): Promise<void> => {
  const { listingId } = req.params;
  if (!(await callerOwnsListing(req.user!.id, listingId))) { res.status(403).json({ error: "Not your listing" }); return; }
  const { phone, name } = req.body as { phone?: string; name?: string };
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) { res.status(400).json({ error: "A valid buyer mobile number is required" }); return; }
  const normalised = `+${digits.startsWith("61") ? digits : digits.replace(/^0/, "61")}`;
  try {
    if (!(await ndaSigned(listingId, normalised))) {
      await db.insert(ndaSignaturesTable).values({
        listingId,
        buyerName: (name || "").trim() || "Access granted by seller",
        buyerPhone: normalised,
        ndaVersion: "manual-grant",
        otpVerified: true,
      });
    }
    // Also add them to the buyer-portal so the listing appears in their portal.
    try { await upsertBuyer(normalised, name); } catch { /* non-fatal */ }
    res.json({ ok: true, phone: normalised });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not grant access";
    res.status(500).json({ error: msg });
  }
});

// ─── Seller: tour zones (enable/disable a zone without deleting it) ──────────

const tourSpacesKey = (listingId: string) => `biz360_tour_spaces_v2_${listingId}`;

/** GET the listing's tour zones with their on/off state (owner only). */
router.get("/buyer-portal/seller/tour-zones/:listingId", requireAuth, async (req, res): Promise<void> => {
  const { listingId } = req.params;
  if (!(await callerOwnsListing(req.user!.id, listingId))) { res.status(403).json({ error: "Not your listing" }); return; }
  const rows = await db.select().from(kvStore).where(eq(kvStore.key, tourSpacesKey(listingId)));
  const spaces = Array.isArray(rows[0]?.value) ? (rows[0]!.value as any[]) : [];
  res.json({
    zones: spaces
      .filter((s) => s?.id)
      .map((s) => ({
        id: s.id,
        name: s.name ?? "Untitled zone",
        enabled: s.enabled !== false,
        isStartScene: !!s.isStartScene,
        hasPano: !!(s.panoramaUrl && String(s.panoramaUrl).indexOf("file://") !== 0),
      })),
  });
});

/** PUT on/off state for one or more zones (owner only). Merges `enabled` into the tour spaces KV. */
router.put("/buyer-portal/seller/tour-zones/:listingId", requireAuth, async (req, res): Promise<void> => {
  const { listingId } = req.params;
  if (!(await callerOwnsListing(req.user!.id, listingId))) { res.status(403).json({ error: "Not your listing" }); return; }
  const { zones } = req.body as { zones?: { id: string; enabled: boolean }[] };
  if (!Array.isArray(zones)) { res.status(400).json({ error: "zones array required" }); return; }
  const key = tourSpacesKey(listingId);
  const rows = await db.select().from(kvStore).where(eq(kvStore.key, key));
  const spaces = Array.isArray(rows[0]?.value) ? (rows[0]!.value as any[]) : [];
  const wanted = new Map(zones.map((z) => [String(z.id), !!z.enabled]));
  const resulting = spaces.map((s) => {
    const w = wanted.get(String(s?.id));
    return w === undefined ? s?.enabled !== false : w;
  });
  // Guard: never let a seller switch off every zone (that would leave an empty tour).
  if (spaces.length && !resulting.some(Boolean)) {
    res.status(400).json({ error: "At least one zone must stay switched on." });
    return;
  }
  let changed = 0;
  const next = spaces.map((s, i) => {
    const enabled = resulting[i];
    if ((s?.enabled !== false) !== enabled) changed++;
    return { ...s, enabled };
  });
  await db.insert(kvStore).values({ key, value: next }).onConflictDoUpdate({
    target: kvStore.key,
    set: { value: next, updatedAt: new Date() },
  });
  res.json({ ok: true, changed, zones: next.map((s) => ({ id: s.id, name: s.name, enabled: s.enabled !== false })) });
});

/** Save the full tour-spaces array for a listing (owner only). Bidirectional
 *  with the app's tour store (biz360_tour_spaces_v2_<listingId>). */
router.put("/buyer-portal/seller/tour-spaces/:listingId", requireAuth, async (req, res): Promise<void> => {
  const { listingId } = req.params;
  if (!(await callerOwnsListing(req.user!.id, listingId))) { res.status(403).json({ error: "Not your listing" }); return; }
  const { spaces } = req.body as { spaces?: any[] };
  if (!Array.isArray(spaces)) { res.status(400).json({ error: "spaces array required" }); return; }
  // Light sanitation: keep known fields, guarantee an id + pins array.
  const clean = spaces.slice(0, 60).map((s, i) => ({
    id: String(s?.id ?? `space-${Date.now()}-${i}`),
    name: String(s?.name ?? `Space ${i + 1}`).slice(0, 120),
    panoramaUrl: typeof s?.panoramaUrl === "string" ? s.panoramaUrl : "",
    panoramaStartYaw: typeof s?.panoramaStartYaw === "number" ? s.panoramaStartYaw : 0,
    defaultYaw: typeof s?.defaultYaw === "number" ? s.defaultYaw : undefined,
    groundPitch: typeof s?.groundPitch === "number" ? s.groundPitch : undefined,
    isStartScene: !!s?.isStartScene,
    autoPan: !!s?.autoPan,
    enabled: s?.enabled === false ? false : undefined,
    audioUrl: typeof s?.audioUrl === "string" ? s.audioUrl : undefined,
    audioName: typeof s?.audioName === "string" ? s.audioName : undefined,
    pins: Array.isArray(s?.pins) ? s.pins.slice(0, 40) : [],
  }));
  const key = tourSpacesKey(listingId);
  await db.insert(kvStore).values({ key, value: clean })
    .onConflictDoUpdate({ target: kvStore.key, set: { value: clean, updatedAt: new Date() } });
  res.json({ ok: true, count: clean.length });
});

/** Resolve the buyer-access cafe for one of the caller's listings (for the web
 *  dashboard, which works in listingIds while groups are keyed by cafeId). */
router.get("/buyer-portal/seller/listing-cafe/:listingId", requireAuth, async (req, res): Promise<void> => {
  const { listingId } = req.params;
  if (!(await callerOwnsListing(req.user!.id, listingId))) { res.status(403).json({ error: "Not your listing" }); return; }
  const cafe = await resolveCafeForListing(listingId, req.user!.id);
  res.json({ cafeId: cafe?.id ?? null, businessName: cafe?.businessName ?? null });
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

  // Owner already verified by requireOwner above; list by cafe so groups created
  // in the app (whatever owner-id format) still show on the web.
  const groups = await db.select().from(buyerPortalGroupsTable)
    .where(eq(buyerPortalGroupsTable.cafeId, cafeId));

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
