import { Router, type IRouter } from "express";
import { eq, and, gte, isNull } from "drizzle-orm";
import { db, cafeIntegrationsTable, squareOrdersCacheTable, valuationSnapshotsTable, ownerAdjustmentsTable, cafeEquipmentTable, xeroPLMappingsTable, xeroSupplierMappingsTable, businessUnitsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { assertCafeOwner } from "./cafes";
import { computeGrossRevenue, computeGrossProfit, computeEbitda, computeAdjustedEbitda, computeValuationMidpoint, computeUnitValuation } from "../../lib/valuation";
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
  const squareCacheRows = await db.select().from(squareOrdersCacheTable).where(and(eq(squareOrdersCacheTable.cafeId, cafeId), gte(squareOrdersCacheTable.orderDate, fromStr)));
  const squareRevenue = squareCacheRows.reduce((s, r) => s + Number(r.grossAmount ?? 0), 0);
  const [adjustmentRows, equipmentRows, plMappingRows, supplierMappingRows, units] = await Promise.all([
    db.select().from(ownerAdjustmentsTable).where(eq(ownerAdjustmentsTable.cafeId, cafeId)),
    db.select().from(cafeEquipmentTable).where(and(eq(cafeEquipmentTable.cafeId, cafeId), eq(cafeEquipmentTable.suspended, false))),
    db.select().from(xeroPLMappingsTable).where(eq(xeroPLMappingsTable.cafeId, cafeId)),
    db.select().from(xeroSupplierMappingsTable).where(eq(xeroSupplierMappingsTable.cafeId, cafeId)),
    db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId)),
  ]);
  const incomeMap: Record<string, boolean> = {};
  for (const m of plMappingRows) { if (m.accountName) incomeMap[m.accountName] = m.isIncluded ?? true; }
  const cogsMap: Record<string, boolean> = {};
  for (const m of supplierMappingRows) { if (m.contactName && !m.unitId) cogsMap[m.contactName] = m.isCogs ?? false; }
  let xeroAdditionalRevenue = 0, cogsSuppliersTotal = 0, xeroTotalRevenue = 0, xeroTotalExpenses = 0;
  let supplierSpend: any[] = [];
  const [xeroInt] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "xero"), eq(cafeIntegrationsTable.status, "connected")));
  if (xeroInt) {
    try {
      const accessToken = await getValidXeroToken(xeroInt, cafeId);
      const tenantId = xeroInt.metadata && typeof xeroInt.metadata === "object" ? (xeroInt.metadata as any).tenant_id : null;
      if (accessToken && tenantId) {
        const [financials, spend] = await Promise.all([getXeroFinancials(accessToken, tenantId, periodMonths).catch(() => null), getXeroSupplierSpend(accessToken, tenantId, periodMonths).catch(() => [])]);
        supplierSpend = spend as any[];
        if (financials) { xeroTotalRevenue = financials.totalRevenue; xeroTotalExpenses = financials.totalExpenses; xeroAdditionalRevenue = financials.incomeRows.filter((r) => incomeMap[r.name] === true).reduce((s, r) => s + r.amount, 0); }
        cogsSuppliersTotal = supplierSpend.filter((s: any) => cogsMap[s.name] === true).reduce((s: number, r: any) => s + r.total, 0);
      }
    } catch (err) { logger.warn({ cafeId, err }, "Xero data fetch failed during snapshot"); }
  }
  const totalRevenue = computeGrossRevenue(squareRevenue, xeroAdditionalRevenue);
  const grossProfit = computeGrossProfit(totalRevenue, cogsSuppliersTotal, cogsSuppliersTotal > 0);
  const ebitda = computeEbitda(totalRevenue, xeroTotalExpenses, xeroTotalRevenue, !!xeroInt);

  // Parent-level (unassigned) equipment and add-backs
  const parentEquipmentValue = equipmentRows.filter((e) => !e.isLeased && !e.unitId).reduce((s, e) => s + Number(e.currentValue ?? e.purchasePrice ?? 0), 0);
  const parentAdjustments = adjustmentRows.filter((a) => !a.unitId);
  const parentAdjEbitda = computeAdjustedEbitda(ebitda, parentAdjustments.map((a) => ({ annualAmount: a.annualAmount ?? 0 })), periodMonths);

  // Compute all unit snapshots first so we can sum them for the combined valuation
  const unitSnapshots: any[] = [];
  for (const unit of units) {
    const unitRevSharePct = Number(unit.revenueSharePct ?? 0);
    const unitCogsMap: Record<string, boolean> = {};
    for (const m of supplierMappingRows) { if (m.contactName && m.unitId === unit.id) unitCogsMap[m.contactName] = m.isCogs ?? false; }
    const unitCOGS = supplierSpend.filter((s: any) => unitCogsMap[s.name] === true).reduce((s: number, r: any) => s + r.total, 0);
    const unitAdj = adjustmentRows.filter((a) => a.unitId === unit.id);
    const unitEquip = equipmentRows.filter((e) => !e.isLeased && e.unitId === unit.id).reduce((s, e) => s + Number(e.currentValue ?? e.purchasePrice ?? 0), 0);
    const calc = computeUnitValuation(unit, totalRevenue, xeroTotalExpenses, periodMonths, unitCOGS, unitCOGS > 0, unitAdj.map((a) => ({ annualAmount: a.annualAmount ?? 0 })), unitEquip);
    await db.delete(valuationSnapshotsTable).where(and(eq(valuationSnapshotsTable.cafeId, cafeId), eq(valuationSnapshotsTable.unitId, unit.id)));
    const [unitSnap] = await db.insert(valuationSnapshotsTable).values({
      cafeId, ownerId, unitId: unit.id, snapshotDate: new Date().toISOString().slice(0, 10), periodMonths,
      grossRevenue: String(Math.round(calc.unitRevenue * 100) / 100),
      cogs: String(Math.round(calc.unitCOGS * 100) / 100),
      grossProfit: String(Math.round(calc.unitGrossProfit * 100) / 100),
      xeroTotalExpenses: String(Math.round(xeroTotalExpenses * (unitRevSharePct / 100) * 100) / 100),
      xeroTotalRevenue: String(Math.round(xeroTotalRevenue * 100) / 100),
      ebitda: String(Math.round(calc.unitEBITDA * 100) / 100),
      adjustedEbitda: String(Math.round(calc.unitAdjEBITDA * 100) / 100),
      valuationMidpoint: String(Math.round(calc.unitValuation)),
      totalEquipmentValue: String(Math.round(calc.unitEquipmentValue * 100) / 100),
      squareRevenue: String(Math.round(squareRevenue * (unitRevSharePct / 100) * 100) / 100),
      xeroRevenue: String(Math.round(xeroAdditionalRevenue * (unitRevSharePct / 100) * 100) / 100),
    }).returning();
    unitSnapshots.push({ unit, snapshot: unitSnap });
  }

  // Combined valuation:
  // - In split mode: sum of all unit valuations + parent-level equipment/add-backs
  // - In non-split mode: standard whole-business calculation
  let adjustedEbitda: number;
  let totalEquipmentValue: number;
  let valuationMidpoint: number;
  if (units.length > 0) {
    const sumUnitValuations = unitSnapshots.reduce((s, { snapshot: snap }) => s + Number(snap.valuationMidpoint ?? 0), 0);
    // In split mode: combined = sum(unit valuations) + parent-only add-backs + parent equipment.
    // Do NOT include whole-business EBITDA again (that's already split across units).
    // Parent contribution = parentEquipmentValue + parent add-backs annualized to period.
    const parentAddbacksAnnualized = parentAdjustments.reduce((s, a) => s + Number(a.annualAmount ?? 0), 0);
    const parentAddbacksPeriod = (parentAddbacksAnnualized / 12) * periodMonths;
    valuationMidpoint = sumUnitValuations + Math.max(parentAddbacksPeriod, 0) * 2.5 + parentEquipmentValue;
    adjustedEbitda = parentAdjEbitda;
    totalEquipmentValue = parentEquipmentValue;
  } else {
    adjustedEbitda = parentAdjEbitda;
    totalEquipmentValue = parentEquipmentValue;
    valuationMidpoint = computeValuationMidpoint(adjustedEbitda, totalEquipmentValue);
  }

  await db.delete(valuationSnapshotsTable).where(and(eq(valuationSnapshotsTable.cafeId, cafeId), isNull(valuationSnapshotsTable.unitId)));
  const [combined] = await db.insert(valuationSnapshotsTable).values({
    cafeId, ownerId, unitId: null, snapshotDate: new Date().toISOString().slice(0, 10), periodMonths,
    grossRevenue: String(Math.round(totalRevenue * 100) / 100),
    cogs: String(Math.round(cogsSuppliersTotal * 100) / 100),
    grossProfit: String(Math.round(grossProfit * 100) / 100),
    xeroTotalExpenses: String(Math.round(xeroTotalExpenses * 100) / 100),
    xeroTotalRevenue: String(Math.round(xeroTotalRevenue * 100) / 100),
    ebitda: String(Math.round(ebitda * 100) / 100),
    adjustedEbitda: String(Math.round(adjustedEbitda * 100) / 100),
    valuationMidpoint: String(Math.round(valuationMidpoint)),
    totalEquipmentValue: String(Math.round(totalEquipmentValue * 100) / 100),
    squareRevenue: String(Math.round(squareRevenue * 100) / 100),
    xeroRevenue: String(Math.round(xeroAdditionalRevenue * 100) / 100),
  }).returning();

  return { snapshot: combined, units: unitSnapshots };
}

export default router;
