import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  cafesTable,
  ndaSettingsTable,
  ndaSignaturesTable,
} from "@workspace/db";

const router = Router({ mergeParams: true });

async function requireCafeOwner(cafeId: string, ownerId: string) {
  const [cafe] = await db.select().from(cafesTable).where(
    and(eq(cafesTable.id, cafeId), eq(cafesTable.ownerId, ownerId))
  );
  return cafe ?? null;
}

// GET /valuation/cafes/:cafeId/nda-settings
router.get("/", async (req, res) => {
  const { cafeId } = req.params as { cafeId: string };
  const ownerId = req.user!.id;
  const cafe = await requireCafeOwner(cafeId, ownerId);
  if (!cafe) return res.status(403).json({ error: "Forbidden" });
  const listingId = cafe.listingId;
  if (!listingId) return res.json({ settings: null });

  const [settings] = await db.select().from(ndaSettingsTable)
    .where(eq(ndaSettingsTable.listingId, listingId));
  return res.json({ settings: settings ?? null });
});

// PUT /valuation/cafes/:cafeId/nda-settings
router.put("/", async (req, res) => {
  const { cafeId } = req.params as { cafeId: string };
  const ownerId = req.user!.id;
  const cafe = await requireCafeOwner(cafeId, ownerId);
  if (!cafe) return res.status(403).json({ error: "Forbidden" });
  const listingId = cafe.listingId;
  if (!listingId) return res.status(400).json({ error: "This valuation has no linked listing" });

  const { ndaMode, thirdPartyUrl } = req.body as {
    ndaMode?: string;
    thirdPartyUrl?: string;
  };

  const validModes = ["none", "required", "third_party"];
  if (ndaMode && !validModes.includes(ndaMode)) {
    return res.status(400).json({ error: "Invalid NDA mode" });
  }

  if (ndaMode === "third_party" && !thirdPartyUrl?.trim()) {
    return res.status(400).json({ error: "thirdPartyUrl is required when ndaMode is third_party" });
  }

  const [existing] = await db.select().from(ndaSettingsTable)
    .where(eq(ndaSettingsTable.listingId, listingId));

  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (ndaMode) updates.ndaMode = ndaMode;
    if (thirdPartyUrl !== undefined) updates.thirdPartyUrl = thirdPartyUrl?.trim() || null;
    const [updated] = await db.update(ndaSettingsTable)
      .set(updates)
      .where(eq(ndaSettingsTable.listingId, listingId))
      .returning();
    return res.json({ settings: updated });
  } else {
    const [created] = await db.insert(ndaSettingsTable).values({
      listingId,
      ndaMode: (ndaMode ?? "none") as any,
      thirdPartyUrl: thirdPartyUrl?.trim() || null,
    }).returning();
    return res.json({ settings: created });
  }
});

// GET /valuation/cafes/:cafeId/nda-settings/signatures
router.get("/signatures", async (req, res) => {
  const { cafeId } = req.params as { cafeId: string };
  const ownerId = req.user!.id;
  const cafe = await requireCafeOwner(cafeId, ownerId);
  if (!cafe) return res.status(403).json({ error: "Forbidden" });
  const listingId = cafe.listingId;
  if (!listingId) return res.json({ signatures: [], total: 0 });

  const signatures = await db.select().from(ndaSignaturesTable)
    .where(eq(ndaSignaturesTable.listingId, listingId))
    .orderBy(desc(ndaSignaturesTable.signedAt))
    .limit(200);

  return res.json({ signatures, total: signatures.length });
});

export default router;
