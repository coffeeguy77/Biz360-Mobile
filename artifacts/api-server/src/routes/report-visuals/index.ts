import { Router } from "express";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  db, cafesTable, valuationSnapshotsTable, businessUnitsTable,
  cafeEquipmentTable, sellerLeasesTable, sellerLeaseClausesTable,
  reportSectionsTable, reportAccessLogsTable, kvStore,
  reportVisualsTable,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";

const router = Router();

function isAdminUser(userId: string): boolean {
  const list = process.env.ADMIN_USER_IDS ?? "";
  if (!list.trim()) return false;
  return list.split(",").map((s) => s.trim()).includes(userId);
}

async function assertListingAccess(listingId: string, userId: string) {
  if (isAdminUser(userId)) {
    const [cafe] = await db.select().from(cafesTable).where(eq(cafesTable.listingId, listingId));
    if (!cafe) { const e: any = new Error("Listing not found"); e.status = 404; throw e; }
    return cafe;
  }
  const [cafe] = await db.select().from(cafesTable).where(
    and(eq(cafesTable.listingId, listingId), eq(cafesTable.ownerId, userId)),
  );
  if (!cafe) { const e: any = new Error("Listing not found or access denied"); e.status = 403; throw e; }
  return cafe;
}

// ─── Data resolver ─────────────────────────────────────────────────────────────
// Returns real data for a given data_source_type. Never returns fake/demo data.
// If data is absent, returns status: "needs_data".

type ResolvedData = {
  data: Record<string, unknown> | null;
  status: "ready" | "needs_data";
  sourceLabel: string;
  sourceConfidence: "high" | "medium" | "low" | "manual" | "unavailable";
};

