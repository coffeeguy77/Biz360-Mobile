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
  const selectedLocationIds = (squareInt.metadata && typeof squareInt.metadata === "object")
    ? ((squareInt.metadata as any).selectedLocationIds as string[] | undefined) ?? null
    : null;
  let syncError: string | null = null;
  if (forceSync || process.env.SQUARE_APP_ID) {
    const accessToken = await getValidSquareToken(squareInt);
    if (!accessToken) syncError = "Square token unavailable — please reconnect Square.";
    else {
      try { await syncSquareOrders(cafeId, userId, accessToken, fromDate, toDate, selectedLocationIds); }
      catch (e: any) { syncError = e?.message || "Square sync failed"; logger.warn({ err: e?.message, cafeId }, "Square sync failure"); }
    }
  }
  const result = await calculateAndSaveSnapshot(cafeId, userId, periodMonths);
  return res.json({ ...result, syncError });
});

/**
 * Convert a UTC ISO timestamp to the calendar date (YYYY-MM-DD) in a given IANA
 * timezone. Square returns created_at in UTC; an Australian café's early-morning
 * trade otherwise lands on the previous UTC day, smearing takings across days and
 * putting phantom sales on closed days. Bucketing by *local* date fixes that.
 */
function localDateInTz(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

type SquareLoc = { id: string; name: string; timezone: string; status: string; currency: string | null };

/** Fetch Square locations; surfaces the HTTP status so callers can detect an
 *  expired/invalid token (401) vs. a genuine empty account. */
async function fetchSquareLocations(accessToken: string): Promise<{ ok: boolean; status: number; locations: SquareLoc[] }> {
  try {
    const r = await fetch("https://connect.squareup.com/v2/locations", { headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": "2024-01-17" } });
    if (!r.ok) return { ok: false, status: r.status, locations: [] };
    const data = await r.json() as any;
    const locations = (data.locations ?? []).map((l: any) => ({
      id: l.id as string,
      name: (l.name as string) ?? "Location",
      timezone: (l.timezone as string) ?? "Australia/Sydney",
      status: (l.status as string) ?? "ACTIVE",
      currency: l.currency ?? null,
    }));
    return { ok: true, status: 200, locations };
  } catch { return { ok: false, status: 0, locations: [] }; }
}

/**
 * Return a valid Square access token, refreshing via the stored refresh_token
 * when the current one is expired or near expiry. Square access tokens live ~30
 * days; without this, every live call fails once the token lapses (no locations,
 * no fresh orders) and the UI silently shows stale cache. Mirrors getValidXeroToken.
 */
async function getValidSquareToken(sqInt: { id: string; accessToken: string | null; refreshToken: string | null; tokenExpiresAt: Date | null }): Promise<string | null> {
  const appId = process.env.SQUARE_APP_ID, appSecret = process.env.SQUARE_APP_SECRET;
  const expMs = sqInt.tokenExpiresAt ? new Date(sqInt.tokenExpiresAt).getTime() : 0;
  const stillValid = !!sqInt.accessToken && expMs > 0 && expMs - Date.now() > 2 * 86400000; // >2 day buffer
  if (stillValid) return sqInt.accessToken;
  if (!appId || !appSecret || !sqInt.refreshToken) return sqInt.accessToken ?? null; // can't refresh — best effort
  try {
    const r = await fetch("https://connect.squareup.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Square-Version": "2024-01-17" },
      body: JSON.stringify({ client_id: appId, client_secret: appSecret, grant_type: "refresh_token", refresh_token: sqInt.refreshToken }),
    });
    if (!r.ok) { logger.warn({ status: r.status }, "Square token refresh failed"); return sqInt.accessToken ?? null; }
    const d = await r.json() as any;
    if (!d.access_token) return sqInt.accessToken ?? null;
    await db.update(cafeIntegrationsTable).set({
      accessToken: d.access_token,
      refreshToken: d.refresh_token ?? sqInt.refreshToken,
      tokenExpiresAt: d.expires_at ? new Date(d.expires_at) : null,
    }).where(eq(cafeIntegrationsTable.id, sqInt.id));
    return d.access_token as string;
  } catch (e: any) { logger.warn({ err: e?.message }, "Square token refresh threw"); return sqInt.accessToken ?? null; }
}

/** GET /valuation/square/locations?cafeId=… — list Square locations + current selection. */
router.get("/square/locations", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.query as Record<string, string>;
  if (!cafeId) return res.status(400).json({ error: "cafeId required" });
  try { await assertCafeOwner(cafeId, userId); } catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }
  const [sqInt] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "square"), eq(cafeIntegrationsTable.status, "connected")));
  if (!sqInt) return res.json({ connected: false, locations: [], selectedLocationIds: null, merchantName: null });
  const token = await getValidSquareToken(sqInt);
  const { ok, status, locations } = await fetchSquareLocations(token ?? "");
  const selectedLocationIds = (sqInt.metadata && typeof sqInt.metadata === "object") ? ((sqInt.metadata as any).selectedLocationIds as string[] | undefined) ?? null : null;
  const needsReconnect = !ok && (status === 401 || status === 403);
  return res.json({ connected: true, merchantName: sqInt.merchantName ?? null, locations, selectedLocationIds, tokenValid: ok, needsReconnect, error: ok ? null : `Square returned ${status || "no response"}` });
});

