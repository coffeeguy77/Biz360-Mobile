import { Router, type IRouter } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db, valuationSnapshotsTable, businessUnitsTable } from "@workspace/db";
import { assertCafeOwner } from "./cafes";
import { calculateAndSaveSnapshot } from "./square";
import type { Request, Response } from "express";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const snapshots = await db.select().from(valuationSnapshotsTable).where(eq(valuationSnapshotsTable.cafeId, cafeId)).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(12);
  return res.json(snapshots);
});

router.get("/latest", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const [combined] = await db.select().from(valuationSnapshotsTable).where(
    and(eq(valuationSnapshotsTable.cafeId, cafeId), isNull(valuationSnapshotsTable.unitId))
  ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
  const units = await db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId));
  const unitSnapshots = await Promise.all(units.map(async (unit) => {
    const [snap] = await db.select().from(valuationSnapshotsTable).where(
      and(eq(valuationSnapshotsTable.cafeId, cafeId), eq(valuationSnapshotsTable.unitId, unit.id))
    ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
    return { unit, snapshot: snap ?? null };
  }));
  return res.json({ combined: combined ?? null, units: unitSnapshots });
});

// POST /recalculate — recalculate snapshot from cached data (used after toggling units in/out of sale)
router.post("/recalculate", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  const { periodMonths = 12 } = req.body as { periodMonths?: number };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const result = await calculateAndSaveSnapshot(cafeId, userId, periodMonths);
  return res.json(result);
});

// POST /publish — seller publishes latest combined snapshot to buyers
router.post("/publish", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  // Find the latest combined snapshot
  const [combined] = await db.select().from(valuationSnapshotsTable).where(
    and(eq(valuationSnapshotsTable.cafeId, cafeId), isNull(valuationSnapshotsTable.unitId))
  ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
  if (!combined) return res.status(404).json({ error: "No snapshot found. Please sync financials first." });
  // Publish combined snapshot
  await db.update(valuationSnapshotsTable).set({ isPublished: true }).where(eq(valuationSnapshotsTable.id, combined.id));
  // Also publish all unit snapshots for the same cafe that were created within the same sync window (same snapshotDate)
  if (combined.snapshotDate) {
    const unitSnaps = await db.select().from(valuationSnapshotsTable).where(
      and(eq(valuationSnapshotsTable.cafeId, cafeId), eq(valuationSnapshotsTable.snapshotDate, combined.snapshotDate))
    );
    await Promise.all(unitSnaps.map((s) => db.update(valuationSnapshotsTable).set({ isPublished: true }).where(eq(valuationSnapshotsTable.id, s.id))));
  }
  return res.json({ ok: true, snapshotId: combined.id, snapshotDate: combined.snapshotDate });
});

export default router;
