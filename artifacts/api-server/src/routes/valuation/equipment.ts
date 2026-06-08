import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, cafeEquipmentTable } from "@workspace/db";
import { assertCafeOwner } from "./cafes";

const router: IRouter = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { unit_id } = req.query as { unit_id?: string };
  const conditions = [eq(cafeEquipmentTable.cafeId, cafeId), eq(cafeEquipmentTable.suspended, false)];
  if (unit_id) conditions.push(eq(cafeEquipmentTable.unitId, unit_id) as any);
  const items = await db.select().from(cafeEquipmentTable).where(and(...conditions));
  return res.json(items);
});

router.post("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { name, purchasePrice, currentValue, valuationMode, isLeased, unit_id } = req.body as { name?: string; purchasePrice?: number; currentValue?: number; valuationMode?: string; isLeased?: boolean; unit_id?: string };
  if (!name) return res.status(400).json({ error: "name is required" });
  const [item] = await db.insert(cafeEquipmentTable).values({
    cafeId,
    ownerId: userId,
    unitId: unit_id || null,
    name,
    purchasePrice: purchasePrice != null ? String(purchasePrice) : null,
    currentValue: currentValue != null ? String(currentValue) : null,
    valuationMode: valuationMode || "purchase",
    isLeased: isLeased ?? false,
    suspended: false,
  }).returning();
  return res.status(201).json(item);
});

router.patch("/:equipmentId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, equipmentId } = req.params as { cafeId: string; equipmentId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { name, purchasePrice, currentValue, valuationMode, isLeased, unit_id } = req.body as { name?: string; purchasePrice?: number; currentValue?: number; valuationMode?: string; isLeased?: boolean; unit_id?: string | null };
  const [updated] = await db.update(cafeEquipmentTable).set({
    ...(name !== undefined && { name }),
    ...(purchasePrice !== undefined && { purchasePrice: String(purchasePrice) }),
    ...(currentValue !== undefined && { currentValue: String(currentValue) }),
    ...(valuationMode !== undefined && { valuationMode }),
    ...(isLeased !== undefined && { isLeased }),
    ...(unit_id !== undefined && { unitId: unit_id }),
  }).where(and(eq(cafeEquipmentTable.id, equipmentId), eq(cafeEquipmentTable.cafeId, cafeId))).returning();
  if (!updated) return res.status(404).json({ error: "Equipment not found" });
  return res.json(updated);
});

router.delete("/:equipmentId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, equipmentId } = req.params as { cafeId: string; equipmentId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  await db.delete(cafeEquipmentTable).where(and(eq(cafeEquipmentTable.id, equipmentId), eq(cafeEquipmentTable.cafeId, cafeId)));
  return res.json({ ok: true });
});

export default router;
