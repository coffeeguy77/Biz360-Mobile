import { useParams } from "wouter";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Lock, Download, Phone, Calendar, Shield,
  CheckCircle2, FileText, MapPin, Printer, ChevronRight, Eye,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SECTION_CHART_MAP, sectionHasChartData,
} from "@/components/report/ChartComponents";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie, Legend,
} from "recharts";

interface ReportSection {
  id: string;
  sectionKey: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  bulletPoints: string[] | null;
  tableData: unknown;
  chartData: unknown;
  visibility: string;
  includeInHtml: boolean;
  status: string;
  sortOrder: number;
  isLocked?: boolean;
  sellerNotes?: string | null;
}

interface ReportImageEntry {
  id: string;
  url: string;
  cloudinaryPublicId: string;
  imageRole: string;
  displayName: string | null;
  caption: string | null;
  altText: string | null;
  sectionKey: string | null;
  isPrimary: boolean;
  includeInPdf: boolean;
  includeInHtml: boolean;
  includeInBuyerReport: boolean;
  includeInSellerReport: boolean;
  isPanoramic: boolean;
  sortOrder: number;
  sourceType: string;
}

interface ReportVisualEntry {
  id: string;
  sectionKey: string | null;
  title: string;
  subtitle: string | null;
  visualType: string;
  dataSourceType: string;
  chartData: Record<string, unknown> | null;
  status: string;
  sourceLabel: string | null;
  includeInBuyerReport: boolean;
  includeInHtml: boolean;
  sortOrder: number;
  // above_body | below_body (default) | full_width | inline | sidebar
  // inline and sidebar are rendered as below_body in the current layout.
  sectionPlacement?: string | null;
}

interface ReportMeta {
  businessName: string;
  listingId: string;
  location?: string;
  category?: string;
  askingPrice?: number | null;
  badges?: string[];
  heroImageUrl?: string | null;
  reportHeroImageUrl?: string | null;
  tourSrcDoc?: string | null;
  reportImages?: ReportImageEntry[];
  reportVisuals?: ReportVisualEntry[];
}

interface ReportData {
  sections: ReportSection[];
  accessLevel: "public" | "seller" | "approved_buyer";
  meta?: ReportMeta;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function recordAccessLog(listingId: string, eventType: string, extra?: Record<string, string>) {
  fetch("/api/report-access-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingId, eventType, ...extra, userAgent: navigator.userAgent }),
  }).catch(() => {});
}

// ── Sub-components ────────────────────────────────────────────────────────────
function LockedSection({
  title,
  subtitle,
  listingId,
  sectionKey,
}: {
  title: string;
  subtitle: string | null;
  listingId: string;
  sectionKey: string;
}) {
  const [requested, setRequested] = useState(false);
  function handleRequest() {
    setRequested(true);
    recordAccessLog(listingId, "access_requested", { sectionKey });
  }
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 flex flex-col items-center gap-4 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
        <Lock className="text-amber-400" size={24} />
      </div>
      <div>
        <p className="text-amber-300 font-semibold">{title}</p>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      </div>
      <p className="text-slate-400 text-sm max-w-xs">
        This section is available to approved buyers only. Request access to unlock full content.
      </p>
      {requested ? (
        <p className="text-emerald-400 text-sm font-semibold">✓ Access request sent</p>
      ) : (
        <button
          onClick={handleRequest}
          className="mt-1 inline-flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-semibold px-4 py-2 rounded-lg border border-amber-500/30 transition-colors"
        >
          <Shield size={14} />
          Request Access
        </button>
      )}
    </div>
  );
}

const BODY_COLLAPSE_THRESHOLD = 600;

function SectionBodyText({ body }: { body: string }) {
  const paras = body.split(/\n{2,}/).filter(Boolean);
  const fullText = paras.join("\n\n");
  const isLong = fullText.length > BODY_COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  const visibleParas = isLong && !expanded
    ? (() => {
        let chars = 0;
        const result: string[] = [];
        for (const p of paras) {
          if (chars + p.length > BODY_COLLAPSE_THRESHOLD) {
            // Include a truncated first paragraph that goes over the limit
            if (!result.length) result.push(p.slice(0, BODY_COLLAPSE_THRESHOLD) + "…");
            break;
          }
          chars += p.length;
          result.push(p);
        }
        return result;
      })()
    : paras;

  return (
    <div className="space-y-3">
      {visibleParas.map((p, i) => (
        <p key={i} className="text-slate-300 leading-relaxed text-[15px]">{p.trim()}</p>
      ))}
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-semibold mt-1 transition-colors"
        >
          {expanded ? "Show less ▲" : "Show more ▼"}
        </button>
      )}
    </div>
  );
}

function SectionBullets({ bullets }: { bullets: string[] }) {
  const filtered = bullets.filter(Boolean);
  if (!filtered.length) return null;
  return (
    <ul className="space-y-2 mt-3">
      {filtered.map((b, i) => (
        <li key={i} className="flex items-start gap-3 text-slate-300 text-[15px] leading-relaxed">
          <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          {b}
        </li>
      ))}
    </ul>
  );
}