/** POST /valuation/square/locations — save which locations (income streams) to include. */
router.post("/square/locations", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, selectedLocationIds } = req.body as { cafeId?: string; selectedLocationIds?: string[] | null };
  if (!cafeId) return res.status(400).json({ error: "cafeId required" });
  try { await assertCafeOwner(cafeId, userId); } catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }
  const [sqInt] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "square"), eq(cafeIntegrationsTable.status, "connected")));
  if (!sqInt) return res.status(404).json({ error: "Square not connected" });
  const meta = (sqInt.metadata && typeof sqInt.metadata === "object") ? { ...(sqInt.metadata as any) } : {};
  meta.selectedLocationIds = Array.isArray(selectedLocationIds) && selectedLocationIds.length > 0 ? selectedLocationIds : null;
  await db.update(cafeIntegrationsTable).set({ metadata: meta }).where(eq(cafeIntegrationsTable.id, sqInt.id));
  return res.json({ ok: true, selectedLocationIds: meta.selectedLocationIds });
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

async function syncSquareOrders(cafeId: string, ownerId: string, accessToken: string, fromDate: Date, toDate: Date, selectedLocationIds?: string[] | null) {
  const locRes = await fetchSquareLocations(accessToken);
  if (!locRes.ok) {
    if (locRes.status === 401 || locRes.status === 403) throw new Error("Square authorisation expired — please reconnect Square.");
    throw new Error(`Square locations unavailable (status ${locRes.status || "no response"}).`);
  }
  const allLocations = locRes.locations;
  // Timezone per location — used to bucket each order by the café's LOCAL date.
  const locationTz: Record<string, string> = {};
  for (const l of allLocations) locationTz[l.id] = l.timezone;
  const fallbackTz = allLocations[0]?.timezone ?? "Australia/Sydney";
  // Which locations to include: the seller's selection, else all ACTIVE locations.
  const activeIds = allLocations.filter((l) => l.status === "ACTIVE").map((l) => l.id);
  const selSet = Array.isArray(selectedLocationIds) && selectedLocationIds.length > 0 ? new Set(selectedLocationIds) : null;
  const locationIds = selSet ? activeIds.filter((id) => selSet.has(id)) : activeIds;
  if (locationIds.length === 0) { logger.warn({ cafeId }, "Square: no locations to sync (none active or none selected), skipping"); return; }

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
      const tz = locationTz[order.location_id as string] ?? fallbackTz;
      const date = localDateInTz(order.created_at as string, tz);
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

  // All orders fetched successfully — now atomically replace the café's cache so a
  // re-sync (new location selection or corrected local-date bucketing) fully wins
  // over stale rows rather than merging with them.
  await db.delete(squareOrdersCacheTable).where(eq(squareOrdersCacheTable.cafeId, cafeId));
  await db.delete(squareCategoryCacheTable).where(eq(squareCategoryCacheTable.cafeId, cafeId));

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

// ─── Square intelligence — trends, day-of-week, top items ────────────────────

function monthsAgoStr(n: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10);
}
function reqMonths(req: any): number {
  const n = Number(req.query?.months ?? 12);
  return [3, 6, 12, 24, 36].includes(n) ? n : 12;
}

/** Revenue trend (gross/net/orders per month) from the daily cache. */
router.get("/cafes/:cafeId/insights/monthly", async (req, res) => {
  const userId = req.user!.id; const { cafeId } = req.params;
  try { await assertCafeOwner(cafeId, userId); } catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }
  const from = monthsAgoStr(reqMonths(req));
  const rows = await db.select({
    month: sql<string>`to_char(${squareOrdersCacheTable.orderDate}, 'YYYY-MM')`,
    gross: sql<string>`coalesce(sum(${squareOrdersCacheTable.grossAmount}),0)`,
    net: sql<string>`coalesce(sum(${squareOrdersCacheTable.netAmount}),0)`,
    orders: sql<string>`coalesce(sum(${squareOrdersCacheTable.orderCount}),0)`,
  }).from(squareOrdersCacheTable)
    .where(and(eq(squareOrdersCacheTable.cafeId, cafeId), gte(squareOrdersCacheTable.orderDate, from)))
    .groupBy(sql`to_char(${squareOrdersCacheTable.orderDate}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${squareOrdersCacheTable.orderDate}, 'YYYY-MM')`);
  return res.json({ months: rows.map((r) => ({ month: r.month, gross: Number(r.gross) || 0, net: Number(r.net) || 0, orders: Number(r.orders) || 0 })) });
});

