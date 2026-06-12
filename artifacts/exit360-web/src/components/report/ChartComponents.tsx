// ChartComponents.tsx — HTML report chart suite.
// POLICY: Every component returns null if its data prop is absent, empty, or
// structurally invalid. No demo/placeholder data is ever rendered.
// Charts only appear when real seller-entered or app-generated data exists.

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const PALETTE = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];
const MUTED = "#8B9CB8";
const GRID = "#1E3A5C";
const TIP: React.CSSProperties = {
  backgroundColor: "#0F2040", border: "1px solid #1E3A5C",
  borderRadius: 8, color: "#e2e8f0", fontSize: 12,
};

function fmtK(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function isNonEmpty(data: unknown): data is unknown[] {
  return Array.isArray(data) && data.length > 0;
}

// ── 1. Valuation Bridge ───────────────────────────────────────────────────────
// Requires: adjusted EBITDA, valuation multiple, and equipment value.
// Expected shape: [{ name, value, type: "start"|"add"|"total" }]
interface BridgeEntry { name: string; value: number; type: "start" | "add" | "total" }
export function ValuationBridgeChart({ data }: { data?: unknown }) {
  if (!isNonEmpty(data)) return null;
  const d = data as BridgeEntry[];
  const valid = d.filter(e => e && typeof e.name === "string" && typeof e.value === "number");
  if (!valid.length) return null;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={valid} margin={{ top: 10, right: 10, bottom: 5, left: 50 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={TIP} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {valid.map((e, i) => <Cell key={i} fill={e.type === "total" ? "#10B981" : e.type === "add" ? "#8B5CF6" : "#3B82F6"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 2. Revenue by Division (donut) ────────────────────────────────────────────
// Requires: real division names + revenue/percentage values.
// Expected shape: [{ name, value }]
interface DivEntry { name: string; value: number }
export function RevenueDivisionChart({ data }: { data?: unknown }) {
  if (!isNonEmpty(data)) return null;
  const d = (data as DivEntry[]).filter(e => e && typeof e.name === "string" && Number(e.value) > 0);
  if (!d.length) return null;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={d} dataKey="value" nameKey="name" cx="50%" cy="50%"
          innerRadius={55} outerRadius={90} paddingAngle={3}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={{ stroke: MUTED }}>
          {d.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={TIP} formatter={(v: number) => `${v}%`} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 3. Valuation by Division ──────────────────────────────────────────────────
// Requires: real division names + valuation figures.
// Expected shape: [{ name, valuation }]
interface ValDivEntry { name: string; valuation: number }
export function ValuationDivisionChart({ data }: { data?: unknown }) {
  if (!isNonEmpty(data)) return null;
  const d = (data as ValDivEntry[]).filter(e => e && typeof e.name === "string" && Number(e.valuation) > 0);
  if (!d.length) return null;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={d} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
        <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={TIP} />
        <Bar dataKey="valuation" radius={[0, 4, 4, 0]}>
          {d.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 4. Equipment by Category ──────────────────────────────────────────────────
// Requires: real equipment categories from the asset ledger with real values.
// Expected shape: [{ name, value }]
interface EquipEntry { name: string; value: number }
export function EquipmentCategoryChart({ data }: { data?: unknown }) {
  if (!isNonEmpty(data)) return null;
  const d = (data as EquipEntry[]).filter(e => e && typeof e.name === "string" && Number(e.value) > 0);
  if (!d.length) return null;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={d} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={3}>
          {d.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={TIP} />
        <Legend iconType="circle" iconSize={8}
          formatter={(n) => <span style={{ color: MUTED, fontSize: 11 }}>{n}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 5. Buyer Engagement Funnel ────────────────────────────────────────────────
// Requires: real engagement stats from report_access_logs.
// Expected shape: [{ stage, count }] — stages from actual tracked events only.
interface FunnelEntry { stage: string; count: number }
export function BuyerEngagementChart({ data }: { data?: unknown }) {
  if (!isNonEmpty(data)) return null;
  const d = (data as FunnelEntry[]).filter(e => e && typeof e.stage === "string" && Number(e.count) > 0);
  if (!d.length) return null;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={d} layout="vertical" margin={{ left: 20, right: 40, top: 5, bottom: 5 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="stage" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
        <Tooltip contentStyle={TIP} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {d.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 6. Lease Risk Distribution ────────────────────────────────────────────────
// Requires: real lease clause analysis results (from seller_lease_clauses).
// Expected shape: [{ subject, score }] — real clause categories only.
interface LeaseEntry { subject: string; score: number }
export function LeaseRiskChart({ data }: { data?: unknown }) {
  if (!isNonEmpty(data)) return null;
  const d = (data as LeaseEntry[]).filter(e => e && typeof e.subject === "string" && typeof e.score === "number");
  if (!d.length) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={d} cx="50%" cy="50%" outerRadius={90}>
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: MUTED, fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Score" dataKey="score" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
        <Tooltip contentStyle={TIP} formatter={(v: number) => `${v}/100`} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── 7. Revenue Source Verification ───────────────────────────────────────────
// Requires: real connected data source revenue figures (Square, Xero, etc.).
// Expected shape: [{ source, amount, verified }]
interface RevSrcEntry { source: string; amount: number; verified?: boolean }
export function RevenueSourceChart({ data }: { data?: unknown }) {
  if (!isNonEmpty(data)) return null;
  const d = (data as RevSrcEntry[]).filter(e => e && typeof e.source === "string" && Number(e.amount) > 0);
  if (!d.length) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={d} margin={{ left: 40, right: 20, top: 5, bottom: 35 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="source" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false}
          angle={-20} textAnchor="end" />
        <YAxis tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={TIP} />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {d.map((e, i) => <Cell key={i} fill={e.verified === false ? "#F59E0B" : "#10B981"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 8. Health Score Breakdown ─────────────────────────────────────────────────
// Requires: category-level scores from the app (not just a single total score).
// Expected shape: [{ subject, score }] — at least 3 scored categories.
interface HealthEntry { subject: string; score: number }
export function HealthScoreChart({ data }: { data?: unknown }) {
  if (!isNonEmpty(data)) return null;
  const d = (data as HealthEntry[]).filter(e => e && typeof e.subject === "string" && typeof e.score === "number");
  if (d.length < 3) return null; // radar needs ≥3 axes to be meaningful
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={d} cx="50%" cy="50%" outerRadius={90}>
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: MUTED, fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Score" dataKey="score" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
        <Tooltip contentStyle={TIP} formatter={(v: number) => `${v}/100`} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Section-key → chart component mapping ────────────────────────────────────
// Charts only render when chartData is present and contains real values.
// Each component silently returns null when its data is missing or empty.
export const SECTION_CHART_MAP: Record<string, React.ComponentType<{ data?: unknown }>> = {
  app_valuation_summary:        ValuationBridgeChart,
  revenue_stream_breakdown:     RevenueDivisionChart,
  division_breakdown:           ValuationDivisionChart,
  plant_equipment_summary:      EquipmentCategoryChart,
  buyer_access_confidentiality: BuyerEngagementChart,
  lease_premises_summary:       LeaseRiskChart,
  verified_revenue_sources:     RevenueSourceChart,
  business_health_score:        HealthScoreChart,
};

// ── Chart data validator ──────────────────────────────────────────────────────
// Returns true only when the section has non-empty chartData that would cause
// its mapped chart component to actually render (used by Data Integrity Panel).
export function sectionHasChartData(sectionKey: string, chartData: unknown): boolean {
  if (!SECTION_CHART_MAP[sectionKey]) return false;
  if (!isNonEmpty(chartData)) return false;
  const data = chartData as Record<string, unknown>[];
  if (sectionKey === "business_health_score") {
    return data.filter(e => typeof e.score === "number").length >= 3;
  }
  return data.length > 0;
}
