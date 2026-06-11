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

// ── 1. Valuation Bridge ───────────────────────────────────────────────────────
interface BridgeEntry { name: string; value: number; type: "start" | "add" | "total" }
const DEMO_BRIDGE: BridgeEntry[] = [
  { name: "EBITDA × 2.5x", value: 450000, type: "start" },
  { name: "Equipment Add-on", value: 85000, type: "add" },
  { name: "Goodwill Premium", value: 65000, type: "add" },
  { name: "Total Valuation", value: 600000, type: "total" },
];
export function ValuationBridgeChart({ data }: { data?: BridgeEntry[] }) {
  const d = data ?? DEMO_BRIDGE;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={d} margin={{ top: 10, right: 10, bottom: 5, left: 50 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={TIP} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {d.map((e, i) => <Cell key={i} fill={e.type === "total" ? "#10B981" : e.type === "add" ? "#8B5CF6" : "#3B82F6"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 2. Revenue by Division ────────────────────────────────────────────────────
interface DivEntry { name: string; value: number }
const DEMO_REV_DIV: DivEntry[] = [
  { name: "Dine-In", value: 45 }, { name: "Takeaway", value: 30 },
  { name: "Delivery", value: 15 }, { name: "Catering", value: 10 },
];
export function RevenueDivisionChart({ data }: { data?: DivEntry[] }) {
  const d = data ?? DEMO_REV_DIV;
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
const DEMO_VAL_DIV = [
  { name: "Main Café", valuation: 350000 },
  { name: "Catering", valuation: 150000 },
  { name: "Retail", valuation: 100000 },
];
export function ValuationDivisionChart({ data }: { data?: typeof DEMO_VAL_DIV }) {
  const d = data ?? DEMO_VAL_DIV;
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
const DEMO_EQUIP = [
  { name: "Kitchen Equipment", value: 45000 },
  { name: "Coffee Equipment", value: 28000 },
  { name: "Front-of-House", value: 12000 },
  { name: "Technology", value: 5000 },
];
export function EquipmentCategoryChart({ data }: { data?: typeof DEMO_EQUIP }) {
  const d = data ?? DEMO_EQUIP;
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
const DEMO_FUNNEL = [
  { stage: "Listing Views", count: 234 }, { stage: "Enquiries", count: 45 },
  { stage: "Inspections", count: 12 }, { stage: "Offers", count: 3 },
];
export function BuyerEngagementChart({ data }: { data?: typeof DEMO_FUNNEL }) {
  const d = data ?? DEMO_FUNNEL;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={d} layout="vertical" margin={{ left: 20, right: 40, top: 5, bottom: 5 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="stage" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
        <Tooltip contentStyle={TIP} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {d.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 6. Lease Risk Distribution ────────────────────────────────────────────────
const DEMO_LEASE = [
  { subject: "Term Security", score: 80 }, { subject: "Rent Review", score: 65 },
  { subject: "Assignment", score: 75 }, { subject: "Make-Good", score: 45 },
  { subject: "Outgoings", score: 70 }, { subject: "Exclusivity", score: 85 },
];
export function LeaseRiskChart({ data }: { data?: typeof DEMO_LEASE }) {
  const d = data ?? DEMO_LEASE;
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
const DEMO_REV_SRC = [
  { source: "Square POS", amount: 380000, verified: true },
  { source: "Xero Accounting", amount: 350000, verified: true },
  { source: "Cash / Other", amount: 45000, verified: false },
];
export function RevenueSourceChart({ data }: { data?: typeof DEMO_REV_SRC }) {
  const d = data ?? DEMO_REV_SRC;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={d} margin={{ left: 40, right: 20, top: 5, bottom: 35 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="source" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false}
          angle={-20} textAnchor="end" />
        <YAxis tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={TIP} />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {d.map((e, i) => <Cell key={i} fill={e.verified ? "#10B981" : "#F59E0B"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 8. Health Score Breakdown ─────────────────────────────────────────────────
const DEMO_HEALTH = [
  { subject: "Financials", score: 85 }, { subject: "Operations", score: 70 },
  { subject: "Lease", score: 65 }, { subject: "Staff", score: 80 },
  { subject: "Equipment", score: 75 }, { subject: "Brand", score: 60 },
];
export function HealthScoreChart({ data }: { data?: typeof DEMO_HEALTH }) {
  const d = data ?? DEMO_HEALTH;
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
export const SECTION_CHART_MAP: Record<string, React.ComponentType<{ data?: unknown }>> = {
  app_valuation_summary:       ValuationBridgeChart  as React.ComponentType<{ data?: unknown }>,
  financial_performance_summary: RevenueSourceChart  as React.ComponentType<{ data?: unknown }>,
  plant_equipment_summary:     EquipmentCategoryChart as React.ComponentType<{ data?: unknown }>,
  lease_premises_summary:      LeaseRiskChart         as React.ComponentType<{ data?: unknown }>,
};
