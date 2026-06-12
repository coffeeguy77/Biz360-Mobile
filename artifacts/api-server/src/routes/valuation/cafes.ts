import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { db, cafesTable, cafeIntegrationsTable, cafeEquipmentTable, ownerAdjustmentsTable, valuationSnapshotsTable, squareOrdersCacheTable, xeroPLMappingsTable, xeroSupplierMappingsTable, businessUnitsTable, reportImagesTable } from "@workspace/db";
import { logger } from "../../lib/logger";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const router: IRouter = Router();

async function assertCafeOwner(cafeId: string, userId: string) {
  const [cafe] = await db.select().from(cafesTable).where(and(eq(cafesTable.id, cafeId), eq(cafesTable.ownerId, userId)));
  if (!cafe) { const err: any = new Error("Café not found or access denied"); err.status = 403; throw err; }
  return cafe;
}
export { assertCafeOwner };

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const cafes = await db.select().from(cafesTable).where(eq(cafesTable.ownerId, userId));
  const cafesWithIntegrations = await Promise.all(cafes.map(async (cafe) => {
    const integrations = await db.select({ id: cafeIntegrationsTable.id, type: cafeIntegrationsTable.type, status: cafeIntegrationsTable.status, merchantName: cafeIntegrationsTable.merchantName }).from(cafeIntegrationsTable).where(eq(cafeIntegrationsTable.cafeId, cafe.id));
    return { ...cafe, integrations };
  }));
  return res.json(cafesWithIntegrations);
});

router.post("/", async (req, res) => {
  const userId = req.user!.id;
  const { name, city, businessType, currency, timezone, listing_id } = req.body as { name?: string; city?: string; businessType?: string; currency?: string; timezone?: string; listing_id?: string };
  if (!name) return res.status(400).json({ error: "name is required" });
  const [cafe] = await db.insert(cafesTable).values({ ownerId: userId, name, city: city || null, businessType: businessType || "cafe", currency: currency || "AUD", timezone: timezone || null, listingId: listing_id || null }).returning();
  logger.info({ cafeId: cafe.id, userId }, "Café created");
  return res.status(201).json(cafe);
});

router.get("/:cafeId", async (req, res) => {
  const userId = req.user!.id;
  const cafe = await assertCafeOwner(req.params.cafeId!, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (!cafe) return;
  const integrations = await db.select().from(cafeIntegrationsTable).where(eq(cafeIntegrationsTable.cafeId, cafe.id));
  return res.json({ ...cafe, integrations });
});

router.patch("/:cafeId", async (req, res) => {
  const userId = req.user!.id;
  const existing = await assertCafeOwner(req.params.cafeId!, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (!existing) return;
  const { name, city, timezone, currency, listing_id } = req.body as { name?: string; city?: string; timezone?: string; currency?: string; listing_id?: string };
  const [updated] = await db.update(cafesTable).set({
    ...(name !== undefined && { name }),
    ...(city !== undefined && { city }),
    ...(timezone !== undefined && { timezone }),
    ...(currency !== undefined && { currency }),
    ...(listing_id !== undefined && { listingId: listing_id }),
  }).where(eq(cafesTable.id, existing.id)).returning();
  return res.json(updated);
});

router.delete("/:cafeId", async (req, res) => {
  const userId = req.user!.id;
  const cafe = await assertCafeOwner(req.params.cafeId!, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (!cafe) return;
  const cafeId = cafe.id;

  // ── report_images cascade ─────────────────────────────────────────────────
  // Soft-delete all report images for this listing. Purge Cloudinary only for
  // source_type='uploaded' assets (listing_photo / tour_thumbnail are shared
  // assets not in the report-images folder).
  if (cafe.listingId) {
    const imageRows = await db
      .select({
        id:         reportImagesTable.id,
        publicId:   reportImagesTable.cloudinaryPublicId,
        sourceType: reportImagesTable.sourceType,
      })
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.listingId, cafe.listingId),
        isNull(reportImagesTable.deletedAt),
      ));

    if (imageRows.length > 0) {
      await db
        .update(reportImagesTable)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(reportImagesTable.listingId, cafe.listingId),
          isNull(reportImagesTable.deletedAt),
        ));

      const uploadedPublicIds = imageRows
        .filter((r) => r.sourceType === "uploaded")
        .map((r) => r.publicId);
      if (uploadedPublicIds.length > 0) {
        cloudinary.api.delete_resources(uploadedPublicIds).catch((e) => {
          logger.warn({ err: e, listingId: cafe.listingId }, "Cloudinary bulk purge on listing delete failed");
        });
      }
      logger.info({ cafeId, listingId: cafe.listingId, count: imageRows.length }, "Report images cascade soft-deleted");
    }
  }

  await Promise.all([
    db.delete(cafeIntegrationsTable).where(eq(cafeIntegrationsTable.cafeId, cafeId)),
    db.delete(cafeEquipmentTable).where(eq(cafeEquipmentTable.cafeId, cafeId)),
    db.delete(ownerAdjustmentsTable).where(eq(ownerAdjustmentsTable.cafeId, cafeId)),
    db.delete(valuationSnapshotsTable).where(eq(valuationSnapshotsTable.cafeId, cafeId)),
    db.delete(squareOrdersCacheTable).where(eq(squareOrdersCacheTable.cafeId, cafeId)),
    db.delete(xeroPLMappingsTable).where(eq(xeroPLMappingsTable.cafeId, cafeId)),
    db.delete(xeroSupplierMappingsTable).where(eq(xeroSupplierMappingsTable.cafeId, cafeId)),
    db.delete(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId)),
  ]);
  await db.delete(cafesTable).where(eq(cafesTable.id, cafeId));
  logger.info({ cafeId, userId }, "Café deleted");
  return res.json({ ok: true });
});

export default router;
