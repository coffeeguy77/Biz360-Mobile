import { Router, type IRouter } from "express";
import { eq, and, gte, isNull, desc, sql } from "drizzle-orm";
import { db, cafeIntegrationsTable, squareOrdersCacheTable, squareCategoryCacheTable, valuationSnapshotsTable, ownerAdjustmentsTable, cafeEquipmentTable, xeroPLMappingsTable, xeroSupplierMappingsTable, businessUnitsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { assertCafeOwner } from "./cafes";
import { computeGrossProfit, computeEbitda, computeAdjustedEbitda, computeValuationMidpoint } from "../../lib/valuation";
import { getValidXeroToken, getXeroFinancials, getXeroSupplierSpend } from "./xero";

const router: IRouter = Router();

router.post("/square/sync", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, periodMonths = 12, forceSync = false } = req.body as { cafeId?: string; periodMonths?: number; forceSync?: boolean };
  if (!cafeId) return res.status(400).json({ error: "cafeId is required" });
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const [squareInt] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "square"), eq(cafeIntegrationsTable.status, "connected")));
  if (!squareInt) return res.status(404).json({ error: "Square not connected" });
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - periodMonths);
  if (forceSync || process.env.SQUARE_APP_ID) {
    try { await syncSquareOrders(cafeId, userId, squareInt.accessToken!, fromDate, toDate); }
    catch (e: any) { logger.warn({ err: e.message, cafeId }, "Square sync partial failure — using cached data"); }
  }
  const result = await calculateAndSaveSnapshot(cafeId, userId, periodMonths);
  return res.json(result);
});

/**
 * Build a map of Square catalog object IDs → category name.
 * Fetches ITEM, ITEM_VARIATION, and CATEGORY objects from the Square Catalog API
 * and resolves the chain: ITEM_VARIATION → ITEM → CATEGORY.
 * Returns empty map on error (non-fatal — category drilldown degrades gracefully).
 */
