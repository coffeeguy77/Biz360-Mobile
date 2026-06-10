import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cafeEquipmentTable } from "@workspace/db";
import { assertCafeOwner } from "./cafes";

const router: IRouter = Router({ mergeParams: true });

function resolveCurrentValue(item: {
  valuationMode?: string;
  secondhandValue?: number | string | null;
  replacementCost?: number | string | null;
  manualValue?: number | string | null;
  purchasePrice?: number | string | null;
}): string | null {
  const mode = item.valuationMode ?? "secondhand";
  if (mode === "secondhand" && item.secondhandValue != null) return String(item.secondhandValue);
  if (mode === "replacement" && item.replacementCost != null) return String(item.replacementCost);
  if (mode === "manual" && item.manualValue != null) return String(item.manualValue);
  if (item.secondhandValue != null) return String(item.secondhandValue);
  if (item.purchasePrice != null) return String(item.purchasePrice);
  return null;
}

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
  const {
    name, category, brand, purchaseDate, condition, depreciationYears,
    purchasePrice, secondhandValue, replacementCost, currentValue, manualValue,
    valuationMode, ownership, notes, isLeased, unit_id,
  } = req.body as {
    name?: string; category?: string; brand?: string; purchaseDate?: string;
    condition?: string; depreciationYears?: number;
    purchasePrice?: number; secondhandValue?: number; replacementCost?: number;
    currentValue?: number; manualValue?: number; valuationMode?: string;
    ownership?: string; notes?: string; isLeased?: boolean; unit_id?: string;
  };
  if (!name) return res.status(400).json({ error: "name is required" });
  const resolvedVal = currentValue != null
    ? String(currentValue)
    : resolveCurrentValue({ valuationMode, secondhandValue, replacementCost, manualValue, purchasePrice });
  const [item] = await db.insert(cafeEquipmentTable).values({
    cafeId,
    ownerId: userId,
    unitId: unit_id || null,
    name,
    category: category || null,
    brand: brand || null,
    purchaseDate: purchaseDate || null,
    condition: condition || null,
    depreciationYears: depreciationYears != null ? depreciationYears : null,
    purchasePrice: purchasePrice != null ? String(purchasePrice) : null,
    secondhandValue: secondhandValue != null ? String(secondhandValue) : null,
    replacementCost: replacementCost != null ? String(replacementCost) : null,
    currentValue: resolvedVal,
    valuationMode: valuationMode || "secondhand",
    ownership: ownership || null,
    notes: notes || null,
    isLeased: isLeased ?? false,
    suspended: false,
  }).returning();
  return res.status(201).json(item);
});

// ─── Bulk CSV import ──────────────────────────────────────────────────────────

router.post("/import", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;

  const { items, unit_id } = req.body as {
    items: Array<{
      name: string; category?: string; brand?: string; purchaseDate?: string;
      condition?: string; depreciationYears?: number;
      purchasePrice?: number; secondhandValue?: number; replacementCost?: number;
      manualValue?: number; valuationMode?: string; ownership?: string; notes?: string;
    }>;
    unit_id?: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }

  const rows = items
    .filter((item) => item.name && String(item.name).trim())
    .map((item) => ({
      cafeId,
      ownerId: userId,
      unitId: unit_id || null,
      name: String(item.name).trim(),
      category: item.category || null,
      brand: item.brand || null,
      purchaseDate: item.purchaseDate || null,
      condition: item.condition || null,
      depreciationYears: item.depreciationYears != null ? Number(item.depreciationYears) : null,
      purchasePrice: item.purchasePrice != null ? String(item.purchasePrice) : null,
      secondhandValue: item.secondhandValue != null ? String(item.secondhandValue) : null,
      replacementCost: item.replacementCost != null ? String(item.replacementCost) : null,
      currentValue: resolveCurrentValue(item),
      valuationMode: item.valuationMode || "secondhand",
      ownership: item.ownership || null,
      notes: item.notes || null,
      isLeased: item.ownership === "leased",
      suspended: false,
    }));

  if (rows.length === 0) {
    return res.status(400).json({ error: "No valid rows to import" });
  }

  const inserted = await db.insert(cafeEquipmentTable).values(rows).returning();
  return res.status(201).json({ imported: inserted.length, items: inserted });
});

router.patch("/:equipmentId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, equipmentId } = req.params as { cafeId: string; equipmentId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const {
    name, category, brand, purchaseDate, condition, depreciationYears,
    purchasePrice, secondhandValue, replacementCost, currentValue, manualValue,
    valuationMode, ownership, notes, isLeased, unit_id,
  } = req.body as {
    name?: string; category?: string; brand?: string; purchaseDate?: string;
    condition?: string; depreciationYears?: number;
    purchasePrice?: number; secondhandValue?: number; replacementCost?: number;
    currentValue?: number; manualValue?: number; valuationMode?: string;
    ownership?: string; notes?: string; isLeased?: boolean; unit_id?: string | null;
  };
  const resolvedVal = currentValue != null
    ? String(currentValue)
    : resolveCurrentValue({ valuationMode, secondhandValue, replacementCost, manualValue, purchasePrice });
  const [updated] = await db.update(cafeEquipmentTable).set({
    ...(name !== undefined && { name }),
    ...(category !== undefined && { category }),
    ...(brand !== undefined && { brand }),
    ...(purchaseDate !== undefined && { purchaseDate }),
    ...(condition !== undefined && { condition }),
    ...(depreciationYears !== undefined && { depreciationYears }),
    ...(purchasePrice !== undefined && { purchasePrice: String(purchasePrice) }),
    ...(secondhandValue !== undefined && { secondhandValue: String(secondhandValue) }),
    ...(replacementCost !== undefined && { replacementCost: String(replacementCost) }),
    ...(resolvedVal !== null && { currentValue: resolvedVal }),
    ...(valuationMode !== undefined && { valuationMode }),
    ...(ownership !== undefined && { ownership }),
    ...(notes !== undefined && { notes }),
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
