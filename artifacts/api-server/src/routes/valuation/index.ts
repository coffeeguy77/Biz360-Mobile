import { Router, type IRouter } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db, cafesTable, valuationSnapshotsTable, businessUnitsTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import cafesRouter from "./cafes";
import unitsRouter from "./units";
import equipmentRouter from "./equipment";
import adjustmentsRouter from "./adjustments";
import snapshotsRouter from "./snapshots";
import squareRouter from "./square";
import xeroRouter from "./xero";
import oauthRouter from "./oauth";

const router: IRouter = Router();

// PUBLIC: OAuth start, callbacks, and done page MUST come before requireAuth
router.use("/valuation", oauthRouter);

// PUBLIC: Snapshot for a listing — only returns published snapshots
router.get("/valuation/listing/:listingId/snapshot", async (req, res) => {
  const { listingId } = req.params as { listingId: string };
  const [cafe] = await db.select().from(cafesTable).where(eq(cafesTable.listingId, listingId));
  if (!cafe) return res.json({ combined: null, units: [] });
  const [combined] = await db.select().from(valuationSnapshotsTable).where(
    and(eq(valuationSnapshotsTable.cafeId, cafe.id), isNull(valuationSnapshotsTable.unitId), eq(valuationSnapshotsTable.isPublished, true))
  ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
  if (!combined) return res.json({ combined: null, units: [] });
  const units = await db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafe.id));
  const unitSnapshots = await Promise.all(units.map(async (unit) => {
    const [snap] = await db.select().from(valuationSnapshotsTable).where(
      and(eq(valuationSnapshotsTable.cafeId, cafe.id), eq(valuationSnapshotsTable.unitId, unit.id), eq(valuationSnapshotsTable.isPublished, true))
    ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
    return { unit, snapshot: snap ?? null };
  }));
  return res.json({ combined, units: unitSnapshots });
});

// AUTH GUARD for all remaining /valuation/* routes
router.use("/valuation", requireAuth);

// AUTHENTICATED routes
router.use("/valuation/cafes/:cafeId/units", unitsRouter);
router.use("/valuation/cafes/:cafeId/equipment", equipmentRouter);
router.use("/valuation/cafes/:cafeId/adjustments", adjustmentsRouter);
router.use("/valuation/cafes/:cafeId/snapshots", snapshotsRouter);
router.use("/valuation/cafes", cafesRouter);
router.use("/valuation", squareRouter);
router.use("/valuation", xeroRouter);

export default router;
