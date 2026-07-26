import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, cafesTable, cafeIntegrationsTable, squareOrdersCacheTable, customReportsTable, customReportLineItemsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { assertCafeOwner } from "./cafes";
import { getValidXeroToken } from "./xero";

const router: IRouter = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function xeroDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Maximum monthly periods Xero returns in a single P&L request.
// Xero caps at 11 comparison periods (= 12 months total per request).
const XERO_MAX_PERIODS = 11;

/**
 * Parse a single Xero P&L JSON report body into per-month row data.
 * Exported for unit-test access.
 */
function parseXeroPLReport(
  report: any,
): Array<{ month: string; rows: Array<{ name: string; amount: number; section: string }> }> {
  const headerRow = report.Rows?.find((r: any) => r.RowType === "Header");
  const monthLabels: string[] = [];
  if (headerRow?.Cells) {
    for (let i = 1; i < headerRow.Cells.length; i++) {
      const v = headerRow.Cells[i]?.Value ?? "";
      const parsed = parseXeroMonthLabel(v);
      if (parsed) monthLabels.push(parsed);
    }
  }
  if (monthLabels.length === 0) return [];

  const byMonth: Record<string, Array<{ name: string; amount: number; section: string }>> = {};
  for (const m of monthLabels) byMonth[m] = [];

  for (const section of report.Rows ?? []) {
    if (section.RowType !== "Section") continue;
    const sectionTitle = section.Title ?? "";
    for (const row of section.Rows ?? []) {
      if (row.RowType !== "Row") continue;
      const name = row.Cells?.[0]?.Value ?? "";
      if (!name) continue;
      for (let i = 0; i < monthLabels.length; i++) {
        const month = monthLabels[i];
        const raw = row.Cells?.[i + 1]?.Value ?? "0";
        const amount = Math.abs(parseFloat(raw) || 0);
        if (amount !== 0) {
          byMonth[month].push({ name, amount, section: sectionTitle });
        }
      }
    }
  }

  return monthLabels.map((m) => ({ month: m, rows: byMonth[m] ?? [] }));
}

/**
 * Fetch a single Xero P&L chunk for [chunkFrom, chunkTo] with up to
 * XERO_MAX_PERIODS monthly columns. Returns parsed per-month rows.
 */
async function fetchXeroPLChunk(
  accessToken: string,
  tenantId: string,
  chunkFrom: Date,
  chunkTo: Date,
  periods: number,
): Promise<Array<{ month: string; rows: Array<{ name: string; amount: number; section: string }> }>> {
  const url = [
    "https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss",
    `?fromDate=${xeroDateStr(chunkFrom)}`,
    `&toDate=${xeroDateStr(chunkTo)}`,
    `&periods=${periods}`,
    "&timeframe=MONTH",
  ].join("");

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
    },
  });
  if (!r.ok) return [];
  const data = (await r.json()) as any;
  const report = data.Reports?.[0];
  if (!report) return [];
  return parseXeroPLReport(report);
}

/**
 * Fetch monthly P&L from Xero for [fromDate, toDate], chunking into multiple
 * requests when the range exceeds XERO_MAX_PERIODS months. All chunks are
 * fetched in parallel and merged into a single per-month array.
 */