async function resolveChartData(
  listingId: string,
  cafeId: string,
  userId: string,
  dataSourceType: string,
  config: Record<string, unknown>,
): Promise<ResolvedData> {
  const absent = (label: string): ResolvedData => ({
    data: null, status: "needs_data", sourceLabel: label, sourceConfidence: "unavailable",
  });

  const fmt = (n: string | number | null | undefined): string =>
    n ? `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—";

  switch (dataSourceType) {
    case "listing": {
      const [cafe] = await db.select().from(cafesTable).where(eq(cafesTable.id, cafeId));
      if (!cafe) return absent("Listing Data");
      return {
        data: {
          businessName:    (cafe as any).businessName ?? (cafe as any).name ?? null,
          suburb:          (cafe as any).suburb ?? (cafe as any).location ?? null,
          state:           (cafe as any).state ?? null,
          category:        (cafe as any).category ?? (cafe as any).businessType ?? null,
          askingPrice:     fmt((cafe as any).askingPrice),
          staffCount:      (cafe as any).staffCount ?? null,
          ownerHours:      (cafe as any).ownerHours ?? null,
          trainingPeriod:  (cafe as any).trainingPeriod ?? null,
        },
        status: "ready",
        sourceLabel: "App — Listing Data",
        sourceConfidence: "high",
      };
    }

    case "valuation": {
      // Prefer the most-recently published snapshot; fall back to most-recent
      // draft so that Revenue vs Profit / Valuation Bridge charts render even
      // before the seller formally publishes their valuation.
      let [snap] = await db
        .select()
        .from(valuationSnapshotsTable)
        .where(
          and(
            eq(valuationSnapshotsTable.cafeId, cafeId),
            eq(valuationSnapshotsTable.isPublished, true),
            sql`${valuationSnapshotsTable.unitId} IS NULL`,
          ),
        )
        .orderBy(desc(valuationSnapshotsTable.createdAt))
        .limit(1);
      if (!snap) {
        // No published snapshot — try any (draft) snapshot for this listing.
        [snap] = await db
          .select()
          .from(valuationSnapshotsTable)
          .where(
            and(
              eq(valuationSnapshotsTable.cafeId, cafeId),
              sql`${valuationSnapshotsTable.unitId} IS NULL`,
            ),
          )
          .orderBy(desc(valuationSnapshotsTable.createdAt))
          .limit(1);
      }
      // Compute business health score server-side — mirrors the mobile app formula:
      //   score = Math.round(sectionCompleteness × 0.5 + ebitdaHealth × 0.5)
      // Section completeness: how many of the 12 required section keys have content.
      // EBITDA health: adjustedEbitda / grossRevenue × 100, capped at 100 (no multiplier).
      // Score is computable even when snapshot is absent (uses sections-only half).
      // Returns absent only when NEITHER snapshot NOR any section data is available.
      const REQUIRED_KEYS = [
        "business_overview", "reason_for_sale", "key_selling_points",
        "financial_performance_summary", "addbacks_adjusted_ebitda",
        "app_valuation_summary", "plant_equipment_summary",
        "lease_premises_summary", "staff_owner_involvement", "customer_base",
        "operations_systems", "growth_opportunities",
      ];
      const allSections = await db.select({
        sectionKey: reportSectionsTable.sectionKey,
        body: reportSectionsTable.body,
        bulletPoints: reportSectionsTable.bulletPoints,
        tableData: reportSectionsTable.tableData,
      }).from(reportSectionsTable).where(eq(reportSectionsTable.listingId, listingId));
      const filled = REQUIRED_KEYS.filter((k) => {
        const sec = allSections.find((s) => s.sectionKey === k);
        if (!sec) return false;
        return !!(sec.body?.trim() || (Array.isArray(sec.bulletPoints) && sec.bulletPoints.length > 0) || sec.tableData);
      }).length;
      const hasAnySectionData = allSections.length > 0;
      if (!snap && !hasAnySectionData) return absent("Business Health Score");

      const aebitda  = Number(snap?.adjustedEbitda ?? 0);
      const equipVal = Number(snap?.totalEquipmentValue ?? 0);
      const completenessScore = REQUIRED_KEYS.length > 0
        ? Math.round((filled / REQUIRED_KEYS.length) * 100) : 0;
      const grossRev = Number(snap?.grossRevenue ?? 0);
      // EBITDA health: adjustedEbitda / grossRevenue × 100, capped at 100 — no multiplier.
      const ebitdaHealthScore = grossRev > 0 && aebitda > 0
        ? Math.min(100, Math.round((aebitda / grossRev) * 100))
        : 0;
      const businessHealthScore = Math.round(completenessScore * 0.5 + ebitdaHealthScore * 0.5);

      if (!snap) {
        // Snapshot absent — return sections-only health (no financial metrics).
        // sectionsOnly:true signals buildChartData to return null for non-score-card types,
        // so stat_card / metric_grid / valuation_bridge etc. show needs_data, not empty charts.
        return {
          data: { businessHealthScore, sectionsOnly: true },
          status: "ready",
          sourceLabel: "App — Section Completeness",
          sourceConfidence: "low",
        };
      }

      return {
        data: {
          estimatedValue:    fmt(snap.valuationMidpoint?.toString()),
          valuationLow:      fmt(String(Math.round(aebitda * 2.0 + equipVal))),
          valuationHigh:     fmt(String(Math.round(aebitda * 2.5 + equipVal))),
          revenue:           fmt(snap.grossRevenue?.toString()),
          cogs:              fmt(snap.cogs?.toString()),
          grossProfit:       fmt(snap.grossProfit?.toString()),
          ebitda:            fmt(snap.ebitda?.toString()),
          adjustedEbitda:    fmt(snap.adjustedEbitda?.toString()),
          equipmentValue:    fmt(snap.totalEquipmentValue?.toString()),
          businessHealthScore,
          valuationMultiple:   (snap as any).valuationMultiple ?? null,
          rawAdjustedEbitda: Number(snap.adjustedEbitda),
          rawEquipmentValue: equipVal,
        },
        status: "ready",
        sourceLabel: "App — Valuation Engine",
        sourceConfidence: "high",
      };
    }

    case "divisions": {
      // Only include active divisions (isIncludedInSale = true)
      const units = await db.select().from(businessUnitsTable).where(
        and(
          eq(businessUnitsTable.cafeId, cafeId),
          eq(businessUnitsTable.isIncludedInSale, true),
        ),
      );
      if (!units.length) return absent("Division Data");

      // Fetch the latest snapshot per unit regardless of published status —
      // same logic as GET /snapshots/latest so chart data matches what the
      // division tabs already show the seller.
      type UnitSnap = typeof valuationSnapshotsTable.$inferSelect;
      const snapByUnit = new Map<string, UnitSnap>();
      await Promise.all(units.map(async (u) => {
        const [snap] = await db.select().from(valuationSnapshotsTable).where(
          and(
            eq(valuationSnapshotsTable.cafeId, cafeId),
            eq(valuationSnapshotsTable.unitId, u.id),
          ),
        ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
        if (snap) snapByUnit.set(u.id, snap);
      }));

      // Compute total revenue for share-percentage derivation
      const totalRevenue = units.reduce((sum, u) => {
        const snap = snapByUnit.get(u.id);
        return sum + Number(snap?.grossRevenue ?? 0);
      }, 0);

      const rows = units.map((u) => {
        const snap = snapByUnit.get(u.id);
        const rawRevenue = Number(snap?.grossRevenue ?? 0);
        // If THIS unit has a snapshot, derive pct from actual revenue.
        // If this unit lacks a snapshot (but others have one), fall back to
        // the manually-stored revenueSharePct rather than forcing it to 0.
        const revenueSharePct = snap != null && totalRevenue > 0
          ? Math.round((rawRevenue / totalRevenue) * 1000) / 10
          : Number(u.revenueSharePct ?? 0);
        return {
          name:           u.name,
          included:       true,
          revenueSharePct,
          rawRevenue,
          revenue:        fmt(snap?.grossRevenue?.toString()),
          cogs:           fmt(snap?.cogs?.toString()),
          grossProfit:    fmt(snap?.grossProfit?.toString()),
          ebitda:         fmt(snap?.ebitda?.toString()),
          adjustedEbitda: fmt(snap?.adjustedEbitda?.toString()),
          valuation:      fmt(snap?.valuationMidpoint?.toString()),
        };
      });

      return {
        data: { rows, includedUnits: rows, excludedUnits: [], totalCount: rows.length },
        status: "ready",
        sourceLabel: "App — Divisions",
        sourceConfidence: "high",
      };
    }

    case "equipment": {
      const eq2 = await db.select().from(cafeEquipmentTable).where(
        and(eq(cafeEquipmentTable.cafeId, cafeId), eq(cafeEquipmentTable.suspended, false)),
      );
      if (!eq2.length) return absent("Equipment Ledger");
      const totalSH = eq2.reduce((s, e) => s + Number(e.secondhandValue ?? e.currentValue ?? 0), 0);
      const totalRep = eq2.reduce((s, e) => s + Number((e as any).replacementValue ?? e.currentValue ?? 0), 0);
      const categories: Record<string, { count: number; value: number }> = {};
      for (const item of eq2) {
        const cat = item.category ?? "Other";
        if (!categories[cat]) categories[cat] = { count: 0, value: 0 };
        categories[cat].count++;
        categories[cat].value += Number(item.secondhandValue ?? item.currentValue ?? 0);
      }
      const topAssets = eq2
        .sort((a, b) => Number(b.secondhandValue ?? b.currentValue ?? 0) - Number(a.secondhandValue ?? a.currentValue ?? 0))
        .slice(0, 10)
        .map((e) => ({
          name:  e.name,
          cat:   e.category ?? "Other",
          value: fmt((e.secondhandValue ?? e.currentValue)?.toString()),
          raw:   Number(e.secondhandValue ?? e.currentValue ?? 0),
        }));
      const categoryRows = Object.entries(categories).map(([cat, d]) => ({
        cat, count: d.count, value: fmt(String(d.value)), raw: d.value,
      }));
      return {
        data: {
          totalItems: eq2.length,
          totalSecondhandValue:   fmt(String(totalSH)),
          totalReplacementValue:  fmt(String(totalRep)),
          topAssets,
          categoryRows,
          rawTotalSH: totalSH,
        },
        status: "ready",
        sourceLabel: "App — Equipment Ledger",
        sourceConfidence: "high",
      };
    }

    case "lease": {
      const [leaseRows, clauseRows] = await Promise.all([
        db.select().from(sellerLeasesTable).where(eq(sellerLeasesTable.userId, userId)),
        db.select().from(sellerLeaseClausesTable).where(eq(sellerLeaseClausesTable.userId, userId)),
      ]);
      if (!leaseRows.length) return absent("Lease Analysis");
      const riskCounts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
      const riskByCategory: Record<string, number> = {};
      for (const cr of clauseRows) {
        const d = cr.data as Record<string, unknown>;
        const risk = ((d.riskLevel ?? d.risk_level ?? "unknown") as string).toLowerCase();
        if (risk === "critical") riskCounts.critical++;
        else if (risk === "high") riskCounts.high++;
        else if (risk === "medium") riskCounts.medium++;
        else if (risk === "low") riskCounts.low++;
        else riskCounts.unknown++;
        const cat = (d.category ?? d.clauseType ?? "Other") as string;
        riskByCategory[cat] = (riskByCategory[cat] ?? 0) + 1;
      }
      const topRiskCategories = Object.entries(riskByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, count]) => ({ cat, count }));
      return {
        data: {
          leaseCount: leaseRows.length,
          clauseCount: clauseRows.length,
          riskCounts,
          topRiskCategories,
          riskRows: [
            { label: "Critical", count: riskCounts.critical, color: "#EF4444" },
            { label: "High",     count: riskCounts.high,     color: "#F97316" },
            { label: "Medium",   count: riskCounts.medium,   color: "#F59E0B" },
            { label: "Low",      count: riskCounts.low,      color: "#16A34A" },
          ],
        },
        status: "ready",
        sourceLabel: "App — Lease Analysis",
        sourceConfidence: "high",
      };
    }

    case "tour": {
      const [rowV2] = await db.select({ value: kvStore.value }).from(kvStore)
        .where(eq(kvStore.key, `biz360_tour_spaces_v2_${listingId}`)).limit(1);
      let spaces: Record<string, unknown>[] = Array.isArray(rowV2?.value) ? (rowV2.value as any[]) : [];
      if (!spaces.length) {
        const [rowV1] = await db.select({ value: kvStore.value }).from(kvStore)
          .where(eq(kvStore.key, `biz360_tour_spaces_v1_${listingId}`)).limit(1);
        spaces = Array.isArray(rowV1?.value) ? (rowV1.value as any[]) : [];
      }
      if (!spaces.length) return absent("360° Tour");
      const pinCount = spaces.reduce((s, sp) => s + ((sp.pins as unknown[])?.length ?? 0), 0);
      const audioCount = spaces.reduce((s, sp) => {
        const pins = (sp.pins as Record<string, unknown>[]) ?? [];
        return s + pins.filter((p) => p.type === "audio").length;
      }, 0);
      const startScene = spaces.find((s) => s.isStartScene)?.name ?? spaces[0]?.name ?? null;
      return {
        data: {
          spaceCount:  spaces.length,
          pinCount,
          audioCount,
          startScene,
          sceneNames: spaces.map((s) => s.name as string).filter(Boolean).slice(0, 10),
        },
        status: "ready",
        sourceLabel: "App — 360° Tour",
        sourceConfidence: "high",
      };
    }

    case "buyer_engagement": {
      const logs = await db.select().from(reportAccessLogsTable)
        .where(eq(reportAccessLogsTable.listingId, listingId));
      if (!logs.length) return absent("Buyer Engagement");
      const counts: Record<string, number> = {};
      for (const l of logs) {
        counts[l.eventType] = (counts[l.eventType] ?? 0) + 1;
      }
      const funnel = [
        // "report_viewed" is the event logged when a buyer opens the report page.
        { label: "Listing Views",       value: counts["report_viewed"] ?? counts["section_viewed"] ?? 0 },
        { label: "Tour Starts",         value: counts["tour_clicked"] ?? 0 },
        { label: "Unique Buyers",       value: new Set(logs.map((l) => l.buyerId ?? l.buyerPhone).filter(Boolean)).size },
        { label: "Messages",            value: counts["contact_clicked"] ?? 0 },
        { label: "Doc Requests",        value: counts["document_requested"] ?? 0 },
        { label: "Financial Access",    value: counts["financials_unlocked"] ?? counts["access_requested"] ?? 0 },
        { label: "Inspections Booked",  value: counts["inspection_booked"] ?? 0 },
        { label: "PDFs Downloaded",     value: counts["pdf_downloaded"] ?? 0 },
      ];
      const hasAnyActivity = logs.length > 0;
      const max = Math.max(...funnel.map((f) => f.value), 1);
      return {
        data: { funnel: funnel.map((f) => ({ ...f, pct: Math.round((f.value / max) * 100) })), totalEvents: logs.length },
        status: hasAnyActivity ? "ready" : "needs_data",
        sourceLabel: "App — Buyer Engagement",
        sourceConfidence: hasAnyActivity ? "medium" : "unavailable",
      };
    }

    case "due_diligence": {
      const sections = await db.select({
        sectionKey: reportSectionsTable.sectionKey,
        bulletPoints: reportSectionsTable.bulletPoints,
      }).from(reportSectionsTable).where(eq(reportSectionsTable.listingId, listingId));
      const ddSec = sections.find((s) => s.sectionKey === "due_diligence_documents_available");
      const bullets = Array.isArray(ddSec?.bulletPoints) ? (ddSec!.bulletPoints as string[]) : [];
      if (!bullets.length) return absent("Due Diligence");
      const available = bullets.filter((b) => /available|uploaded|complete|yes/i.test(b)).length;
      const pending   = bullets.filter((b) => /pending|in\s*progress|requested/i.test(b)).length;
      const missing   = bullets.length - available - pending;
      const rows = bullets.map((b) => ({
        label:  b.replace(/^[✅⚠️❌•\-\s]+/, "").trim(),
        status: /available|uploaded|complete|yes/i.test(b) ? "available"
              : /pending|in\s*progress/i.test(b) ? "pending" : "missing",
      }));
      return {
        data: { rows, available, pending, missing, total: bullets.length },
        status: "ready",
        sourceLabel: "App — Due Diligence",
        sourceConfidence: "medium",
      };
    }

    case "manual":
      return {
        data: null,
        status: "needs_data",
        sourceLabel: "Seller Supplied",
        sourceConfidence: "manual",
      };

    default:
      return absent("Unknown Source");
  }
}

// Build chartData from resolved data for a given visual type
function buildChartData(
  visualType: string,
  resolved: ResolvedData,
  config: Record<string, unknown>,
  manualData?: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (resolved.status !== "ready" && !manualData?.length) return null;
  const raw = resolved.data ?? {};
  // Sections-only valuation data (snapshot absent) is only meaningful for score_card.
  // Guard here so stat_card / metric_grid / valuation_bridge etc. fall through to needs_data.
  if ((raw as any).sectionsOnly === true && visualType !== "score_card") return null;

  // Manual data override — shape rows to match each renderer's expected contract
  if (manualData?.length) {
    const label = "Seller Supplied";
    const conf  = "manual";
    // Normalise: accept { label, value } or { name, value }
    const rows = manualData.map((r) => ({
      label: String(r.label ?? r.name ?? ""),
      value: r.value,
    }));
    switch (visualType) {
      case "stat_card":
      case "metric_grid":
        return { metrics: rows, sourceLabel: label, sourceConfidence: conf, isManual: true };
      case "table":
        return { rows, sourceLabel: label, sourceConfidence: conf, isManual: true };
      case "bar_chart":
      case "horizontal_bar_chart":
        return { bars: rows, sourceLabel: label, sourceConfidence: conf, isManual: true };
      case "donut_chart":
        return { slices: rows, sourceLabel: label, sourceConfidence: conf, isManual: true };
      case "funnel":
        return { funnel: rows, sourceLabel: label, sourceConfidence: conf, isManual: true };
      case "checklist":
        return { items: rows, sourceLabel: label, sourceConfidence: conf, isManual: true };
      case "score_card": {
        // score_card from manual: first row value used as the numeric score
        const score = rows[0] ? Number(rows[0].value) : null;
        if (score == null || isNaN(score)) return null; // can't render
        return { score, label: rows[0]?.label ?? "Score", sourceLabel: label, sourceConfidence: conf, isManual: true };
      }
      default:
        // valuation_bridge and unknown types: manual input not meaningful — return null (needs_data)
        return null;
    }
  }

  switch (visualType) {
    case "stat_card":
    case "metric_grid":
      return { metrics: buildMetricList(raw, config), ...resolved };

    case "table": {
      if (Array.isArray((raw as any).rows)) {
        const rows = (raw as any).rows as any[];
        // Division rows: flatten each unit's available metrics into separate label-value rows
        // so that revenue, gross profit, EBITDA, and valuation are all exposed for any metric view
        if (rows.length && rows[0].name !== undefined && rows[0].rawRevenue !== undefined) {
          const divRows: Array<{ label: string; value: string }> = [];
          for (const r of rows) {
            if (r.revenue     !== "—") divRows.push({ label: `${r.name} — Revenue`,      value: r.revenue });
            if (r.grossProfit !== "—") divRows.push({ label: `${r.name} — Gross Profit`, value: r.grossProfit });
            if (r.ebitda      !== "—") divRows.push({ label: `${r.name} — EBITDA`,       value: r.ebitda });
            if (r.valuation   !== "—") divRows.push({ label: `${r.name} — Valuation`,    value: r.valuation });
          }
          // Fallback: if snapshots hadn't populated any metric (manual pct only), show share %
          if (!divRows.length) {
            for (const r of rows) divRows.push({ label: r.name, value: `${r.revenueSharePct}%` });
          }
          return { rows: divRows, ...resolved };
        }
        return { rows, ...resolved };
      }
      const metrics = buildMetricList(raw, config);
      return { rows: metrics.map((m) => ({ label: m.label, value: m.value })), ...resolved };
    }

    case "bar_chart":
    case "horizontal_bar_chart":
      if ((raw as any).rows) {
        const rows = (raw as any).rows as any[];
        // Division rows: show revenue per division; use rawRevenue for proportional bar widths
        if (rows.length && rows[0].name !== undefined && rows[0].rawRevenue !== undefined) {
          return { bars: rows.map((r) => ({ label: r.name, value: r.revenue, raw: r.rawRevenue })), ...resolved };
        }
        return { bars: rows, ...resolved };
      }
      if ((raw as any).funnel) return { bars: (raw as any).funnel, ...resolved };
      if ((raw as any).topAssets) return { bars: (raw as any).topAssets.map((a: any) => ({ label: a.name, value: a.value, raw: a.raw })), ...resolved };
      if ((raw as any).riskRows) return { bars: (raw as any).riskRows.map((r: any) => ({ label: r.label, value: String(r.count ?? 0), raw: Number(r.count ?? 0), color: r.color })), ...resolved };
      if ((raw as any).categoryRows) return { bars: (raw as any).categoryRows.map((c: any) => ({ label: c.cat, value: c.value, raw: c.raw })), ...resolved };
      return { bars: buildMetricList(raw, config), ...resolved };

    case "donut_chart":
      if ((raw as any).riskRows) return { slices: (raw as any).riskRows.map((r: any) => ({ label: r.label, value: Number(r.count ?? 0), raw: Number(r.count ?? 0), color: r.color })), ...resolved };
      if ((raw as any).categoryRows) return { slices: (raw as any).categoryRows.map((c: any) => ({ label: c.cat, value: c.value, raw: c.raw })), ...resolved };
      if (Array.isArray((raw as any).rows)) {
        const rows = (raw as any).rows as any[];
        // Division rows: use revenueSharePct as the proportion value, include raw for SVG rendering
        if (rows.length && rows[0].name !== undefined && rows[0].rawRevenue !== undefined) {
          return { slices: rows.map((r) => ({ label: r.name, value: r.revenueSharePct, raw: r.rawRevenue })), ...resolved };
        }
        return { slices: rows.map((r: any) => ({ label: r.name ?? r.label, value: r.revenueSharePct ?? r.value })), ...resolved };
      }
      return null;

    case "valuation_bridge":
      if (!raw.rawAdjustedEbitda && !raw.rawEquipmentValue) return null;
      return {
        adjustedEbitda:   raw.adjustedEbitda,
        equipmentValue:   raw.equipmentValue,
        estimatedValue:   raw.estimatedValue,
        valuationLow:     raw.valuationLow,
        valuationHigh:    raw.valuationHigh,
        rawAdjustedEbitda: raw.rawAdjustedEbitda,
        rawEquipmentValue: raw.rawEquipmentValue,
        ...resolved,
      };

    case "funnel":
      if ((raw as any).funnel) return { funnel: (raw as any).funnel, ...resolved };
      return null;

    case "checklist":
      if ((raw as any).rows) return { items: (raw as any).rows, ...resolved };
      return null;

    case "score_card":
      if (raw.businessHealthScore != null) return { score: Number(raw.businessHealthScore), label: "Business Health Score", ...resolved };
      return null;

    default:
      return { ...raw, ...resolved };
  }
}

function buildMetricList(raw: Record<string, unknown>, config: Record<string, unknown>): Array<{ label: string; value: unknown }> {
  const fields = (config.fields as string[]) ?? Object.keys(raw).slice(0, 6);
  return fields
    .filter((f) => raw[f] !== null && raw[f] !== undefined)
    .map((f) => ({
      label: f.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
      value: raw[f],
    }));
}

// ─── GET /api/report-visuals/:listingId ────────────────────────────────────────
// Auto-resolves chart_data for rows with status="needs_data" so callers always
// receive the freshest available data without a separate resolve call.
router.get("/report-visuals/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    const cafe = await assertListingAccess(listingId, userId);
    const rows = await db
      .select()
      .from(reportVisualsTable)
      .where(and(eq(reportVisualsTable.listingId, listingId), isNull(reportVisualsTable.deletedAt)))
      .orderBy(asc(reportVisualsTable.sortOrder), asc(reportVisualsTable.createdAt));

    // Auto-resolve rows whose data is stale or missing so GET always returns
    // up-to-date chartData from live sources.
    const needsResolve = rows.filter((r) => r.status === "needs_data" || !r.chartData);
    if (needsResolve.length > 0) {
      await Promise.all(
        needsResolve.map(async (row) => {
          try {
            const resolved = await resolveChartData(
              listingId, cafe.id, userId,
              row.dataSourceType ?? "manual",
              (row.dataSourceConfig as Record<string, unknown>) ?? {},
            );
            const chartData = buildChartData(
              row.visualType ?? "stat_card", resolved,
              (row.dataSourceConfig as Record<string, unknown>) ?? {},
              (row.manualData as Array<Record<string, unknown>> | null) ?? undefined,
            );
            if (chartData) {
              await db.update(reportVisualsTable).set({
                chartData,
                status:           "ready",
                sourceLabel:      resolved.sourceLabel,
                sourceConfidence: resolved.sourceConfidence,
                updatedAt:        new Date(),
              }).where(eq(reportVisualsTable.id, row.id));
              // Mutate so the response reflects refreshed data without a second DB round-trip
              (row as any).chartData = chartData;
              (row as any).status = "ready";
              (row as any).sourceLabel = resolved.sourceLabel;
              (row as any).sourceConfidence = resolved.sourceConfidence;
            }
          } catch { /* non-fatal — return stored row */ }
        }),
      );
    }

    res.json({ visuals: rows });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? "Failed to load visuals" });
  }
});

// ─── POST /api/report-visuals/:listingId/resolve ───────────────────────────────
// Resolves chart_data for a given data_source_type + config without saving.
// Used by the Add Visual preview step.
router.post("/report-visuals/:listingId/resolve", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  const { dataSourceType = "manual", dataSourceConfig = {}, visualType = "stat_card", manualData } =
    req.body as { dataSourceType?: string; dataSourceConfig?: Record<string, unknown>; visualType?: string; manualData?: Array<Record<string, unknown>> };
  try {
    const cafe = await assertListingAccess(listingId, userId);
    const resolved = await resolveChartData(listingId, cafe.id, userId, dataSourceType, dataSourceConfig);
    const chartData = buildChartData(visualType, resolved, dataSourceConfig, manualData);
    res.json({ resolved, chartData, status: chartData ? "ready" : "needs_data" });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? "Resolve failed" });
  }
});

// ─── POST /api/report-visuals/:listingId ──────────────────────────────────────
router.post("/report-visuals/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  const body = req.body as Partial<typeof reportVisualsTable.$inferInsert>;
  if (!body.title) { res.status(400).json({ error: "title is required" }); return; }
  try {
    const cafe = await assertListingAccess(listingId, userId);

    // Resolve chart data from real source
    const resolved = await resolveChartData(
      listingId, cafe.id, userId,
      body.dataSourceType ?? "manual",
      (body.dataSourceConfig as Record<string, unknown>) ?? {},
    );
    const manualData = body.manualData as Array<Record<string, unknown>> | undefined;
    const chartData = buildChartData(
      body.visualType ?? "stat_card", resolved,
      (body.dataSourceConfig as Record<string, unknown>) ?? {},
      manualData,
    );

    // Count existing for sort_order
    const existing = await db.select({ id: reportVisualsTable.id })
      .from(reportVisualsTable)
      .where(and(eq(reportVisualsTable.listingId, listingId), isNull(reportVisualsTable.deletedAt)));

    // Only mark ready when chartData was actually produced — buildChartData returns
    // null for unsupported type+source combinations (e.g. valuation_bridge + manual)
    const status = chartData ? "ready" : "needs_data";

    const [visual] = await db.insert(reportVisualsTable).values({
      userId,
      listingId,
      sectionKey:           body.sectionKey ?? null,
      title:                body.title!,
      subtitle:             body.subtitle ?? null,
      visualType:           body.visualType ?? "stat_card",
      dataSourceType:       body.dataSourceType ?? "manual",
      dataSourceConfig:     body.dataSourceConfig ?? null,
      visualConfig:         body.visualConfig ?? null,
      manualData:           manualData ?? null,
      chartData:            chartData ?? null,
      sortOrder:            existing.length,
      includeInPdf:         body.includeInPdf ?? true,
      includeInHtml:        body.includeInHtml ?? true,
      includeInBuyerReport: body.includeInBuyerReport ?? true,
      includeInSellerReport:body.includeInSellerReport ?? true,
      visibility:           body.visibility ?? "public",
      sourceLabel:          resolved.sourceLabel,
      sourceConfidence:     resolved.sourceConfidence,
      status,
    }).returning();

    logger.info({ visualId: visual.id, listingId, visualType: visual.visualType }, "Report visual created");
    res.status(201).json({ visual });
  } catch (err: any) {
    logger.error({ err, listingId }, "Report visual create failed");
    res.status(err.status ?? 500).json({ error: err.message ?? "Failed to create visual" });
  }
});

// ─── PATCH /api/report-visuals/:listingId/:id ─────────────────────────────────
router.patch("/report-visuals/:listingId/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, id } = req.params as { listingId: string; id: string };
  const body = req.body as Partial<typeof reportVisualsTable.$inferInsert>;
  try {
    const cafe = await assertListingAccess(listingId, userId);

    const [existing] = await db.select().from(reportVisualsTable).where(
      and(eq(reportVisualsTable.id, id), eq(reportVisualsTable.listingId, listingId), isNull(reportVisualsTable.deletedAt)),
    );
    if (!existing) { res.status(404).json({ error: "Visual not found" }); return; }

    // If data source changed or manualData updated, re-resolve chartData
    const newDataSourceType = body.dataSourceType ?? existing.dataSourceType;
    const newConfig = (body.dataSourceConfig ?? existing.dataSourceConfig ?? {}) as Record<string, unknown>;
    const newVisualType = body.visualType ?? existing.visualType;
    const newManualData = body.manualData !== undefined
      ? (body.manualData as Array<Record<string, unknown>> | null)
      : (existing.manualData as Array<Record<string, unknown>> | null);

    let chartData = existing.chartData as Record<string, unknown> | null;
    let sourceLabel = existing.sourceLabel;
    let sourceConfidence = existing.sourceConfidence;
    let status = existing.status;

    const needsReresolve = body.dataSourceType !== undefined || body.dataSourceConfig !== undefined
      || body.visualType !== undefined || body.manualData !== undefined;

    if (needsReresolve) {
      const resolved = await resolveChartData(listingId, cafe.id, userId, newDataSourceType, newConfig);
      chartData = buildChartData(newVisualType, resolved, newConfig, newManualData ?? undefined);
      sourceLabel = resolved.sourceLabel;
      sourceConfidence = resolved.sourceConfidence;
      status = chartData ? "ready" : "needs_data";
    }

    const patch: Partial<typeof reportVisualsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
      ...(body.title       !== undefined && { title: body.title }),
      ...(body.subtitle    !== undefined && { subtitle: body.subtitle }),
      ...(body.sectionKey  !== undefined && { sectionKey: body.sectionKey }),
      ...(body.visualType  !== undefined && { visualType: body.visualType }),
      ...(body.dataSourceType !== undefined && { dataSourceType: body.dataSourceType }),
      ...(body.dataSourceConfig !== undefined && { dataSourceConfig: body.dataSourceConfig }),
      ...(body.visualConfig !== undefined && { visualConfig: body.visualConfig }),
      ...(body.manualData  !== undefined && { manualData: body.manualData }),
      ...(body.sortOrder   !== undefined && { sortOrder: body.sortOrder }),
      ...(body.includeInPdf !== undefined && { includeInPdf: body.includeInPdf }),
      ...(body.includeInHtml !== undefined && { includeInHtml: body.includeInHtml }),
      ...(body.includeInBuyerReport !== undefined && { includeInBuyerReport: body.includeInBuyerReport }),
      ...(body.includeInSellerReport !== undefined && { includeInSellerReport: body.includeInSellerReport }),
      ...(body.visibility  !== undefined && { visibility: body.visibility }),
      chartData, sourceLabel, sourceConfidence, status,
    };

    const [updated] = await db.update(reportVisualsTable).set(patch)
      .where(eq(reportVisualsTable.id, id)).returning();
    res.json({ visual: updated });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? "Failed to update visual" });
  }
});

// ─── DELETE /api/report-visuals/:listingId/:id ────────────────────────────────
router.delete("/report-visuals/:listingId/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, id } = req.params as { listingId: string; id: string };
  try {
    await assertListingAccess(listingId, userId);
    const [existing] = await db.select({ id: reportVisualsTable.id }).from(reportVisualsTable)
      .where(and(eq(reportVisualsTable.id, id), eq(reportVisualsTable.listingId, listingId), isNull(reportVisualsTable.deletedAt)));
    if (!existing) { res.status(404).json({ error: "Visual not found" }); return; }
    await db.update(reportVisualsTable).set({ deletedAt: new Date() }).where(eq(reportVisualsTable.id, id));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? "Failed to delete visual" });
  }
});

// ─── GET /api/report-visuals/:listingId/for-section/:sectionKey ───────────────
// Seller-only endpoint (requires auth + listing ownership).
// Visibility is determined from the authenticated user's ownership — the
// `seller` query param is never trusted for privilege decisions.
router.get("/report-visuals/:listingId/for-section/:sectionKey", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, sectionKey } = req.params as { listingId: string; sectionKey: string };
  try {
    await assertListingAccess(listingId, userId);
    const rows = await db
      .select()
      .from(reportVisualsTable)
      .where(
        and(
          eq(reportVisualsTable.listingId, listingId),
          eq(reportVisualsTable.sectionKey, sectionKey),
          eq(reportVisualsTable.status, "ready"),
          isNull(reportVisualsTable.deletedAt),
          eq(reportVisualsTable.includeInSellerReport, true),
        ),
      )
      .orderBy(asc(reportVisualsTable.sortOrder));
    res.json({ visuals: rows });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? "Failed to load section visuals" });
  }
});

export default router;