function SectionTable({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return null;
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  return (
    <>
      {/* Mobile stacked cards — shown below sm breakpoint */}
      <div className="sm:hidden mt-4 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-[#1E3A5C] bg-[#0F2040]/40 px-4 py-3 space-y-2">
            {headers.map((h) => (
              <div key={h} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wide flex-shrink-0">
                  {h.replace(/_/g, " ")}
                </span>
                <span className="text-slate-200 text-right break-words max-w-[60%]">
                  {String((row as Record<string, unknown>)[h] ?? "")}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop table — shown at sm and above */}
      <div className="hidden sm:block mt-4 overflow-x-auto rounded-xl border border-[#1E3A5C]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0F2040]">
              {headers.map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">
                  {h.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={cn("border-t border-[#1E3A5C]", i % 2 === 0 ? "bg-transparent" : "bg-[#0F2040]/40")}>
                {headers.map((h) => (
                  <td key={h} className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                    {String((row as Record<string, unknown>)[h] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}


// ── Section image strip (from report_images) ──────────────────────────────────
function SectionImageStrip({
  images,
  printMode,
}: {
  images: ReportImageEntry[];
  printMode: boolean;
}) {
  if (!images.length) return null;
  return (
    <div className={cn("mt-5 rounded-xl overflow-hidden border", printMode ? "border-slate-200" : "border-[#1E3A5C]")}>
      <div className={cn(
        "flex gap-2 overflow-x-auto p-3",
        images.length === 1 ? "justify-center" : "",
      )}>
        {images.map((img) => {
          // Build 400w crop/fill Cloudinary thumbnail (spec: section card thumbnails)
          const thumbUrl = img.cloudinaryPublicId
            ? `https://res.cloudinary.com/${(img.url.match(/cloudinary\.com\/([^/]+)/) ?? [])[1] ?? "biz360"}/image/upload/w_400,c_fill,q_auto,f_auto/${img.cloudinaryPublicId}`
            : img.url;
          return (
            <div key={img.id} className="flex-shrink-0" style={{ maxWidth: images.length === 1 ? "100%" : "48%" }}>
              <img
                src={thumbUrl}
                alt={img.altText ?? img.displayName ?? "Section image"}
                className={cn(
                  "rounded-lg object-cover w-full",
                  images.length === 1 ? "max-h-64" : "h-40",
                )}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              {img.caption && (
                <p className={cn("text-xs mt-1.5 text-center px-1", printMode ? "text-slate-500" : "text-slate-400")}>
                  {img.caption}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Report Visual Block ───────────────────────────────────────────────────────
// Renders a single saved report visual entry from meta.reportVisuals.
// Returns null silently if chartData is absent or doesn't match the visual type.
const VIZ_PALETTE = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];
const VIZ_TIP: React.CSSProperties = {
  backgroundColor: "#0F2040", border: "1px solid #1E3A5C",
  borderRadius: 8, color: "#e2e8f0", fontSize: 12,
};

function ReportVisualBlock({ visual, printMode }: { visual: ReportVisualEntry; printMode: boolean }) {
  const d = visual.chartData ?? {};
  if (!visual.chartData) return null;

  let content: React.ReactNode = null;

  switch (visual.visualType) {
    case "stat_card": {
      const metrics = (d.metrics as Array<{ label: string; value: unknown }>) ?? [];
      const m = metrics[0];
      if (!m) return null;
      content = (
        <div className="text-center py-3">
          <div className={cn("text-3xl font-bold", printMode ? "text-blue-600" : "text-blue-400")}>{String(m.value)}</div>
          <div className={cn("text-sm mt-1", printMode ? "text-slate-500" : "text-slate-400")}>{m.label}</div>
        </div>
      );
      break;
    }
    case "metric_grid": {
      const metrics = (d.metrics as Array<{ label: string; value: unknown }>) ?? [];
      if (!metrics.length) return null;
      content = (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.slice(0, 4).map((m, i) => (
            <div key={i} className={cn("rounded-xl p-3 text-center", printMode ? "bg-blue-50 border border-blue-100" : "bg-blue-500/10")}>
              <div className={cn("text-lg font-bold", printMode ? "text-blue-700" : "text-blue-300")}>{String(m.value)}</div>
              <div className={cn("text-xs mt-1", printMode ? "text-slate-500" : "text-slate-400")}>{m.label}</div>
            </div>
          ))}
        </div>
      );
      break;
    }
    case "table": {
      const rows = (d.rows as Array<{ label: string; value: unknown }>) ?? [];
      if (!rows.length) return null;
      content = (
        <div className={cn("rounded-lg overflow-hidden border", printMode ? "border-slate-200" : "border-slate-700/50")}>
          {rows.map((r, i) => (
            <div key={i} className={cn("flex justify-between px-4 py-2 text-sm",
              printMode ? (i % 2 === 0 ? "bg-slate-50" : "bg-white") : (i % 2 === 0 ? "bg-slate-800/30" : ""))}>
              <span className={printMode ? "text-slate-600" : "text-slate-400"}>{r.label}</span>
              <span className={cn("font-semibold", printMode ? "text-slate-900" : "text-white")}>{String(r.value ?? "—")}</span>
            </div>
          ))}
        </div>
      );
      break;
    }
    case "bar_chart":
    case "horizontal_bar_chart": {
      const bars = (d.bars as Array<{ label: string; value: unknown; raw?: number }>) ?? [];
      if (!bars.length) return null;
      const isHoriz = visual.visualType === "horizontal_bar_chart";
      content = (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bars} layout={isHoriz ? "vertical" : "horizontal"}
            margin={{ left: isHoriz ? 60 : 0, right: 20, top: 5, bottom: isHoriz ? 5 : 20 }}>
            <CartesianGrid stroke="#1E3A5C" {...(isHoriz ? { horizontal: false } : { vertical: false })} />
            {isHoriz ? (
              <>
                <XAxis type="number" tick={{ fill: "#8B9CB8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fill: "#8B9CB8", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tick={{ fill: "#8B9CB8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8B9CB8", fontSize: 10 }} axisLine={false} tickLine={false} />
              </>
            )}
            <Tooltip contentStyle={VIZ_TIP} />
            <Bar dataKey={bars[0]?.raw != null ? "raw" : "value"} radius={isHoriz ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
              {bars.map((_, i) => <Cell key={i} fill={VIZ_PALETTE[i % VIZ_PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
      break;
    }
    case "donut_chart": {
      const slices = (d.slices as Array<{ label: string; value: unknown }>) ?? [];
      if (!slices.length) return null;
      const total = slices.reduce((s, sl) => s + Number(sl.value ?? 0), 0) || 1;
      content = (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart margin={{ top: 24, bottom: 8, left: 24, right: 24 }}>
            <Pie data={slices} dataKey="value" nameKey="label" cx="50%" cy="50%"
              innerRadius={52} outerRadius={88} paddingAngle={3}
              label={({ cx: pcx, cy: pcy, midAngle, outerRadius: or, value }) => {
                const RADIAN = Math.PI / 180;
                const r = or + 22;
                const x = pcx + r * Math.cos(-midAngle * RADIAN);
                const y2 = pcy + r * Math.sin(-midAngle * RADIAN);
                const pct = Math.round((Number(value) / total) * 100);
                return (
                  <text x={x} y={y2} fill="#8B9CB8" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
                    {`${pct}%`}
                  </text>
                );
              }}
              labelLine={false}>
              {slices.map((_, i) => <Cell key={i} fill={VIZ_PALETTE[i % VIZ_PALETTE.length]} />)}
            </Pie>
            <Tooltip contentStyle={VIZ_TIP} formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
            <Legend iconType="circle" iconSize={8}
              formatter={(n) => <span style={{ color: "#8B9CB8", fontSize: 11 }}>{n}</span>} />
          </PieChart>
        </ResponsiveContainer>
      );
      break;
    }
    case "valuation_bridge": {
      if (!d.rawAdjustedEbitda && !d.rawEquipmentValue) return null;
      const mult = 2.25;
      const bridgeData = [
        { name: "Adj. EBITDA × Multiple", value: Math.round(Number(d.rawAdjustedEbitda ?? 0) * mult), type: "start" },
        { name: "Equipment",              value: Math.round(Number(d.rawEquipmentValue ?? 0)),          type: "add"   },
        { name: "Est. Value",             value: Math.round(Number(d.rawAdjustedEbitda ?? 0) * mult + Number(d.rawEquipmentValue ?? 0)), type: "total" },
      ];
      content = (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bridgeData} margin={{ left: 40, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid vertical={false} stroke="#1E3A5C" />
            <XAxis dataKey="name" tick={{ fill: "#8B9CB8", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8B9CB8", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={VIZ_TIP} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {bridgeData.map((e, i) => (
                <Cell key={i} fill={e.type === "total" ? "#10B981" : e.type === "add" ? "#8B5CF6" : "#3B82F6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
      break;
    }
    case "funnel": {
      const funnel = (d.funnel as Array<{ label: string; value: number; pct: number }>) ?? [];
      const active = funnel.filter((f) => f.value > 0);
      if (!active.length) return null;
      content = (
        <div className="space-y-2">
          {active.slice(0, 8).map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className={cn("w-36 text-xs truncate", printMode ? "text-slate-500" : "text-slate-400")}>{f.label}</span>
              <div className={cn("flex-1 rounded-full h-2 overflow-hidden", printMode ? "bg-slate-200" : "bg-slate-700/40")}>
                <div className="h-2 rounded-full bg-violet-500" style={{ width: `${f.pct}%` }} />
              </div>
              <span className={cn("w-8 text-right text-xs font-semibold", printMode ? "text-slate-900" : "text-white")}>{f.value}</span>
            </div>
          ))}
        </div>
      );
      break;
    }
    case "checklist": {
      const items = (d.items as Array<{ label: string; status: string }>) ?? [];
      if (!items.length) return null;
      content = (
        <div className="space-y-1.5">
          {items.map((item, i) => {
            const isAvail   = item.status === "available";
            const isPending = item.status === "pending";
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={isAvail ? "text-green-400" : isPending ? "text-amber-400" : "text-red-400"}>
                  {isAvail ? "✓" : isPending ? "○" : "✕"}
                </span>
                <span className={printMode ? "text-slate-700" : "text-slate-300"}>{item.label}</span>
              </div>
            );
          })}
        </div>
      );
      break;
    }
    case "score_card": {
      const score = Number(d.score ?? 0);
      content = (
        <div className="text-center py-3">
          <div className={cn("text-5xl font-bold",
            score >= 70 ? "text-green-400" : score >= 40 ? "text-amber-400" : "text-red-400")}>
            {score}
          </div>
          <div className={cn("text-sm mt-1", printMode ? "text-slate-500" : "text-slate-400")}>{String(d.label ?? "Score")}</div>
        </div>
      );
      break;
    }
    default:
      return null;
  }

  if (!content) return null;

  return (
    <div className={cn("rounded-xl border p-4 mt-4", printMode ? "bg-white border-slate-200" : "bg-[#0A1828]/60 border-[#1E3A5C]/60")}>
      <div className="mb-3">
        <div className={cn("text-sm font-semibold", printMode ? "text-slate-900" : "text-white")}>{visual.title}</div>
        {visual.subtitle && (
          <div className={cn("text-xs mt-0.5", printMode ? "text-slate-500" : "text-slate-400")}>{visual.subtitle}</div>
        )}
      </div>
      {content}
      {visual.sourceLabel && (
        <div className={cn("text-xs mt-2 text-right", printMode ? "text-slate-400" : "text-slate-500")}>
          Source: {visual.sourceLabel}
        </div>
      )}
    </div>
  );
}

function SectionContent({
  section,
  listingId,
  reportImages,
  printMode,
  tourSrcDoc,
  inlineVisuals,
}: {
  section: ReportSection;
  listingId: string;
  reportImages?: ReportImageEntry[];
  printMode: boolean;
  tourSrcDoc?: string | null;
  inlineVisuals?: ReportVisualEntry[];
}) {
  const ChartComponent = SECTION_CHART_MAP[section.sectionKey];
  const chartData = section.chartData
    ? (typeof section.chartData === "string" ? JSON.parse(section.chartData) : section.chartData)
    : undefined;

  const hasContent = section.body || (section.bulletPoints?.length ?? 0) > 0 || section.tableData;
  const is360 = section.sectionKey === "360_business_walkthrough";

  // Resolve 360 tour display from chartData.
  // Priority: explicit URL → raw HTML srcdoc → KV-built tourSrcDoc (from meta prop).
  let tourUrl: string | null = null;
  let chartSrcDoc: string | null = null;
  if (is360 && chartData != null) {
    if (typeof chartData === "string" && /^https?:\/\//.test(chartData)) {
      tourUrl = chartData;
    } else if (typeof chartData === "string" && chartData.trimStart().startsWith("<")) {
      // Raw Pannellum HTML stored directly in chartData — embed as srcDoc.
      chartSrcDoc = chartData;
    } else if (typeof chartData === "object" && !Array.isArray(chartData)) {
      const cd = chartData as Record<string, unknown>;
      const raw = cd.url ?? cd.tourUrl ?? cd.src ?? cd.iframe ?? cd.link ?? cd.pannellumUrl ?? "";
      if (raw && /^https?:\/\//.test(String(raw))) tourUrl = String(raw);
      // Also check if chartData itself contains an embedded srcdoc string.
      if (!tourUrl && typeof cd.srcDoc === "string" && cd.srcDoc.trimStart().startsWith("<")) {
        chartSrcDoc = cd.srcDoc;
      }
    }
  }
  // Resolved srcDoc: prefer chartData-derived HTML over server-built KV HTML.
  const resolvedSrcDoc = chartSrcDoc ?? tourSrcDoc ?? null;

  // Only render chart wrapper when there is real data to show
  const chartWillRender = ChartComponent && sectionHasChartData(section.sectionKey, chartData);
  const hasAnything = hasContent || chartWillRender || is360;

  // Find report_images that belong to this section — match by sectionKey first, then
  // fall back to role-based match for typical roles associated with this section type.
  const SECTION_ROLE_MAP: Record<string, string[]> = {
    business_overview:          ["interior", "listing_hero"],
    plant_equipment_summary:    ["equipment"],
    lease_premises_summary:     ["exterior"],
    staff_owner_involvement:    ["team"],
    brand_digital_assets:       ["product"],
    "360_business_walkthrough": ["360_preview"],
  };
  const sectionImages: ReportImageEntry[] = reportImages
    ? (() => {
        const bySectionKey = reportImages.filter(
          (img) => img.sectionKey === section.sectionKey && !img.isPanoramic,
        );
        if (bySectionKey.length) return bySectionKey.slice(0, 3);
        const roleMatches = SECTION_ROLE_MAP[section.sectionKey] ?? [];
        if (!roleMatches.length) return [];
        return reportImages
          .filter((img) => roleMatches.includes(img.imageRole))
          .slice(0, 2);
      })()
    : [];

  return (
    <div className="space-y-4">
      {!hasAnything && (
        <p className="text-slate-500 italic text-sm">This section has not yet been completed.</p>
      )}
      {section.body && <SectionBodyText body={section.body} />}
      {/* inline visuals — embedded in section flow after body text, before bullets */}
      {inlineVisuals && inlineVisuals.length > 0 && (
        <div className="space-y-3">
          {inlineVisuals.map((v) =>
            v.status === "ready"
              ? <ReportVisualBlock key={v.id} visual={v} printMode={printMode} />
              : (
                <div key={v.id} className={cn(
                  "rounded-xl border p-4 flex items-center gap-3",
                  printMode ? "bg-slate-50 border-slate-200" : "bg-[#0A1828]/40 border-[#1E3A5C]/40"
                )}>
                  <AlertTriangle size={14} className="text-slate-500 flex-shrink-0" />
                  <div>
                    <div className={cn("text-sm font-semibold", printMode ? "text-slate-600" : "text-slate-400")}>{v.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Data not available — chart pending source data</div>
                  </div>
                </div>
              )
          )}
        </div>
      )}
      {section.bulletPoints && section.bulletPoints.length > 0 && (
        <SectionBullets bullets={section.bulletPoints} />
      )}
      {!!section.tableData && <SectionTable data={section.tableData} />}
      {chartWillRender && (
        <div className="mt-6 p-4 rounded-xl bg-[#070F1C]/60 border border-[#1E3A5C]/60">
          <ChartComponent data={chartData} />
        </div>
      )}
      {/* Section images from report_images — rendered below charts/text */}
      {sectionImages.length > 0 && (
        <SectionImageStrip images={sectionImages} printMode={printMode} />
      )}
      {is360 && (
        tourUrl ? (
          <div className="mt-4 rounded-xl overflow-hidden border border-[#1E3A5C] bg-black" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={tourUrl}
              className="w-full h-full"
              allow="fullscreen; xr-spatial-tracking"
              title="360° Business Walkthrough"
              onLoad={() => recordAccessLog(listingId, "tour_clicked", { sectionKey: section.sectionKey })}
            />
          </div>
        ) : resolvedSrcDoc ? (
          <div className="mt-4 rounded-xl overflow-hidden border border-[#1E3A5C] bg-black" style={{ aspectRatio: "16/9" }}>
            <iframe
              srcDoc={resolvedSrcDoc}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full"
              allow="fullscreen; xr-spatial-tracking"
              title="360° Business Walkthrough"
              onLoad={() => recordAccessLog(listingId, "tour_clicked", { sectionKey: section.sectionKey })}
            />
          </div>
        ) : (
          <div className="mt-4 flex justify-center">
            <p className="text-slate-500 italic text-sm">No virtual tour uploaded yet.</p>
          </div>
        )
      )}
    </div>
  );
}

// ── Chapter grouping ──────────────────────────────────────────────────────────
interface ReportGroup { key: string; title: string; sectionKeys: string[]; }

// 13-chapter map — must stay in sync with api-server/src/lib/report-groups.ts
const REPORT_GROUPS: ReportGroup[] = [
  { key: "executive_summary",   title: "Executive Summary",               sectionKeys: ["executive_summary","key_selling_points","reason_for_sale"] },
  { key: "business_overview",   title: "Business Overview",               sectionKeys: ["business_overview","buyer_suitability","training_handover"] },
  { key: "financial_performance", title: "Financial Performance",          sectionKeys: ["financial_performance_summary","verified_revenue_sources","division_breakdown","revenue_stream_breakdown"] },
  { key: "valuation",           title: "Valuation & Pricing",             sectionKeys: ["app_valuation_summary","valuation_methodology","valuation_range_explanation","business_health_score"] },
  { key: "earnings_adjustments", title: "Earnings & Adjustments",         sectionKeys: ["cogs_mapping_summary","addbacks_adjusted_ebitda"] },
  { key: "assets_equipment",    title: "Assets & Equipment",              sectionKeys: ["plant_equipment_summary","sale_inclusions","sale_exclusions","stock_working_capital"] },
  { key: "lease_premises",      title: "Lease & Premises",                sectionKeys: ["lease_premises_summary","lease_risk_valuation_impact","business_location_market_context","canberra_location_explainer"] },
  { key: "staff_operations",    title: "Staff & Operations",              sectionKeys: ["staff_owner_involvement","operations_systems"] },
  { key: "brand_customers",     title: "Brand, Customers & Suppliers",    sectionKeys: ["supplier_summary","customer_base","brand_digital_assets","reviews_reputation"] },
  { key: "growth_risk",         title: "Growth & Risk",                   sectionKeys: ["growth_opportunities","risks_mitigations","swot_analysis"] },
  { key: "virtual_tour",        title: "Virtual Tour & Property",         sectionKeys: ["360_business_walkthrough","key_tour_highlights"] },
  { key: "due_diligence",       title: "Due Diligence",                   sectionKeys: ["due_diligence_documents_available","verified_information","buyer_access_confidentiality"] },
  { key: "buyer_pack",          title: "Buyer Pack & Next Steps",         sectionKeys: ["next_steps","disclaimer"] },
];

// ── Section number → visual style ─────────────────────────────────────────────
const ACCENT_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1",
];

// ── Main Report Page ──────────────────────────────────────────────────────────
export function ReportPage() {
  // versionId may come from route param (/reports/:listingId/:versionId)
  // or from query string (?v=...) for legacy links.
  const params = useParams<{ listingId: string; versionId?: string }>();
  const listingId = params.listingId ?? "";
  const urlParams = new URLSearchParams(window.location.search);
  const versionId    = params.versionId ?? urlParams.get("v") ?? undefined;
  const accessToken  = urlParams.get("accessToken") ?? undefined;
  // ?previewCode= is a short-lived (90s) one-time code issued by the API.
  // The mobile "Preview Report" button exchanges the seller JWT for a previewCode
  // server-side, so the long-lived JWT never appears in the browser URL / history.
  const previewCode  = urlParams.get("previewCode") ?? undefined;

  const [data, setData]               = useState<ReportData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [printMode, setPrintMode]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Token obtained by exchanging a one-time previewCode (stored in sessionStorage
  // so re-renders within the same tab don't re-fire the already-consumed code).
  const [previewToken, setPreviewToken] = useState<string | null>(() => {
    if (!previewCode) return null;
    return sessionStorage.getItem(`preview_tok_${previewCode.slice(0, 8)}`) ?? null;
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // Exchange the one-time previewCode for a short-lived JWT on first load.
  useEffect(() => {
    if (!previewCode || previewToken) return;
    fetch("/api/report-preview-tokens/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewCode }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { token?: string } | null) => {
        if (d?.token) {
          sessionStorage.setItem(`preview_tok_${previewCode.slice(0, 8)}`, d.token);
          setPreviewToken(d.token);
        }
      })
      .catch(() => {/* non-fatal — falls back to public view */});
  }, [previewCode, previewToken]);

  useEffect(() => {
    if (!listingId) { setError("No listing ID provided."); setLoading(false); return; }
    // Wait for previewCode exchange to complete before fetching data
    if (previewCode && !previewToken) return;
    setLoading(true);

    // Resolve bearer token: prefer exchanged previewToken (mobile seller preview)
    // over localStorage. The raw JWT is never passed in the URL.
    const authToken = previewToken || localStorage.getItem("biz360_auth_token") || null;

    // Build query string helper (appends accessToken when present)
    function qs(base: string): string {
      const at = accessToken;
      return at ? `${base}${base.includes("?") ? "&" : "?"}accessToken=${encodeURIComponent(at)}` : base;
    }

    if (versionId) {
      // Versioned view: sellers use the auth-required snapshot endpoint (full view);
      // unauthenticated/buyer viewers use the public-snapshot endpoint (published-only,
      // seller_only sections filtered out). accessToken is forwarded so approved_buyers
      // sections can be unlocked for OTP-verified buyers on versioned links.
      const endpoint = authToken
        ? `/api/report-versions/snapshot/${versionId}`
        : qs(`/api/report-versions/public-snapshot/${versionId}`);
      fetch(endpoint, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      })
        .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
        .then((json: { sections: ReportSection[]; title?: string }) =>
          setData({ sections: json.sections, accessLevel: authToken ? "seller" : "public" }))
        .catch(() => {
          // Fall back to live sections if snapshot not accessible
          fetch(qs(`/api/report-sections/html/${listingId}`), {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          })
            .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
            .then((json: ReportData) => setData(json))
            .catch((e) => setError(String(e)));
        })
        .finally(() => setLoading(false));
    } else {
      // Live view: send seller token if present (unlocks approved_buyers + seller_only sections).
      // accessToken forwarded so OTP-verified buyers can unlock approved_buyers sections.
      fetch(qs(`/api/report-sections/html/${listingId}`), {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      })
        .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
        .then((json: ReportData) => setData(json))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    recordAccessLog(listingId, "report_viewed", versionId ? { versionId } : {});
  }, [listingId, versionId, accessToken, previewToken, previewCode]);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      // If the buyer has a verified accessToken, include approved_buyers sections.
      // Otherwise fall back to the teaser-only public PDF.
      const endpoint = accessToken
        ? `/api/report-exports/pdf-public/${listingId}?accessToken=${encodeURIComponent(accessToken)}`
        : `/api/report-exports/pdf-public/${listingId}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `im-report-${listingId}.pdf`; a.click();
      URL.revokeObjectURL(url);
      recordAccessLog(listingId, "pdf_downloaded", { mode: accessToken ? "buyer_approved" : "buyer_public" });
    } catch {
      alert("Could not generate PDF. Please try again.");
    } finally { setDownloading(false); }
  }

  function handlePrint() {
    window.print();
    recordAccessLog(listingId, "report_printed");
  }

  // ── SECTIONS ──────────────────────────────────────────────────────────────
  const sections = (data?.sections ?? []).filter((s) => s.includeInHtml);
  const businessName = data?.meta?.businessName ?? "Confidential Business";

  // Build chapter groups — only include groups that have ≥1 visible section
  const groupedSections = REPORT_GROUPS.map((g) => ({
    ...g,
    sections: g.sectionKeys
      .map((k) => sections.find((s) => s.sectionKey === k))
      .filter(Boolean) as ReportSection[],
  })).filter((g) => g.sections.length > 0);

  // Flat list for backward-compat (ungrouped sections not in any chapter)
  const allGroupedKeys = new Set(REPORT_GROUPS.flatMap((g) => g.sectionKeys));
  const ungroupedSections = sections.filter((s) => !allGroupedKeys.has(s.sectionKey));

  const [activeChapter, setActiveChapter] = useState<string | null>(null);


  // IntersectionObserver — highlights the chapter link in sidebar + tab strip
  // as the user scrolls, using a top-biased rootMargin so the active chapter
  // updates as soon as its header enters the top 30% of the viewport.
  useEffect(() => {
    if (groupedSections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          if (id.startsWith("chapter-")) setActiveChapter(id.slice("chapter-".length));
        }
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );
    groupedSections.forEach((g) => {
      const el = document.getElementById(`chapter-${g.key}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [groupedSections]);

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", printMode ? "bg-white" : "bg-[#070F1C]")}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading Information Memorandum…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#070F1C] flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <FileText className="mx-auto text-slate-500" size={40} />
          <p className="text-white font-semibold">Report not available</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("min-h-screen font-sans", printMode ? "bg-white text-slate-900 print-mode" : "bg-[#070F1C] text-white")}>

      {/* ── Sticky Nav ─────────────────────────────────────────────────────── */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b print:hidden transition-colors",
        printMode ? "bg-white border-slate-200" : "bg-[#070F1C]/95 backdrop-blur border-[#1E3A5C]"
      )}>
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("text-xs font-bold tracking-wider", printMode ? "text-slate-400" : "text-blue-500")}>
              EXIT360
            </span>
            <span className={printMode ? "text-slate-300" : "text-[#1E3A5C]"}>/</span>
            <span className={cn("text-sm font-semibold truncate", printMode ? "text-slate-700" : "text-white")}>
              {businessName}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setPrintMode((p) => !p)}
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                printMode
                  ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                  : "bg-[#0F2040] border-[#1E3A5C] text-slate-400 hover:text-white"
              )}
            >
              <Printer size={12} />
              {printMode ? "Dark Mode" : "Print Mode"}
            </button>
            <button
              onClick={() => handleDownloadPdf()}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
            >
              <Download size={12} />
              {downloading ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Cover Section ──────────────────────────────────────────────────── */}
      <section id="cover" className={cn(
        "pt-14 min-h-[72vh] flex flex-col justify-center relative overflow-hidden",
        printMode ? "bg-slate-50 border-b border-slate-200" : "bg-gradient-to-br from-[#02060E] via-[#070F1C] to-[#0A1A30]"
      )}>
        {!printMode && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.12),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.08),transparent_60%)]" />
          </>
        )}
        <div className="relative max-w-5xl mx-auto px-6 py-16">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border",
              printMode ? "bg-red-50 border-red-200 text-red-700" : "bg-red-500/10 border-red-500/20 text-red-400"
            )}>
              <Shield size={11} /> CONFIDENTIAL
            </span>
            <span className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border",
              printMode ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
            )}>
              <CheckCircle2 size={11} /> Exit360 Verified
            </span>
          </div>

          <p className={cn("text-sm font-semibold uppercase tracking-widest mb-2", printMode ? "text-slate-400" : "text-blue-400")}>
            Information Memorandum
          </p>
          <h1 className={cn("text-4xl md:text-5xl font-bold mb-3 leading-tight", printMode ? "text-slate-900" : "text-white")}>
            {businessName}
          </h1>

          {/* Business metadata row: location · category · asking price */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
            {data?.meta?.category && (
              <span className={cn("text-sm", printMode ? "text-slate-500" : "text-slate-400")}>
                🏷️ {data.meta.category}
              </span>
            )}
            {data?.meta?.location && (
              <span className={cn("text-sm", printMode ? "text-slate-500" : "text-slate-400")}>
                📍 {data.meta.location}
              </span>
            )}
            {data?.meta?.askingPrice != null && (
              <span className={cn("text-sm font-semibold", printMode ? "text-emerald-700" : "text-emerald-400")}>
                💰 {data.meta.askingPrice >= 1_000_000
                  ? `$${(data.meta.askingPrice / 1_000_000).toFixed(2)}M`
                  : data.meta.askingPrice >= 1_000
                  ? `$${(data.meta.askingPrice / 1_000).toFixed(0)}K`
                  : `$${data.meta.askingPrice.toLocaleString()}`}
              </span>
            )}
          </div>

          {/* Extra badges from listing data */}
          {(data?.meta?.badges ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {(data!.meta!.badges!).map((badge) => (
                <span key={badge} className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border",
                  printMode ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                )}>
                  <CheckCircle2 size={10} /> {badge}
                </span>
              ))}
            </div>
          )}

          {/* Hero image — rendered when the listing has a cover photo set */}
          {data?.meta?.heroImageUrl && (
            <div className={cn(
              "mb-6 rounded-2xl overflow-hidden border max-h-72",
              printMode ? "border-slate-200" : "border-[#1E3A5C]"
            )}>
              <img
                src={data.meta.heroImageUrl}
                alt={`${businessName} — cover photo`}
                className="w-full h-72 object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          <p className={cn("text-base mb-8", printMode ? "text-slate-500" : "text-slate-400")}>
            Confidential Business Profile · Prepared by Exit360
          </p>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Listing Ref.", value: listingId.slice(0, 8).toUpperCase(), icon: FileText },
              { label: "Sections", value: `${sections.length} Sections`, icon: Eye },
              { label: "Access Level", value: data?.accessLevel === "seller" ? "Seller View" : "Buyer View", icon: Shield },
              { label: "Report Date", value: new Date().toLocaleDateString("en-AU", { month: "short", year: "numeric" }), icon: Calendar },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className={cn(
                "rounded-xl p-3 border",
                printMode ? "bg-white border-slate-200" : "bg-[#0F2040]/80 border-[#1E3A5C]"
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} className={printMode ? "text-slate-400" : "text-slate-500"} />
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider", printMode ? "text-slate-400" : "text-slate-500")}>{label}</span>
                </div>
                <p className={cn("text-sm font-bold", printMode ? "text-slate-900" : "text-white")}>{value}</p>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              onClick={() => handleDownloadPdf()}
              disabled={downloading}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              <Download size={15} /> Download PDF
            </button>
            <button
              onClick={() => recordAccessLog(listingId, "contact_clicked")}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors",
                printMode ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-[#0F2040] border-[#1E3A5C] text-slate-300 hover:text-white"
              )}
            >
              <Phone size={15} /> Contact Seller
            </button>
            <button
              onClick={() => recordAccessLog(listingId, "inspection_booked")}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors",
                printMode ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-[#0F2040] border-[#1E3A5C] text-slate-300 hover:text-white"
              )}
            >
              <Calendar size={15} /> Book Inspection
            </button>
            <button
              onClick={() => recordAccessLog(listingId, "document_requested")}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors",
                printMode ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-[#0F2040] border-[#1E3A5C] text-slate-300 hover:text-white"
              )}
            >
              <FileText size={15} /> Request Docs
            </button>
          </div>
        </div>
      </section>


      {/* ── Chapter Nav (sticky horizontal tab strip) ───────────────────────── */}
      {groupedSections.length > 0 && (
        <div className={cn(
          "sticky top-12 z-40 border-b overflow-x-auto print:hidden",
          printMode ? "bg-white border-slate-200" : "bg-[#0A1828]/95 backdrop-blur border-[#1E3A5C]"
        )}>
          <div className="max-w-5xl mx-auto px-4 flex items-center gap-1 py-1.5 min-w-max">
            {groupedSections.map((g, i) => (
              <a
                key={g.key}
                href={`#chapter-${g.key}`}
                onClick={() => setActiveChapter(g.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  activeChapter === g.key
                    ? "bg-blue-600 text-white"
                    : printMode
                    ? "text-slate-600 hover:bg-slate-100"
                    : "text-slate-400 hover:text-white hover:bg-[#1E3A5C]/60"
                )}
              >
                <span className={cn(
                  "text-[9px] font-bold",
                  activeChapter === g.key ? "text-blue-200" : "text-blue-500"
                )}>{String(i + 1).padStart(2, "0")}</span>
                {g.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Table of Contents ───────────────────────────────────────────────── */}
      {groupedSections.length > 0 && (
        <nav className={cn(
          "border-b py-8 print:hidden",
          printMode ? "bg-slate-50 border-slate-200" : "bg-[#0F2040]/60 border-[#1E3A5C]"
        )}>
          <div className="max-w-5xl mx-auto px-6">
            <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-5", printMode ? "text-slate-400" : "text-slate-500")}>
              Contents
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
              {groupedSections.map((g, i) => (
                <div key={g.key} className="mb-4">
                  <a
                    href={`#chapter-${g.key}`}
                    className={cn(
                      "flex items-center gap-2 py-1 text-sm font-semibold transition-colors",
                      printMode ? "text-slate-700 hover:text-slate-900" : "text-white hover:text-blue-400"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      printMode ? "bg-blue-50 text-blue-600" : "bg-blue-500/20 text-blue-400"
                    )}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {g.title}
                  </a>
                  <div className="pl-7 space-y-0.5 mt-0.5">
                    {g.sections.slice(0, 4).map((s) => (
                      <a
                        key={s.id}
                        href={`#${s.sectionKey}`}
                        className={cn(
                          "flex items-center gap-1.5 py-0.5 text-xs transition-colors",
                          printMode ? "text-slate-500 hover:text-slate-700" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        <ChevronRight size={10} className="flex-shrink-0" />
                        {s.title}
                        {s.isLocked && <Lock size={9} className="text-amber-400 flex-shrink-0" />}
                      </a>
                    ))}
                    {g.sections.length > 4 && (
                      <p className={cn("text-[10px] pl-4", printMode ? "text-slate-400" : "text-slate-600")}>
                        +{g.sections.length - 4} more
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* ── Desktop sidebar ───────────────────────────────────────────────────── */}
      {groupedSections.length > 0 && (
        <aside className={cn(
          "hidden xl:flex flex-col fixed left-0 top-14 bottom-0 w-52 overflow-y-auto border-r z-30 py-5 print:hidden",
          printMode ? "bg-white border-slate-200" : "bg-[#070F1C]/98 border-[#1E3A5C]"
        )}>
          <p className={cn("text-[9px] font-bold uppercase tracking-widest px-4 mb-3", printMode ? "text-slate-400" : "text-slate-600")}>
            Chapters
          </p>
          {groupedSections.map((g, i) => (
            <a
              key={g.key}
              href={`#chapter-${g.key}`}
              onClick={() => setActiveChapter(g.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs transition-colors border-l-2",
                activeChapter === g.key
                  ? "border-blue-500 bg-blue-500/10 text-blue-300 font-semibold"
                  : printMode
                  ? "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  : "border-transparent text-slate-500 hover:bg-[#1E3A5C]/40 hover:text-white"
              )}
            >
              <span className={cn(
                "text-[9px] font-bold flex-shrink-0 w-5",
                activeChapter === g.key ? "text-blue-400" : "text-blue-600"
              )}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="truncate">{g.title}</span>
            </a>
          ))}
        </aside>
      )}

      {/* ── Chapter Groups ────────────────────────────────────────────────────── */}
      <main className={cn("px-6 py-10 space-y-14", groupedSections.length > 0 ? "xl:pl-56 max-w-5xl xl:max-w-none xl:ml-52 xl:mr-auto xl:pr-8" : "max-w-5xl mx-auto")}>
        {groupedSections.map((group, gIdx) => {
          const chapterAccent = ACCENT_COLORS[gIdx % ACCENT_COLORS.length];
          let sectionCounter = 0;
          return (
            <div key={group.key} id={`chapter-${group.key}`} className="scroll-mt-24">
              {/* Chapter header */}
              <div className={cn(
                "flex items-center gap-4 mb-6 pb-4 border-b",
                printMode ? "border-slate-200" : "border-[#1E3A5C]"
              )}>
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: chapterAccent + "22", color: chapterAccent }}
                >
                  {String(gIdx + 1).padStart(2, "0")}
                </div>
                <div>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-0.5", printMode ? "text-slate-400" : "text-slate-500")}>
                    Chapter {gIdx + 1}
                  </p>
                  <h2 className={cn("text-xl font-bold", printMode ? "text-slate-900" : "text-white")}>
                    {group.title}
                  </h2>
                </div>
              </div>

              {/* Chapter metric cards — for valuation, assets, lease, and tour chapters */}
              {(() => {
                const METRIC_CHAPTERS = new Set(["valuation", "assets_equipment", "lease_premises", "virtual_tour"]);
                if (!METRIC_CHAPTERS.has(group.key)) return null;
                // Extract up to 4 metrics from the first section with tableData
                const metrics: { label: string; value: string }[] = [];
                for (const sec of group.sections) {
                  if (!sec.tableData) continue;
                  let rows: Record<string, unknown>[] | null = null;
                  if (typeof sec.tableData === "string") {
                    try { rows = JSON.parse(sec.tableData); } catch { rows = null; }
                  } else if (Array.isArray(sec.tableData)) {
                    rows = sec.tableData as Record<string, unknown>[];
                  }
                  if (!rows?.length) continue;
                  for (const row of rows) {
                    const keys = Object.keys(row);
                    if (keys.length < 2) continue;
                    const l = String(row[keys[0]] ?? "").trim();
                    const v = String(row[keys[1]] ?? "").trim();
                    if (l && v) metrics.push({ label: l, value: v });
                    if (metrics.length >= 4) break;
                  }
                  if (metrics.length > 0) break;
                }
                if (!metrics.length) return null;
                return (
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {metrics.map(({ label, value }, mi) => (
                      <div
                        key={mi}
                        className={cn(
                          "rounded-xl border-l-4 px-5 py-4",
                          printMode ? "bg-blue-50 border-blue-500" : "bg-blue-500/10 border-blue-500"
                        )}
                        style={{ borderLeftColor: chapterAccent }}
                      >
                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1 truncate", printMode ? "text-slate-500" : "text-slate-400")}>
                          {label}
                        </p>
                        <p className={cn("text-base font-bold truncate", printMode ? "text-slate-900" : "text-white")}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Sections within chapter */}
              <div className="space-y-8">
                {group.sections.map((section) => {
                  sectionCounter++;
                  const accent = chapterAccent;
                  return (
                    <section
                      key={section.id}
                      id={section.sectionKey}
                      className={cn(
                        "rounded-2xl border p-8 scroll-mt-28 transition-colors",
                        printMode ? "bg-white border-slate-200" : "bg-[#0A1828]/50 border-[#1E3A5C]/60"
                      )}
                    >
                      <div className="flex items-start gap-4 mb-5">
                        <div
                          className="w-1 self-stretch rounded-full flex-shrink-0"
                          style={{ backgroundColor: accent, minHeight: 40 }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <h3 className={cn("text-lg font-bold", printMode ? "text-slate-900" : "text-white")}>
                              {section.title}
                            </h3>
                            {section.isLocked && (
                              <Lock size={14} className="text-amber-400 flex-shrink-0" />
                            )}
                          </div>
                          {section.subtitle && (
                            <p className={cn("text-sm", printMode ? "text-slate-500" : "text-slate-500")}>
                              {section.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const allVisuals = !section.isLocked
                          ? (data?.meta?.reportVisuals ?? [])
                              .filter((v) => v.sectionKey === section.sectionKey && v.includeInHtml)
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                          : [];
                        const aboveVisuals   = allVisuals.filter((v) => v.sectionPlacement === "above_body");
                        const sidebarVisuals = allVisuals.filter((v) => v.sectionPlacement === "sidebar");
                        // inline: embedded inside section flow (between body text and bullets)
                        const inlineVisuals  = allVisuals.filter((v) => v.sectionPlacement === "inline");
                        // below_body (default) and full_width render after all section content
                        const belowVisuals   = allVisuals.filter((v) =>
                          !["above_body", "sidebar", "inline"].includes(v.sectionPlacement ?? "below_body")
                        );
                        // renderVisual applies placement-aware layout to BOTH ready and pending states
                        const renderVisual = (v: ReportVisualEntry) => {
                          const isFullWidth = v.sectionPlacement === "full_width";
                          if (v.status === "ready") {
                            return isFullWidth
                              ? <div key={v.id} className="w-full"><ReportVisualBlock visual={v} printMode={printMode} /></div>
                              : <ReportVisualBlock key={v.id} visual={v} printMode={printMode} />;
                          }
                          return (
                            <div key={v.id} className={cn(
                              "rounded-xl border p-4 mt-4 flex items-center gap-3",
                              isFullWidth ? "w-full" : "",
                              printMode ? "bg-slate-50 border-slate-200" : "bg-[#0A1828]/40 border-[#1E3A5C]/40"
                            )}>
                              <AlertTriangle size={14} className="text-slate-500 flex-shrink-0" />
                              <div>
                                <div className={cn("text-sm font-semibold", printMode ? "text-slate-600" : "text-slate-400")}>{v.title}</div>
                                <div className="text-xs text-slate-500 mt-0.5">Data not available — chart pending source data</div>
                              </div>
                            </div>
                          );
                        };
                        const mainContent = section.isLocked
                          ? <LockedSection title={section.title} subtitle={section.subtitle ?? null} listingId={listingId} sectionKey={section.sectionKey} />
                          : <SectionContent section={section} listingId={listingId} reportImages={data?.meta?.reportImages} printMode={printMode} tourSrcDoc={data?.meta?.tourSrcDoc} inlineVisuals={inlineVisuals} />;
                        return (
                          <>
                            {/* above_body: render before section body */}
                            {aboveVisuals.map(renderVisual)}
                            {/* sidebar: flex-row layout with section body in main column */}
                            {sidebarVisuals.length > 0 ? (
                              <div className="flex gap-6 items-start">
                                <div className="flex-1 min-w-0">{mainContent}</div>
                                <div className="w-56 flex-shrink-0 hidden sm:block space-y-3">
                                  {sidebarVisuals.map(renderVisual)}
                                </div>
                              </div>
                            ) : mainContent}
                            {/* below_body / full_width: render after all section content */}
                            {belowVisuals.map(renderVisual)}
                          </>
                        );
                      })()}

                    </section>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Ungrouped sections (fallback — shouldn't normally appear) */}
        {ungroupedSections.map((section, idx) => {
          const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
          return (
            <section
              key={section.id}
              id={section.sectionKey}
              className={cn(
                "rounded-2xl border p-8 scroll-mt-28",
                printMode ? "bg-white border-slate-200" : "bg-[#0A1828]/50 border-[#1E3A5C]/60"
              )}
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: accent, minHeight: 40 }} />
                <div className="flex-1 min-w-0">
                  <h3 className={cn("text-lg font-bold mb-1", printMode ? "text-slate-900" : "text-white")}>{section.title}</h3>
                  {section.subtitle && <p className={cn("text-sm", printMode ? "text-slate-500" : "text-slate-500")}>{section.subtitle}</p>}
                </div>
              </div>
              {(() => {
                const allVisuals = !section.isLocked
                  ? (data?.meta?.reportVisuals ?? [])
                      .filter((v) => v.sectionKey === section.sectionKey && v.includeInHtml)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                  : [];
                const aboveVisuals   = allVisuals.filter((v) => v.sectionPlacement === "above_body");
                const sidebarVisuals = allVisuals.filter((v) => v.sectionPlacement === "sidebar");
                const inlineVisuals  = allVisuals.filter((v) => v.sectionPlacement === "inline");
                const belowVisuals   = allVisuals.filter((v) =>
                  !["above_body", "sidebar", "inline"].includes(v.sectionPlacement ?? "below_body")
                );
                const renderVisual = (v: ReportVisualEntry) => {
                  const isFullWidth = v.sectionPlacement === "full_width";
                  if (v.status === "ready") {
                    return isFullWidth
                      ? <div key={v.id} className="w-full"><ReportVisualBlock visual={v} printMode={printMode} /></div>
                      : <ReportVisualBlock key={v.id} visual={v} printMode={printMode} />;
                  }
                  return (
                    <div key={v.id} className={cn(
                      "rounded-xl border p-4 mt-4 flex items-center gap-3",
                      isFullWidth ? "w-full" : "",
                      printMode ? "bg-slate-50 border-slate-200" : "bg-[#0A1828]/40 border-[#1E3A5C]/40"
                    )}>
                      <AlertTriangle size={14} className="text-slate-500 flex-shrink-0" />
                      <div>
                        <div className={cn("text-sm font-semibold", printMode ? "text-slate-600" : "text-slate-400")}>{v.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Data not available — chart pending source data</div>
                      </div>
                    </div>
                  );
                };
                const mainContent = section.isLocked
                  ? <LockedSection title={section.title} subtitle={section.subtitle ?? null} listingId={listingId} sectionKey={section.sectionKey} />
                  : <SectionContent section={section} listingId={listingId} reportImages={data?.meta?.reportImages} printMode={printMode} tourSrcDoc={data?.meta?.tourSrcDoc} inlineVisuals={inlineVisuals} />;
                return (
                  <>
                    {aboveVisuals.map(renderVisual)}
                    {sidebarVisuals.length > 0 ? (
                      <div className="flex gap-6 items-start">
                        <div className="flex-1 min-w-0">{mainContent}</div>
                        <div className="w-56 flex-shrink-0 hidden sm:block space-y-3">
                          {sidebarVisuals.map(renderVisual)}
                        </div>
                      </div>
                    ) : mainContent}
                    {belowVisuals.map(renderVisual)}
                  </>
                );
              })()}
            </section>
          );
        })}

        {/* Global report visuals — no specific section, rendered as a standalone block */}
        {(() => {
          const globalVisuals = (data?.meta?.reportVisuals ?? [])
            .filter((v) => !v.sectionKey && v.includeInHtml)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          if (!globalVisuals.length) return null;
          return (
            <div className={cn(
              "rounded-2xl border p-8",
              printMode ? "bg-white border-slate-200" : "bg-[#0A1828]/50 border-[#1E3A5C]/60"
            )}>
              <h2 className={cn("text-xl font-bold mb-6", printMode ? "text-slate-900" : "text-white")}>
                Data &amp; Insights
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {globalVisuals.map((v) => v.status === "ready"
                  ? <ReportVisualBlock key={v.id} visual={v} printMode={printMode} />
                  : (
                    <div key={v.id} className={cn(
                      "rounded-xl border p-4 flex items-center gap-3",
                      printMode ? "bg-slate-50 border-slate-200" : "bg-[#0A1828]/40 border-[#1E3A5C]/40"
                    )}>
                      <AlertTriangle size={14} className="text-slate-500 flex-shrink-0" />
                      <div>
                        <div className={cn("text-sm font-semibold", printMode ? "text-slate-600" : "text-slate-400")}>{v.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Data not available — chart pending source data</div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })()}
      </main>

      {/* ── Disclaimer ────────────────────────────────────────────────────────── */}
      <footer className={cn(
        "border-t mt-4 py-10 print:pt-4",
        printMode ? "bg-slate-50 border-slate-200" : "bg-[#070F1C] border-[#1E3A5C]"
      )}>
        <div className="max-w-5xl mx-auto px-6 space-y-4">
          <p className={cn("text-xs font-bold uppercase tracking-wider", printMode ? "text-slate-400" : "text-slate-600")}>
            Disclaimer
          </p>
          <p className={cn("text-xs leading-relaxed", printMode ? "text-slate-500" : "text-slate-600")}>
            This Information Memorandum has been prepared using information supplied by the seller and
            app-connected data sources where available. It is provided for general information only and does
            not constitute financial, legal or accounting advice. Buyers must conduct their own due diligence
            and obtain independent professional advice before making any decision to purchase. Valuation outputs
            are indicative only and are based on selected assumptions, data inputs, valuation multiples, and
            seller-supplied information.
          </p>
          <div className="flex items-center justify-between pt-2">
            <span className={cn("text-xs font-bold", printMode ? "text-slate-400" : "text-slate-600")}>
              EXIT360 · exit360.com.au
            </span>
            <span className={cn("text-xs", printMode ? "text-slate-400" : "text-slate-600")}>
              © {new Date().getFullYear()} Exit360. All rights reserved.
            </span>
          </div>
        </div>
      </footer>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
        .print-mode { color: #1e293b; }
        .print-mode h1, .print-mode h2 { color: #0f172a; }
      `}</style>
    </div>
  );
}
