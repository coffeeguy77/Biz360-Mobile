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
  cafesTable,
  buyerPortalGroupsTable,
  buyerPortalGroupMembersTable,
  buyerPortalGroupPermissionsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

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
async function signReportAccessToken(listingId: string): Promise<string> {
  return new SignJWT({ listingId, type: "report-access" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getJwtSecret());
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) throw new Error("Twilio credentials not configured");
  return twilio(sid, auth);
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
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) {
    res.status(400).json({ error: "phone and code are required" });
    return;
  }
  try {
    const client = getTwilioClient();
    const check = await client.verify.v2
      .services(getVerifyServiceSid())
      .verificationChecks.create({ to: phone, code });
    if (check.status !== "approved") {
      res.status(400).json({ error: "Incorrect or expired code" });
      return;
    }
    const token = await signBuyerToken(phone);
    res.json({ ok: true, token, phone });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: msg });
  }
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

  // Find all group memberships for this phone number
  const memberships = await db.select().from(buyerPortalGroupMembersTable)
    .where(eq(buyerPortalGroupMembersTable.phone, phone));

  if (!memberships.length) {
    res.json({ listings: [] });
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

  // Build response — one entry per cafe
  const listings = await Promise.all(
    Object.entries(mergedPerms).map(async ([cafeId, perms]) => {
      const cafe = cafes.find((c) => c.id === cafeId);
      if (!cafe) return null;
      // Only issue an accessToken if they have IM report access
      const accessToken = perms.canViewImReport && cafe.listingId
        ? await signReportAccessToken(cafe.listingId)
        : null;
      return {
        cafeId,
        listingId: cafe.listingId ?? null,
        businessName: cafe.businessName ?? cafe.name,
        city: cafe.city ?? null,
        businessType: cafe.businessType ?? "business",
        permissions: perms,
        accessToken,
      };
    })
  );

  res.json({ listings: listings.filter(Boolean), phone });
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