async function fetchXeroMonthlyPL(
  accessToken: string,
  tenantId: string,
  fromDate: Date,
  toDate: Date,
): Promise<Array<{ month: string; rows: Array<{ name: string; amount: number; section: string }> }>> {
  // Calculate total months in range (inclusive of both end months)
  const totalMonths =
    (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
    (toDate.getMonth() - fromDate.getMonth()) + 1;

  if (totalMonths <= 0) return [];

  // Build non-overlapping 12-month chunks covering the full range.
  // Each chunk: toDate = end of chunk, periods = months in chunk - 1.
  // We iterate from the END of the range backward so each chunk's toDate
  // aligns naturally with calendar month boundaries.
  type Chunk = { chunkFrom: Date; chunkTo: Date; periods: number };
  const chunks: Chunk[] = [];
  let remaining = totalMonths;
  // chunkEnd tracks the toDate of the current chunk (starts at overall toDate)
  const chunkEnd = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0); // last day of toDate's month

  while (remaining > 0) {
    const chunkMonths = Math.min(remaining, XERO_MAX_PERIODS + 1); // ≤12 months per chunk
    const periods = chunkMonths - 1; // Xero periods = comparison cols (months - 1)

    // chunkFrom = chunkEnd minus (chunkMonths - 1) months, first day
    const chunkFrom = new Date(chunkEnd.getFullYear(), chunkEnd.getMonth() - periods, 1);

    chunks.push({ chunkFrom, chunkTo: new Date(chunkEnd), periods });
    remaining -= chunkMonths;
    // Move chunkEnd back one month
    chunkEnd.setMonth(chunkEnd.getMonth() - chunkMonths);
    // Set to last day of that month
    chunkEnd.setDate(new Date(chunkEnd.getFullYear(), chunkEnd.getMonth() + 1, 0).getDate());
  }

  // Fetch all chunks in parallel for speed
  const chunkResults = await Promise.all(
    chunks.map(({ chunkFrom, chunkTo, periods }) =>
      fetchXeroPLChunk(accessToken, tenantId, chunkFrom, chunkTo, periods),
    ),
  );

  // Merge: flatten all chunk results, deduplicate by month (first occurrence wins)
  const seen = new Set<string>();
  const merged: Array<{ month: string; rows: Array<{ name: string; amount: number; section: string }> }> = [];
  for (const chunkRows of chunkResults) {
    for (const entry of chunkRows) {
      if (!seen.has(entry.month)) {
        seen.add(entry.month);
        merged.push(entry);
      }
    }
  }
  // Sort chronologically
  merged.sort((a, b) => a.month.localeCompare(b.month));
  return merged;
}

function parseXeroMonthLabel(label: string): string | null {
  // Handles "01 Jan 2025", "Jan 2025", "1 January 2025" etc.
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const parts = label.trim().split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const abbr = parts[i].toLowerCase().slice(0, 3);
    if (months[abbr]) {
      // find a 4-digit year nearby
      const yearPart = parts.find((p) => /^\d{4}$/.test(p));
      if (yearPart) return `${yearPart}-${months[abbr]}`;
    }
  }
  return null;
}

