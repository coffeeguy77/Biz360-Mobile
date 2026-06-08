import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, businessUnitsTable } from "@workspace/db";
import { assertCafeOwner } from "./cafes";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const units = await db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId));
  units.sort((a, b) => a.sortOrder - b.sortOrder);
  return res.json(units);
});

router.post("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { name, revenue_share_pct, sort_order } = req.body as { name?: string; revenue_share_pct?: number; sort_order?: number };
  if (!name) return res.status(400).json({ error: "name is required" });
  const existing = await db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId));
  if (existing.length >= 8) return res.status(400).json({ error: "Maximum 8 business units per café" });
  const [unit] = await db.insert(businessUnitsTable).values({
    cafeId,
    ownerId: userId,
    name,
    revenueSharePct: String(revenue_share_pct ?? 0),
    sortOrder: sort_order ?? existing.length,
  }).returning();
  return res.status(201).json(unit);
});

router.patch("/validate-split", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const units = await db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId));
  const total = units.reduce((s, u) => s + Number(u.revenueSharePct ?? 0), 0);
  return res.json({ total, valid: total <= 100, units });
});

router.patch("/:unitId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, unitId } = req.params as { cafeId: string; unitId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { name, revenue_share_pct, sort_order } = req.body as { name?: string; revenue_share_pct?: number; sort_order?: number };
  const [updated] = await db.update(businessUnitsTable).set({
    ...(name !== undefined && { name }),
    ...(revenue_share_pct !== undefined && { revenueSharePct: String(revenue_share_pct) }),
    ...(sort_order !== undefined && { sortOrder: sort_order }),
  }).where(and(eq(businessUnitsTable.id, unitId), eq(businessUnitsTable.cafeId, cafeId))).returning();
  if (!updated) return res.status(404).json({ error: "Business unit not found" });
  return res.json(updated);
});

router.delete("/:unitId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, unitId } = req.params as { cafeId: string; unitId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  await db.delete(businessUnitsTable).where(and(eq(businessUnitsTable.id, unitId), eq(businessUnitsTable.cafeId, cafeId)));
  return res.json({ ok: true });
});

export default router;
