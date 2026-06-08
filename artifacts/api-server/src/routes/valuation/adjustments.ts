import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ownerAdjustmentsTable } from "@workspace/db";
import { assertCafeOwner } from "./cafes";

const router: IRouter = Router({ mergeParams: true });

function restoreType(row: any) {
  if (row.description && typeof row.description === "object") {
    const appType = (row.description as any)._appType;
    if (appType) return { ...row, type: appType };
  }
  return { ...row, type: "other" };
}

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { unit_id } = req.query as { unit_id?: string };
  const conditions = [eq(ownerAdjustmentsTable.cafeId, cafeId)];
  if (unit_id) conditions.push(eq(ownerAdjustmentsTable.unitId, unit_id) as any);
  const rows = await db.select().from(ownerAdjustmentsTable).where(and(...conditions));
  return res.json(rows.map(restoreType));
});

router.post("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { label, annualAmount, type, unit_id } = req.body as { label?: string; annualAmount?: number; type?: string; unit_id?: string };
  if (!label) return res.status(400).json({ error: "label is required" });
  if (annualAmount == null) return res.status(400).json({ error: "annualAmount is required" });
  const [row] = await db.insert(ownerAdjustmentsTable).values({
    cafeId,
    ownerId: userId,
    unitId: unit_id || null,
    label,
    annualAmount: String(annualAmount),
    description: { _appType: type || "other" },
  }).returning();
  return res.status(201).json(restoreType(row));
});

router.patch("/:adjustmentId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, adjustmentId } = req.params as { cafeId: string; adjustmentId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { label, annualAmount, type, unit_id } = req.body as { label?: string; annualAmount?: number; type?: string; unit_id?: string | null };
  const updateData: Record<string, any> = {};
  if (label !== undefined) updateData.label = label;
  if (annualAmount !== undefined) updateData.annualAmount = String(annualAmount);
  if (type !== undefined) updateData.description = { _appType: type };
  if (unit_id !== undefined) updateData.unitId = unit_id;
  const [updated] = await db.update(ownerAdjustmentsTable).set(updateData).where(and(eq(ownerAdjustmentsTable.id, adjustmentId), eq(ownerAdjustmentsTable.cafeId, cafeId))).returning();
  if (!updated) return res.status(404).json({ error: "Adjustment not found" });
  return res.json(restoreType(updated));
});

router.delete("/:adjustmentId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, adjustmentId } = req.params as { cafeId: string; adjustmentId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  await db.delete(ownerAdjustmentsTable).where(and(eq(ownerAdjustmentsTable.id, adjustmentId), eq(ownerAdjustmentsTable.cafeId, cafeId)));
  return res.json({ ok: true });
});

export default router;