/** Build monthly aggregated data for a single report. */
async function buildReportData(
  reportId: string,
  cafeId: string,
  dateRangeMonths: number,
) {
  const lineItems = await db
    .select()
    .from(customReportLineItemsTable)
    .where(eq(customReportLineItemsTable.reportId, reportId));

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - (dateRangeMonths - 1));
  fromDate.setDate(1); // start of month

  // Generate canonical month list from fromDate to toDate
  const months: string[] = [];
  const cur = new Date(fromDate);
  while (cur <= toDate) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }

  // Monthly buckets
  const incomeByMonth: Record<string, number> = {};
  const expensesByMonth: Record<string, number> = {};
  for (const m of months) {
    incomeByMonth[m] = 0;
    expensesByMonth[m] = 0;
  }

  const xeroItems = lineItems.filter((li) => li.source === "xero_pl");
  const squareItems = lineItems.filter((li) => li.source === "square");

  // ── Xero monthly data ──────────────────────────────────────────────────────
  if (xeroItems.length > 0) {
    const [xeroInt] = await db
      .select()
      .from(cafeIntegrationsTable)
      .where(
        and(
          eq(cafeIntegrationsTable.cafeId, cafeId),
          eq(cafeIntegrationsTable.type, "xero"),
        )
      );

    if (xeroInt) {
      try {
        const accessToken = await getValidXeroToken(xeroInt, cafeId);
        const tenantId =
          xeroInt.metadata && typeof xeroInt.metadata === "object"
            ? (xeroInt.metadata as any).tenant_id
            : null;

        if (accessToken && tenantId) {
          const xeroMonthly = await fetchXeroMonthlyPL(accessToken, tenantId, fromDate, toDate);

          for (const { month, rows } of xeroMonthly) {
            if (!months.includes(month)) continue;
            for (const row of rows) {
              const matchingItems = xeroItems.filter(
                (li) => li.xeroAccountName === row.name,
              );
              for (const li of matchingItems) {
                if (li.kind === "income") incomeByMonth[month] = (incomeByMonth[month] ?? 0) + row.amount;
                else expensesByMonth[month] = (expensesByMonth[month] ?? 0) + row.amount;
              }
            }
          }
        }
      } catch (err) {
        logger.warn({ cafeId, reportId, err }, "Xero monthly fetch failed for custom report");
      }
    }
  }

  // ── Square monthly data ────────────────────────────────────────────────────
  if (squareItems.some((li) => li.kind === "income")) {
    const fromStr = xeroDateStr(fromDate);
    const toStr = xeroDateStr(toDate);

    try {
      const squareRows = await db
        .select()
        .from(squareOrdersCacheTable)
        .where(
          and(
            eq(squareOrdersCacheTable.cafeId, cafeId),
          )
        );

      for (const row of squareRows) {
        if (!row.orderDate) continue;
        if (row.orderDate < fromStr || row.orderDate > toStr) continue;
        const month = row.orderDate.slice(0, 7); // "YYYY-MM"
        if (!months.includes(month)) continue;
        incomeByMonth[month] = (incomeByMonth[month] ?? 0) + Number(row.grossAmount ?? 0);
      }
    } catch (err) {
      logger.warn({ cafeId, reportId, err }, "Square cache read failed for custom report");
    }
  }

  // ── Build result ──────────────────────────────────────────────────────────
  const result = months.map((month) => {
    const income = Math.round((incomeByMonth[month] ?? 0) * 100) / 100;
    const expenses = Math.round((expensesByMonth[month] ?? 0) * 100) / 100;
    const net = Math.round((income - expenses) * 100) / 100;
    return { month, income, expenses, net };
  });

  // ── Growth metrics ────────────────────────────────────────────────────────
  const totalIncome = result.reduce((s, r) => s + r.income, 0);
  const totalExpenses = result.reduce((s, r) => s + r.expenses, 0);
  const totalNet = result.reduce((s, r) => s + r.net, 0);

  // MoM change: compare last month vs second-to-last month net
  let momPct: number | null = null;
  if (result.length >= 2) {
    const last = result[result.length - 1].net;
    const prev = result[result.length - 2].net;
    if (prev !== 0) momPct = Math.round(((last - prev) / Math.abs(prev)) * 100);
  }

  // Period-over-period (first half vs second half)
  let popPct: number | null = null;
  if (result.length >= 4) {
    const half = Math.floor(result.length / 2);
    const firstHalfNet = result.slice(0, half).reduce((s, r) => s + r.net, 0);
    const secondHalfNet = result.slice(half).reduce((s, r) => s + r.net, 0);
    if (firstHalfNet !== 0) {
      popPct = Math.round(((secondHalfNet - firstHalfNet) / Math.abs(firstHalfNet)) * 100);
    }
  }

  return {
    months: result,
    totals: {
      income: Math.round(totalIncome * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      net: Math.round(totalNet * 100) / 100,
    },
    growth: { momPct, popPct },
    period: { fromDate: xeroDateStr(fromDate), toDate: xeroDateStr(toDate), months: months.length },
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/** GET /valuation/custom-reports?cafeId=... — list reports for a cafe */
router.get("/custom-reports", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.query as Record<string, string>;
  if (!cafeId) return res.status(400).json({ error: "cafeId required" });

  try { await assertCafeOwner(cafeId, userId); }
  catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }

  const reports = await db
    .select()
    .from(customReportsTable)
    .where(eq(customReportsTable.cafeId, cafeId))
    .orderBy(desc(customReportsTable.createdAt));

  // Attach line item counts for the list view
  const enriched = await Promise.all(
    reports.map(async (r) => {
      const items = await db
        .select()
        .from(customReportLineItemsTable)
        .where(eq(customReportLineItemsTable.reportId, r.id));
      const incomeCount = items.filter((i) => i.kind === "income").length;
      const expenseCount = items.filter((i) => i.kind === "expense").length;
      return { ...r, incomeCount, expenseCount };
    }),
  );

  return res.json({ reports: enriched });
});

/** POST /valuation/custom-reports — create a new report */
router.post("/custom-reports", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, name, description, dateRangeMonths = 12 } = req.body as {
    cafeId?: string; name?: string; description?: string; dateRangeMonths?: number;
  };
  if (!cafeId || !name) return res.status(400).json({ error: "cafeId and name required" });

  try { await assertCafeOwner(cafeId, userId); }
  catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }

  const [report] = await db
    .insert(customReportsTable)
    .values({ cafeId, ownerId: userId, name, description, dateRangeMonths })
    .returning();

  return res.status(201).json({ report });
});