/** Average takings by day of the week (which days are strongest). */
router.get("/cafes/:cafeId/insights/day-of-week", async (req, res) => {
  const userId = req.user!.id; const { cafeId } = req.params;
  try { await assertCafeOwner(cafeId, userId); } catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }
  const from = monthsAgoStr(reqMonths(req));
  const rows = await db.select({
    dow: sql<string>`extract(dow from ${squareOrdersCacheTable.orderDate})`,
    total: sql<string>`coalesce(sum(${squareOrdersCacheTable.grossAmount}),0)`,
    days: sql<string>`count(*)`,
    orders: sql<string>`coalesce(sum(${squareOrdersCacheTable.orderCount}),0)`,
  }).from(squareOrdersCacheTable)
    .where(and(eq(squareOrdersCacheTable.cafeId, cafeId), gte(squareOrdersCacheTable.orderDate, from)))
    .groupBy(sql`extract(dow from ${squareOrdersCacheTable.orderDate})`);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const out = rows.map((r) => {
    const dow = Number(r.dow) || 0, days = Number(r.days) || 1, total = Number(r.total) || 0;
    return { dow, day: names[dow], avgGross: Math.round(total / days), totalGross: Math.round(total), totalOrders: Number(r.orders) || 0, tradingDays: days };
  }).sort((a, b) => b.avgGross - a.avgGross);
  return res.json({ days: out });
});

/** Connection + freshness meta for the insights UI. */
router.get("/cafes/:cafeId/insights/meta", async (req, res) => {
  const userId = req.user!.id; const { cafeId } = req.params;
  try { await assertCafeOwner(cafeId, userId); } catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }
  const [sqInt] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "square"), eq(cafeIntegrationsTable.status, "connected")));
  const [agg] = await db.select({
    lastDate: sql<string>`max(${squareOrdersCacheTable.orderDate})`,
    firstDate: sql<string>`min(${squareOrdersCacheTable.orderDate})`,
    days: sql<string>`count(*)`,
  }).from(squareOrdersCacheTable).where(eq(squareOrdersCacheTable.cafeId, cafeId));
  const [catAgg] = await db.select({ n: sql<string>`count(distinct ${squareCategoryCacheTable.categoryName})` })
    .from(squareCategoryCacheTable).where(eq(squareCategoryCacheTable.cafeId, cafeId));
  return res.json({
    squareConnected: !!sqInt,
    merchantName: sqInt?.merchantName ?? null,
    lastSyncedDate: agg?.lastDate ?? null,
    firstDate: agg?.firstDate ?? null,
    cachedDays: Number(agg?.days ?? 0),
    categoryCount: Number(catAgg?.n ?? 0),
  });
});

/** Top categories/items by revenue and popularity (best available "top dishes"). */
router.get("/cafes/:cafeId/insights/top-categories", async (req, res) => {
  const userId = req.user!.id; const { cafeId } = req.params;
  try { await assertCafeOwner(cafeId, userId); } catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }
  const from = monthsAgoStr(reqMonths(req));
  const rows = await db.select({
    name: squareCategoryCacheTable.categoryName,
    total: sql<string>`coalesce(sum(${squareCategoryCacheTable.grossAmount}),0)`,
    orders: sql<string>`coalesce(sum(${squareCategoryCacheTable.orderCount}),0)`,
  }).from(squareCategoryCacheTable)
    .where(and(eq(squareCategoryCacheTable.cafeId, cafeId), gte(squareCategoryCacheTable.orderDate, from)))
    .groupBy(squareCategoryCacheTable.categoryName)
    .orderBy(desc(sql`sum(${squareCategoryCacheTable.grossAmount})`))
    .limit(25);
  const items = rows.map((r) => ({ name: String(r.name).replace(/^__item__/, ""), total: Math.round(Number(r.total) || 0), orders: Number(r.orders) || 0 }));
  return res.json({ items });
});

export { calculateAndSaveSnapshot };
export default router;