async function buildSquareCatalogCategoryMap(accessToken: string): Promise<Record<string, string>> {
  try {
    const categoryNames: Record<string, string> = {};     // categoryId → name
    const itemToCategory: Record<string, string> = {};    // itemId → categoryId (first category)
    const variationToItem: Record<string, string> = {};   // variationId → itemId

    let cursor: string | undefined;
    do {
      const url = `https://connect.squareup.com/v2/catalog/list?types=ITEM,ITEM_VARIATION,CATEGORY${cursor ? `&cursor=${cursor}` : ""}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": "2024-01-17" } });
      if (!r.ok) break;
      const data = await r.json() as any;
      cursor = data.cursor;
      for (const obj of data.objects ?? []) {
        if (obj.type === "CATEGORY") {
          categoryNames[obj.id] = obj.category_data?.name ?? "Uncategorised";
        } else if (obj.type === "ITEM") {
          // categories array: [{ id, ordinal }] — take first
          const firstCatId = obj.item_data?.categories?.[0]?.id
            ?? obj.item_data?.category_id  // fallback for older API shapes
            ?? null;
          if (firstCatId) itemToCategory[obj.id] = firstCatId;
        } else if (obj.type === "ITEM_VARIATION") {
          const itemId = obj.item_variation_data?.item_id;
          if (itemId) variationToItem[obj.id] = itemId;
        }
      }
    } while (cursor);

    // Resolve: variationId → itemId → categoryId → categoryName
    const map: Record<string, string> = {};
    for (const [varId, itemId] of Object.entries(variationToItem)) {
      const catId = itemToCategory[itemId];
      if (catId && categoryNames[catId]) map[varId] = categoryNames[catId];
    }
    // Also allow direct item ID lookups (some line items reference the ITEM not ITEM_VARIATION)
    for (const [itemId, catId] of Object.entries(itemToCategory)) {
      if (categoryNames[catId]) map[itemId] = categoryNames[catId];
    }
    return map;
  } catch {
    return {};
  }
}

async function syncSquareOrders(cafeId: string, ownerId: string, accessToken: string, fromDate: Date, toDate: Date) {
  let locationIds: string[] = [];
  try {
    const locRes = await fetch("https://connect.squareup.com/v2/locations", { headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": "2024-01-17" } });
    if (locRes.ok) {
      const locData = await locRes.json() as any;
      locationIds = (locData.locations ?? []).filter((l: any) => l.status === "ACTIVE").map((l: any) => l.id as string);
    }
  } catch {}
  if (locationIds.length === 0) { logger.warn({ cafeId }, "Square: no active locations found, skipping sync"); return; }

  // Fetch catalog category map in parallel with orders (non-fatal if it fails)
  const catalogMapPromise = buildSquareCatalogCategoryMap(accessToken);

  let cursor: string | undefined;
  const dailyTotals: Record<string, { gross: number; net: number; count: number }> = {};
  // { date → { categoryName → { gross, count } } }
  const categoryDailyTotals: Record<string, Record<string, { gross: number; count: number }>> = {};

  do {
    const body: any = {
      location_ids: locationIds,
      query: { filter: { date_time_filter: { created_at: { start_at: fromDate.toISOString(), end_at: toDate.toISOString() } }, state_filter: { states: ["COMPLETED"] } } },
      limit: 500,
    };
    if (cursor) body.cursor = cursor;
    const r = await fetch("https://connect.squareup.com/v2/orders/search", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": "2024-01-17", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) break;
    const data = await r.json() as any;
    cursor = data.cursor;
    for (const order of data.orders ?? []) {
      const date = (order.created_at as string).slice(0, 10);
      const gross = (order.total_money?.amount ?? 0) / 100;
      const net = (order.net_amounts?.total_money?.amount ?? order.total_money?.amount ?? 0) / 100;
      if (!dailyTotals[date]) dailyTotals[date] = { gross: 0, net: 0, count: 0 };
      dailyTotals[date].gross += gross; dailyTotals[date].net += net; dailyTotals[date].count += 1;

      // Accumulate per-line-item category totals (resolved after catalog map is ready)
      if (!categoryDailyTotals[date]) categoryDailyTotals[date] = {};
      for (const li of order.line_items ?? []) {
        const catalogId = li.catalog_object_id ?? null;
        const itemName = li.name ?? "Other";
        const lineGross = (li.gross_sales_money?.amount ?? li.total_money?.amount ?? 0) / 100;
        if (lineGross === 0) continue;
        // Temporarily use catalogId as key; will be resolved to categoryName after sync
        const rawKey = catalogId ?? `__item__${itemName}`;
        if (!categoryDailyTotals[date][rawKey]) categoryDailyTotals[date][rawKey] = { gross: 0, count: 0 };
        categoryDailyTotals[date][rawKey].gross += lineGross;
        categoryDailyTotals[date][rawKey].count += 1;
      }
    }
  } while (cursor);

  // Save daily totals (existing cache)
  for (const [date, totals] of Object.entries(dailyTotals)) {
    await db.insert(squareOrdersCacheTable).values({ cafeId, ownerId, orderDate: date, grossAmount: String(Math.round(totals.gross * 100) / 100), netAmount: String(Math.round(totals.net * 100) / 100), orderCount: totals.count })
      .onConflictDoUpdate({ target: [squareOrdersCacheTable.cafeId, squareOrdersCacheTable.orderDate], set: { grossAmount: String(Math.round(totals.gross * 100) / 100), netAmount: String(Math.round(totals.net * 100) / 100), orderCount: totals.count } });
  }

  // Resolve catalog IDs to category names and save per-category cache
  try {
    const catalogMap = await catalogMapPromise;
    // Merge rawKey entries into category-name buckets
    // { date → { resolvedCategoryName → { gross, count } } }
    const resolvedByDate: Record<string, Record<string, { gross: number; count: number }>> = {};
    for (const [date, rawEntries] of Object.entries(categoryDailyTotals)) {
      resolvedByDate[date] = {};
      for (const [rawKey, totals] of Object.entries(rawEntries)) {
        let categoryName: string;
        if (rawKey.startsWith("__item__")) {
          // No catalog ID — use item name directly as fallback
          categoryName = rawKey.slice("__item__".length);
        } else {
          // Resolve via catalog map; fall back to "Other" if not found
          categoryName = catalogMap[rawKey] ?? "Other";
        }
        if (!resolvedByDate[date][categoryName]) resolvedByDate[date][categoryName] = { gross: 0, count: 0 };
        resolvedByDate[date][categoryName].gross += totals.gross;
        resolvedByDate[date][categoryName].count += totals.count;
      }
    }

    // Upsert into val_square_category_cache
    for (const [date, cats] of Object.entries(resolvedByDate)) {
      for (const [categoryName, totals] of Object.entries(cats)) {
        if (totals.gross === 0) continue;
        await db.insert(squareCategoryCacheTable).values({
          cafeId, ownerId, orderDate: date, categoryName,
          grossAmount: String(Math.round(totals.gross * 100) / 100),
          orderCount: totals.count,
        }).onConflictDoUpdate({
          target: [squareCategoryCacheTable.cafeId, squareCategoryCacheTable.orderDate, squareCategoryCacheTable.categoryName],
          set: {
            grossAmount: String(Math.round(totals.gross * 100) / 100),
            orderCount: totals.count,
          },
        });
      }
    }
  } catch (err) {
    logger.warn({ cafeId, err }, "Square: category cache update failed (non-fatal)");
  }
}

async function calculateAndSaveSnapshot(cafeId: string, ownerId: string, periodMonths: number) {
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - periodMonths);
  const fromStr = fromDate.toISOString().slice(0, 10);

  const [squareCacheRows, adjustmentRows, equipmentRows, plMappingRows, supplierMappingRows, units] = await Promise.all([
    db.select().from(squareOrdersCacheTable).where(and(eq(squareOrdersCacheTable.cafeId, cafeId), gte(squareOrdersCacheTable.orderDate, fromStr))),
    db.select().from(ownerAdjustmentsTable).where(eq(ownerAdjustmentsTable.cafeId, cafeId)),
    db.select().from(cafeEquipmentTable).where(and(eq(cafeEquipmentTable.cafeId, cafeId), eq(cafeEquipmentTable.suspended, false))),
    db.select().from(xeroPLMappingsTable).where(eq(xeroPLMappingsTable.cafeId, cafeId)),
    db.select().from(xeroSupplierMappingsTable).where(eq(xeroSupplierMappingsTable.cafeId, cafeId)),
    db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId)),
  ]);

  const squareRevenue = squareCacheRows.reduce((s, r) => s + Number(r.grossAmount ?? 0), 0);

  // ── Fetch Xero data ────────────────────────────────────────────────────────
  let financials: { incomeRows: { name: string; amount: number }[]; expenseRows: { name: string; amount: number }[]; totalRevenue: number; totalExpenses: number } | null = null;
  let supplierSpend: { name: string; contactId: string; total: number }[] = [];
  let xeroTotalRevenue = 0, xeroTotalExpenses = 0;

  const [xeroInt] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "xero"), eq(cafeIntegrationsTable.status, "connected")));
  if (xeroInt) {
    try {
      const accessToken = await getValidXeroToken(xeroInt, cafeId);
      const tenantId = xeroInt.metadata && typeof xeroInt.metadata === "object" ? (xeroInt.metadata as any).tenant_id : null;
      if (accessToken && tenantId) {
        [financials, supplierSpend] = await Promise.all([
          getXeroFinancials(accessToken, tenantId, periodMonths).catch(() => null),
          getXeroSupplierSpend(accessToken, tenantId, periodMonths).catch(() => []),
        ]) as any;
        if (financials) { xeroTotalRevenue = financials.totalRevenue; xeroTotalExpenses = financials.totalExpenses; }
      }
    } catch (err) { logger.warn({ cafeId, err }, "Xero data fetch failed during snapshot"); }
  }

  // ── Which units are included in the sale bundle ────────────────────────────
  const includedUnitIds = new Set(units.filter(u => u.isIncludedInSale !== false).map(u => u.id));

  // ── Shared account→owner lookup ────────────────────────────────────────────
  // Unit rows are only stored when claimed (isIncluded=true always).
  // Build: accountName → ownerUnitId (or null for parent/unassigned)
  const accountOwner: Record<string, string | null> = {};
  for (const m of plMappingRows) {
    if (m.accountName) {
      if (m.unitId || accountOwner[m.accountName] === undefined) {
        accountOwner[m.accountName] = m.unitId ?? null;
      }
    }
  }

  // ── Parent-level P&L maps (accounts with unit_id IS NULL) ──────────────────
  const parentIncomeMap: Record<string, boolean> = {};
  const parentExpenseMap: Record<string, boolean> = {};
  for (const m of plMappingRows) {
    if (!m.accountName || m.unitId) continue;
    const isIncomeSection = (m.section ?? "").toLowerCase().match(/income|revenue|trading|sales/);
    if (isIncomeSection) parentIncomeMap[m.accountName] = m.isIncluded ?? true;
    else parentExpenseMap[m.accountName] = m.isIncluded ?? true;
  }

  const parentCogsMap: Record<string, boolean> = {};
  for (const m of supplierMappingRows) {
    if (m.contactName && !m.unitId) parentCogsMap[m.contactName] = m.isCogs ?? false;
  }

  // ── Combined totals — only accounts belonging to included units (or parent) ─
  // Income: unit-owned rows included only if unit is in the sale bundle
  const allXeroRevenue = financials
    ? financials.incomeRows.filter(r => {
        const owner = accountOwner[r.name];
        if (owner === undefined) return false;
        if (owner !== null) return includedUnitIds.has(owner); // unit-owned = only if included in sale
        return parentIncomeMap[r.name] === true; // parent row uses isIncluded toggle
      }).reduce((s, r) => s + r.amount, 0)
    : 0;
  // Combined COGS: a supplier is included if ANY of its mapping rows marks it
  // as COGS for an included unit (or parent). Using some() avoids the find()
  // first-match bug while still counting each supplier's spend only once.
  const allCOGS = supplierSpend.filter(s =>
    supplierMappingRows.some(r =>
      r.contactName === s.name &&
      r.isCogs === true &&
      (r.unitId === null || includedUnitIds.has(r.unitId))
    )
  ).reduce((s, r) => s + r.total, 0);
  // Square is reconciled into Xero — do NOT add squareRevenue on top.
  // squareRevenue is stored in the snapshot purely as a verification figure.
  const totalRevenue = allXeroRevenue;
  const grossProfit = computeGrossProfit(totalRevenue, allCOGS, allCOGS > 0);
  const ebitda = computeEbitda(totalRevenue, xeroTotalExpenses, xeroTotalRevenue, !!xeroInt);

  // ── Parent-level equipment and add-backs (not assigned to any unit) ─────────
  const parentEquipmentValue = equipmentRows.filter(e => !e.isLeased && !e.unitId).reduce((s, e) => s + Number(e.secondhandValue ?? e.currentValue ?? 0), 0);
  // Combined equipment = parent + all included units (for display in the combined snapshot)
  const combinedEquipmentValue = equipmentRows
    .filter(e => !e.isLeased && (e.unitId === null || includedUnitIds.has(e.unitId!)))
    .reduce((s, e) => s + Number(e.secondhandValue ?? e.currentValue ?? 0), 0);
  const parentAdjustments = adjustmentRows.filter(a => !a.unitId);
  const parentAdjEbitda = computeAdjustedEbitda(ebitda, parentAdjustments.map(a => ({ annualAmount: a.annualAmount ?? 0 })), periodMonths);

  // ── Per-unit independent snapshots ─────────────────────────────────────────
  const unitSnapshots: { unit: typeof units[0]; snapshot: any }[] = [];

  for (const unit of units) {
    // Build unit's account map — only rows owned by this unit
    const unitAccountMap: Record<string, boolean> = {};
    for (const m of plMappingRows) {
      if (m.accountName && m.unitId === unit.id) unitAccountMap[m.accountName] = true;
    }

    // Unit revenue: income rows claimed by this unit
    const unitRevenue = financials
      ? financials.incomeRows.filter(r => unitAccountMap[r.name]).reduce((s, r) => s + r.amount, 0)
      : 0;

    // Unit operating expenses: expense rows claimed by this unit
    const unitOperatingExpenses = financials
      ? financials.expenseRows.filter(r => unitAccountMap[r.name]).reduce((s, r) => s + r.amount, 0)
      : 0;

    // Unit COGS from supplier mappings owned by this unit
    const unitCogsMap: Record<string, boolean> = {};
    for (const m of supplierMappingRows) {
      if (m.contactName && m.unitId === unit.id) unitCogsMap[m.contactName] = m.isCogs ?? false;
    }
    const unitCOGS = supplierSpend.filter(s => unitCogsMap[s.name] === true).reduce((s, r) => s + r.total, 0);
    const hasUnitCOGS = Object.values(unitCogsMap).some(v => v);

    // Unit equipment and add-backs
    const unitEquipValue = equipmentRows.filter(e => !e.isLeased && e.unitId === unit.id)
      .reduce((s, e) => s + Number(e.secondhandValue ?? e.currentValue ?? 0), 0);
    const unitAdj = adjustmentRows.filter(a => a.unitId === unit.id);

    // Independent unit P&L
    // Gross profit accounts for supplier COGS
    const unitGrossProfit = hasUnitCOGS ? Math.max(unitRevenue - unitCOGS, 0) : unitRevenue;
    // EBITDA further deducts directly-mapped Xero operating expenses
    const unitEBITDA = unitGrossProfit - unitOperatingExpenses;
    const unitAdjEBITDA = computeAdjustedEbitda(unitEBITDA, unitAdj.map(a => ({ annualAmount: a.annualAmount ?? 0 })), periodMonths);
    const unitValuationMidpoint = computeValuationMidpoint(unitAdjEBITDA, unitEquipValue);

    await db.delete(valuationSnapshotsTable).where(and(eq(valuationSnapshotsTable.cafeId, cafeId), eq(valuationSnapshotsTable.unitId, unit.id)));
    const [unitSnap] = await db.insert(valuationSnapshotsTable).values({
      cafeId, ownerId, unitId: unit.id,
      snapshotDate: new Date().toISOString().slice(0, 10), periodMonths,
      grossRevenue: String(Math.round(unitRevenue * 100) / 100),
      cogs: String(Math.round(unitCOGS * 100) / 100),
      grossProfit: String(Math.round(unitGrossProfit * 100) / 100),
      xeroTotalExpenses: String(Math.round(unitOperatingExpenses * 100) / 100),
      xeroTotalRevenue: String(Math.round(xeroTotalRevenue * 100) / 100),
      ebitda: String(Math.round(unitEBITDA * 100) / 100),
      adjustedEbitda: String(Math.round(unitAdjEBITDA * 100) / 100),
      valuationMidpoint: String(Math.round(unitValuationMidpoint)),
      totalEquipmentValue: String(Math.round(unitEquipValue * 100) / 100),
      squareRevenue: String(0),
      xeroRevenue: String(Math.round(unitRevenue * 100) / 100),
    }).returning();
    unitSnapshots.push({ unit, snapshot: unitSnap });
  }

  // ── Combined snapshot ──────────────────────────────────────────────────────
  let combinedValuation: number;
  if (units.length > 0) {
    // Sum only included unit valuations + parent-level items
    const sumUnitValuations = unitSnapshots
      .filter(({ unit }) => includedUnitIds.has(unit.id))
      .reduce((s, { snapshot }) => s + Number(snapshot.valuationMidpoint ?? 0), 0);
    const parentAddbacksAnnualized = parentAdjustments.reduce((s, a) => s + Number(a.annualAmount ?? 0), 0);
    const parentAddbacksPeriod = (parentAddbacksAnnualized / 12) * periodMonths;
    combinedValuation = sumUnitValuations + computeValuationMidpoint(parentAddbacksPeriod, parentEquipmentValue);
  } else {
    combinedValuation = computeValuationMidpoint(parentAdjEbitda, parentEquipmentValue);
  }

  await db.delete(valuationSnapshotsTable).where(and(eq(valuationSnapshotsTable.cafeId, cafeId), isNull(valuationSnapshotsTable.unitId)));
  const [combined] = await db.insert(valuationSnapshotsTable).values({
    cafeId, ownerId, unitId: null,
    snapshotDate: new Date().toISOString().slice(0, 10), periodMonths,
    grossRevenue: String(Math.round(totalRevenue * 100) / 100),
    cogs: String(Math.round(allCOGS * 100) / 100),
    grossProfit: String(Math.round(grossProfit * 100) / 100),
    xeroTotalExpenses: String(Math.round(xeroTotalExpenses * 100) / 100),
    xeroTotalRevenue: String(Math.round(xeroTotalRevenue * 100) / 100),
    ebitda: String(Math.round(ebitda * 100) / 100),
    adjustedEbitda: String(Math.round(parentAdjEbitda * 100) / 100),
    valuationMidpoint: String(Math.round(combinedValuation)),
    totalEquipmentValue: String(Math.round(combinedEquipmentValue * 100) / 100),
    squareRevenue: String(Math.round(squareRevenue * 100) / 100),
    xeroRevenue: String(Math.round(allXeroRevenue * 100) / 100),
  }).returning();

  return { snapshot: combined, units: unitSnapshots };
}

router.get("/cafes/:cafeId/cogs-breakdown", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  const periodMonths = Number((req.query as any).months ?? 12);

  try {
    await assertCafeOwner(cafeId, userId);
  } catch (e: any) {
    return res.status(e.status ?? 403).json({ error: e.message });
  }

  const [supplierMappingRows, units] = await Promise.all([
    db.select().from(xeroSupplierMappingsTable).where(eq(xeroSupplierMappingsTable.cafeId, cafeId)),
    db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId)),
  ]);

  const includedUnitIds = new Set(units.filter(u => u.isIncludedInSale !== false).map(u => u.id));
  const unitNameMap: Record<string, string> = {};
  for (const u of units) unitNameMap[u.id] = u.name;

  const [xeroInt] = await db.select().from(cafeIntegrationsTable).where(
    and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "xero"), eq(cafeIntegrationsTable.status, "connected"))
  );

  let supplierSpend: { name: string; contactId: string; total: number }[] = [];
  if (xeroInt) {
    try {
      const accessToken = await getValidXeroToken(xeroInt, cafeId);
      const tenantId = xeroInt.metadata && typeof xeroInt.metadata === "object" ? (xeroInt.metadata as any).tenant_id : null;
      if (accessToken && tenantId) {
        supplierSpend = await getXeroSupplierSpend(accessToken, tenantId, periodMonths).catch(() => []);
      }
    } catch {}
  }

  const result: { supplierName: string; total: number; unitId: string | null; unitName: string | null }[] = [];
  for (const s of supplierSpend) {
    // Use some() (not find) to avoid first-match ordering bugs — same pattern as snapshot COGS logic
    const isCogs = supplierMappingRows.some(r =>
      r.contactName === s.name &&
      r.isCogs === true &&
      (r.unitId === null || includedUnitIds.has(r.unitId))
    );
    if (!isCogs) continue;
    // For unit attribution: prefer the most specific unit-owned COGS row, fall back to parent
    const unitRow = supplierMappingRows.find(r =>
      r.contactName === s.name && r.isCogs === true && r.unitId !== null && includedUnitIds.has(r.unitId)
    );
    const attributedUnitId = unitRow?.unitId ?? null;
    result.push({
      supplierName: s.name,
      total: s.total,
      unitId: attributedUnitId,
      unitName: attributedUnitId ? (unitNameMap[attributedUnitId] ?? null) : null,
    });
  }

  result.sort((a, b) => b.total - a.total);
  return res.json(result);
});

/**
 * GET /valuation/square/categories?cafeId=...
 * Returns distinct Square item categories from the category cache for this cafe,
 * with their total gross revenue over the last 12 months (for display only).
 * Used by the Custom Financial Reports editor to let sellers pick specific categories.
 */
router.get("/square/categories", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.query as Record<string, string>;
  if (!cafeId) return res.status(400).json({ error: "cafeId required" });

  try { await assertCafeOwner(cafeId, userId); }
  catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }

  // Aggregate per-category totals from the cache (last 12 months)
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 12);
  const fromStr = fromDate.toISOString().slice(0, 10);

  const rows = await db
    .select({
      categoryName: squareCategoryCacheTable.categoryName,
      total: sql<string>`sum(${squareCategoryCacheTable.grossAmount})`,
    })
    .from(squareCategoryCacheTable)
    .where(
      and(
        eq(squareCategoryCacheTable.cafeId, cafeId),
        sql`${squareCategoryCacheTable.orderDate} >= ${fromStr}`,
      )
    )
    .groupBy(squareCategoryCacheTable.categoryName)
    .orderBy(desc(sql`sum(${squareCategoryCacheTable.grossAmount})`));

  const categories = rows.map((r) => ({
    name: r.categoryName,
    total: Math.round(Number(r.total ?? 0) * 100) / 100,
  }));

  return res.json({ categories, hasCategoryData: categories.length > 0 });
});

export { calculateAndSaveSnapshot };
export default router;