/** PATCH /valuation/custom-reports/:id — update name/description/dateRangeMonths/includeInIm */
router.patch("/custom-reports/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };
  const { name, description, dateRangeMonths, includeInIm } = req.body as {
    name?: string; description?: string; dateRangeMonths?: number; includeInIm?: boolean;
  };

  const [existing] = await db
    .select()
    .from(customReportsTable)
    .where(eq(customReportsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Report not found" });

  try { await assertCafeOwner(existing.cafeId, userId); }
  catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }

  const updates: Partial<typeof customReportsTable.$inferInsert> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (dateRangeMonths !== undefined) updates.dateRangeMonths = dateRangeMonths;
  if (includeInIm !== undefined) updates.includeInIm = includeInIm;

  const [updated] = await db
    .update(customReportsTable)
    .set(updates)
    .where(eq(customReportsTable.id, id))
    .returning();

  return res.json({ report: updated });
});

/** DELETE /valuation/custom-reports/:id */
router.delete("/custom-reports/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };

  const [existing] = await db
    .select()
    .from(customReportsTable)
    .where(eq(customReportsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Report not found" });

  try { await assertCafeOwner(existing.cafeId, userId); }
  catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }

  await db.delete(customReportsTable).where(eq(customReportsTable.id, id));
  return res.json({ ok: true });
});

/** GET /valuation/custom-reports/:id/line-items — get all line items */
router.get("/custom-reports/:id/line-items", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };

  const [existing] = await db
    .select()
    .from(customReportsTable)
    .where(eq(customReportsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Report not found" });

  try { await assertCafeOwner(existing.cafeId, userId); }
  catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }

  const items = await db
    .select()
    .from(customReportLineItemsTable)
    .where(eq(customReportLineItemsTable.reportId, id));

  return res.json({ items });
});

/** PUT /valuation/custom-reports/:id/line-items — replace all line items */
router.put("/custom-reports/:id/line-items", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };
  const { items } = req.body as {
    items?: Array<{
      kind: string; label: string; source: string;
      xeroAccountId?: string; xeroAccountName?: string; sortOrder?: number;
    }>;
  };

  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });

  const [existing] = await db
    .select()
    .from(customReportsTable)
    .where(eq(customReportsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Report not found" });

  try { await assertCafeOwner(existing.cafeId, userId); }
  catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }

  // Replace all items atomically within a single transaction so a partial
  // failure cannot leave the report with no line items.
  await db.transaction(async (tx) => {
    await tx.delete(customReportLineItemsTable).where(eq(customReportLineItemsTable.reportId, id));
    if (items.length > 0) {
      await tx.insert(customReportLineItemsTable).values(
        items.map((item, idx) => ({
          reportId: id,
          kind: item.kind,
          label: item.label,
          source: item.source,
          xeroAccountId: item.xeroAccountId ?? null,
          xeroAccountName: item.xeroAccountName ?? null,
          sortOrder: item.sortOrder ?? idx,
        })),
      );
    }
    await tx
      .update(customReportsTable)
      .set({ updatedAt: new Date() })
      .where(eq(customReportsTable.id, id));
  });

  const saved = await db
    .select()
    .from(customReportLineItemsTable)
    .where(eq(customReportLineItemsTable.reportId, id));

  return res.json({ items: saved });
});

/** GET /valuation/custom-reports/:id/data — compute monthly aggregated data */
router.get("/custom-reports/:id/data", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };

  const [report] = await db
    .select()
    .from(customReportsTable)
    .where(eq(customReportsTable.id, id));
  if (!report) return res.status(404).json({ error: "Report not found" });

  try { await assertCafeOwner(report.cafeId, userId); }
  catch (e: any) { return res.status(e.status ?? 403).json({ error: e.message }); }

  try {
    const data = await buildReportData(id, report.cafeId, report.dateRangeMonths);
    return res.json(data);
  } catch (err: any) {
    logger.error({ err: err.message, reportId: id }, "Failed to build custom report data");
    return res.status(500).json({ error: "Failed to compute report data" });
  }
});

export default router;
