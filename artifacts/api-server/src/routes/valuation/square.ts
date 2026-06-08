import { Router, type IRouter } from "express";
import { eq, and, gte, isNull } from "drizzle-orm";
import { db, cafeIntegrationsTable, squareOrdersCacheTable, valuationSnapshotsTable, ownerAdjustmentsTable, cafeEquipmentTable, xeroPLMappingsTable, xeroSupplierMappingsTable, businessUnitsTable } from "@workspace/db";
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

async function syncSquareOrders(cafeId: string, ownerId: string, accessToken: string, fromDate: Date, toDate: Date) {
  // Fetch all active location IDs for this merchant — required by Square Orders Search
  let locationIds: string[] = [];
  try {
    const locRes = await fetch("https://connect.squareup.com/v2/locations", { headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": "2024-01-17" } });
    if (locRes.ok) {
      const locData = await locRes.json() as any;
      locationIds = (locData.locations ?? []).filter((l: any) => l.status === "ACTIVE").map((l: any) => l.id as string);
    }
  } catch {}
  if (locationIds.length === 0) { logger.warn({ cafeId }, "Square: no active locations found, skipping sync"); return; }
  let cursor: string | undefined;
  const dailyTotals: Record<string, { gross: number; net: number; count: number }> = {};
  do {
    const body: any = { location_ids: locationIds, query: { filter: { date_time_filter: { created_at: { start_at: fromDate.toISOString(), end_at: toDate.toISOString() } }, state_filter: { states: ["COMPLETED"] } } }, limit: 500 };
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
    }
  } while (cursor);
  for (const [date, totals] of Object.entries(dailyTotals)) {
    await db.insert(squareOrdersCacheTable).values({ cafeId, ownerId, orderDate: date, grossAmount: String(Math.round(totals.gross * 100) / 100), netAmount: String(Math.round(totals.net * 100) / 100), orderCount: totals.count })
      .onConflictDoUpdate({ target: [squareOrdersCacheTable.cafeId, squareOrdersCacheTable.orderDate], set: { grossAmount: String(Math.round(totals.gross * 100) / 100), netAmount: String(Math.round(totals.net * 100) / 100), orderCount: totals.count } });
  }
}

async function calculateAndSaveSnapshot(cafeId: string, ownerId: string, periodMonths: number) {
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - periodMonths);
  const fromStr = fromDate.toISOString().slice(0, 10);

  // Fetch all base data in parallel
  const [squareCacheRows, adjustmentRows, equipmentRows, plMappingRows, supplierMappingRows, units] = await Promise.all([
    db.select().from(squareOrdersCacheTable).where(and(eq(squareOrdersCacheTable.cafeId, cafeId), gte(squareOrdersCacheTable.orderDate, fromStr))),
    db.select().from(ownerAdjustmentsTable).where(eq(ownerAdjustmentsTable.cafeId, cafeId)),
    db.select().from(cafeEquipmentTable).where(and(eq(cafeEquipmentTable.cafeId, cafeId), eq(cafeEquipmentTable.suspended, false))),
    db.select().from(xeroPLMappingsTable).where(eq(xeroPLMappingsTable.cafeId, cafeId)),
    db.select().from(xeroSupplierMappingsTable).where(eq(xeroSupplierMappingsTable.cafeId, cafeId)),
    db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId)),
  ]);

  const squareRevenue = squareCacheRows.reduce((s, r) => s + Number(r.grossAmount ?? 0), 0);

  // Fetch Xero data
  let financials: { incomeRows: { name: string; amount: number }[]; totalRevenue: number; totalExpenses: number } | null = null;
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

  // ── Parent-level maps (accounts with unit_id IS NULL) ──────────────────
  const parentIncomeMap: Record<string, boolean> = {};
  for (const m of plMappingRows) {
    if (m.accountName && !m.unitId) parentIncomeMap[m.accountName] = m.isIncluded ?? true;
  }
  const parentCogsMap: Record<string, boolean> = {};
  for (const m of supplierMappingRows) {
    if (m.contactName && !m.unitId) parentCogsMap[m.contactName] = m.isCogs ?? false;
  }

  // Parent Xero income (accounts not assigned to any unit)
  const parentXeroRevenue = financials
    ? financials.incomeRows.filter(r => parentIncomeMap[r.name] === true).reduce((s, r) => s + r.amount, 0)
    : 0;
  const parentCOGS = supplierSpend.filter(s => parentCogsMap[s.name] === true).reduce((s, r) => s + r.total, 0);

  // ── Combined totals (all included accounts regardless of unit assignment) ─
  const allIncomeMap: Record<string, boolean> = {};
  for (const m of plMappingRows) {
    if (m.accountName && (m.isIncluded ?? true)) allIncomeMap[m.accountName] = true;
  }
  const allXeroRevenue = financials
    ? financials.incomeRows.filter(r => allIncomeMap[r.name]).reduce((s, r) => s + r.amount, 0)
    : 0;
  const allCogsMap: Record<string, boolean> = {};
  for (const m of supplierMappingRows) {
    if (m.contactName && (m.isCogs ?? false)) allCogsMap[m.contactName] = true;
  }
  const allCOGS = supplierSpend.filter(s => allCogsMap[s.name]).reduce((s, r) => s + r.total, 0);
  const totalRevenue = squareRevenue + allXeroRevenue;
  const grossProfit = computeGrossProfit(totalRevenue, allCOGS, allCOGS > 0);
  const ebitda = computeEbitda(totalRevenue, xeroTotalExpenses, xeroTotalRevenue, !!xeroInt);

  // Parent-level equipment and add-backs (not assigned to any unit)
  const parentEquipmentValue = equipmentRows.filter(e => !e.isLeased && !e.unitId).reduce((s, e) => s + Number(e.currentValue ?? e.purchasePrice ?? 0), 0);
  const parentAdjustments = adjustmentRows.filter(a => !a.unitId);
  const parentAdjEbitda = computeAdjustedEbitda(ebitda, parentAdjustments.map(a => ({ annualAmount: a.annualAmount ?? 0 })), periodMonths);

  // ── Per-unit independent snapshots ──────────────────────────────────────
  const unitSnapshots: any[] = [];

  for (const unit of units) {
    // Income accounts claimed by this unit
    const unitIncomeMap: Record<string, boolean> = {};
    for (const m of plMappingRows) {
      if (m.accountName && m.unitId === unit.id) unitIncomeMap[m.accountName] = m.isIncluded ?? true;
    }
    const unitRevenue = financials
      ? financials.incomeRows.filter(r => unitIncomeMap[r.name] === true).reduce((s, r) => s + r.amount, 0)
      : 0;

    // COGS suppliers assigned to this unit
    const unitCogsMap: Record<string, boolean> = {};
    for (const m of supplierMappingRows) {
      if (m.contactName && m.unitId === unit.id) unitCogsMap[m.contactName] = m.isCogs ?? false;
    }
    const unitCOGS = supplierSpend.filter(s => unitCogsMap[s.name] === true).reduce((s, r) => s + r.total, 0);
    const hasUnitCOGS = Object.values(unitCogsMap).some(v => v);

    // Equipment and add-backs for this unit
    const unitEquipValue = equipmentRows.filter(e => !e.isLeased && e.unitId === unit.id)
      .reduce((s, e) => s + Number(e.currentValue ?? e.purchasePrice ?? 0), 0);
    const unitAdj = adjustmentRows.filter(a => a.unitId === unit.id);

    // Independent P&L calculation
    const unitGrossProfit = hasUnitCOGS ? Math.max(unitRevenue - unitCOGS, 0) : unitRevenue;
    const unitAdjEBITDA = computeAdjustedEbitda(unitGrossProfit, unitAdj.map(a => ({ annualAmount: a.annualAmount ?? 0 })), periodMonths);
    const unitValuationMidpoint = Math.max(unitAdjEBITDA, 0) * 2.5 + unitEquipValue;

    await db.delete(valuationSnapshotsTable).where(and(eq(valuationSnapshotsTable.cafeId, cafeId), eq(valuationSnapshotsTable.unitId, unit.id)));
    const [unitSnap] = await db.insert(valuationSnapshotsTable).values({
      cafeId, ownerId, unitId: unit.id,
      snapshotDate: new Date().toISOString().slice(0, 10), periodMonths,
      grossRevenue: String(Math.round(unitRevenue * 100) / 100),
      cogs: String(Math.round(unitCOGS * 100) / 100),
      grossProfit: String(Math.round(unitGrossProfit * 100) / 100),
      xeroTotalExpenses: String(0),
      xeroTotalRevenue: String(Math.round(xeroTotalRevenue * 100) / 100),
      ebitda: String(Math.round(unitGrossProfit * 100) / 100),
      adjustedEbitda: String(Math.round(unitAdjEBITDA * 100) / 100),
      valuationMidpoint: String(Math.round(unitValuationMidpoint)),
      totalEquipmentValue: String(Math.round(unitEquipValue * 100) / 100),
      squareRevenue: String(0),
      xeroRevenue: String(Math.round(unitRevenue * 100) / 100),
    }).returning();
    unitSnapshots.push({ unit, snapshot: unitSnap });
  }

  // ── Combined snapshot ──────────────────────────────────────────────────
  let combinedAdjEbitda: number;
  let combinedEquipValue: number;
  let combinedValuation: number;

  if (units.length > 0) {
    // Sum of independent unit valuations + parent-level equipment/add-backs
    const sumUnitValuations = unitSnapshots.reduce((s, { snapshot: snap }) => s + Number(snap.valuationMidpoint ?? 0), 0);
    const parentAddbacksAnnualized = parentAdjustments.reduce((s, a) => s + Number(a.annualAmount ?? 0), 0);
    const parentAddbacksPeriod = (parentAddbacksAnnualized / 12) * periodMonths;
    combinedValuation = sumUnitValuations + Math.max(parentAddbacksPeriod, 0) * 2.5 + parentEquipmentValue;
    combinedAdjEbitda = parentAdjEbitda;
    combinedEquipValue = parentEquipmentValue;
  } else {
    combinedAdjEbitda = parentAdjEbitda;
    combinedEquipValue = parentEquipmentValue;
    combinedValuation = computeValuationMidpoint(combinedAdjEbitda, combinedEquipValue);
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
    adjustedEbitda: String(Math.round(combinedAdjEbitda * 100) / 100),
    valuationMidpoint: String(Math.round(combinedValuation)),
    totalEquipmentValue: String(Math.round(combinedEquipValue * 100) / 100),
    squareRevenue: String(Math.round(squareRevenue * 100) / 100),
    xeroRevenue: String(Math.round(allXeroRevenue * 100) / 100),
  }).returning();

  return { snapshot: combined, units: unitSnapshots };
}

export default router;
