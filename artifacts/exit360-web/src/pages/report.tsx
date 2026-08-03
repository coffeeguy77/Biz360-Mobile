import { useParams, useLocation } from "wouter";
import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import { Logo } from "@/components/Logo";
import {
  Lock, Download, Phone, Calendar, Shield,
  CheckCircle2, FileText, MapPin, Printer, ChevronRight, Eye,
  AlertTriangle, Tag, DollarSign, Menu, X, ChevronDown,
  ArrowLeft, User, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InteractiveTour, type TourSpace } from "@/components/InteractiveTour";
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
        This section is available to approved buyers. Sign in to your buyer portal to unlock it.
      </p>
      <a
        href="/buyers"
        onClick={() => recordAccessLog(listingId, "access_requested", { sectionKey })}
        className="mt-1 inline-flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-semibold px-4 py-2 rounded-lg border border-amber-500/30 transition-colors"
      >
        <Shield size={14} />
        Sign in to Buyer Portal
      </a>
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
/** Rewrite a Cloudinary delivery URL to request a large, sharp render.
 *  Strips any existing delivery transform and injects a high-width c_limit. */
function cldHiRes(url: string | null | undefined, width = 2560): string {
  if (!url) return url ?? "";
  if (!url.includes("res.cloudinary.com/") || !url.includes("/upload/")) return url;
  const [pre, post] = url.split("/upload/");
  const segs = post.split("/");
  // A transform segment looks like "w_800,c_fill,q_auto" (comma-joined xx_value tokens).
  const looksLikeTransform = /^[a-z]{1,3}_[^/]+(?:,[a-z0-9]{1,3}_[^/]+)*$/i.test(segs[0]);
  const rest = looksLikeTransform ? segs.slice(1).join("/") : post;
  // q_auto:best keeps detail; e_improve + e_sharpen clean up JPEG softness and
  // high-DPI upscaling so the hero/section images render crisp, not pixelated.
  return `${pre}/upload/w_${width},c_limit,q_auto:best,e_improve,e_sharpen:60,f_auto/${rest}`;
}

/** Hero-only: genuine AI super-resolution. The report cover renders very large
 *  (up to ~72vh) on hi-DPI/ultrawide screens, well past a typical 1920px source,
 *  so plain sharpening can't help. This caps the input under the upscaler's
 *  limit, 2× it with Cloudinary's AI (e_upscale), then delivers a crisp 2560px
 *  image. Falls back to cldHiRes via the <img> onError if upscaling ever fails. */
function cldHero(url: string | null | undefined): string {
  if (!url) return url ?? "";
  if (!url.includes("res.cloudinary.com/") || !url.includes("/upload/")) return url;
  const [pre, post] = url.split("/upload/");
  const segs = post.split("/");
  const looksLikeTransform = /^[a-z]{1,3}_[^/]+(?:,[a-z0-9]{1,3}_[^/]+)*$/i.test(segs[0]);
  const rest = looksLikeTransform ? segs.slice(1).join("/") : post;
  return `${pre}/upload/c_limit,w_1280/e_upscale/c_limit,w_2560,q_auto:best,e_sharpen:40,f_auto/${rest}`;
}

function SectionImageStrip({
  images,
  printMode,
}: {
  images: ReportImageEntry[];
  printMode: boolean;
}) {
  if (!images.length) return null;
  // Float to the right so section text wraps beside the images. Larger, aspect-
  // preserved (c_limit, not cropped), with a tight border hugging the image shape.
  return (
    <div className="sm:float-right sm:w-80 lg:w-96 xl:w-[30rem] sm:ml-6 mb-4 w-full flex flex-col gap-4">
      {images.map((img) => {
        const cloud = (img.url.match(/cloudinary\.com\/([^/]+)/) ?? [])[1] ?? "biz360";
        const url = img.cloudinaryPublicId
          ? `https://res.cloudinary.com/${cloud}/image/upload/w_1200,c_limit,q_auto,f_auto/${img.cloudinaryPublicId}`
          : img.url;
        return (
          <figure key={img.id} className="m-0">
            <img
              src={url}
              alt={img.altText ?? img.displayName ?? "Section image"}
              className={cn(
                "block w-full rounded-xl border-2",
                printMode ? "border-slate-300" : "border-[#2A4A72]",
              )}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            {img.caption && (
              <figcaption className={cn("text-xs mt-1.5 text-center px-1", printMode ? "text-slate-500" : "text-slate-400")}>
                {img.caption}
              </figcaption>
            )}
          </figure>
        );
      })}
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
                <XAxis type="number" tick={{ fill: "#E2E8F0", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fill: "#E2E8F0", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tick={{ fill: "#E2E8F0", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#E2E8F0", fontSize: 10 }} axisLine={false} tickLine={false} />
              </>
            )}
            <Tooltip
              contentStyle={VIZ_TIP}
              cursor={{ fill: "rgba(30,58,92,0.35)" }}
              formatter={(value: any) => {
                const n = Number(value);
                const isMoney = bars[0]?.raw != null;
                return [isMoney ? `$${n.toLocaleString()}` : n.toLocaleString(), ""];
              }}
            />
            <Bar name="Value" dataKey={bars[0]?.raw != null ? "raw" : "value"} radius={isHoriz ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
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
                  <text x={x} y={y2} fill="#E2E8F0" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
                    {`${pct}%`}
                  </text>
                );
              }}
              labelLine={false}>
              {slices.map((_, i) => <Cell key={i} fill={VIZ_PALETTE[i % VIZ_PALETTE.length]} />)}
            </Pie>
            <Tooltip contentStyle={VIZ_TIP} formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
            <Legend iconType="circle" iconSize={8}
              formatter={(n) => <span style={{ color: "#E2E8F0", fontSize: 11 }}>{n}</span>} />
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
            <XAxis dataKey="name" tick={{ fill: "#E2E8F0", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#E2E8F0", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={VIZ_TIP}
              cursor={{ fill: "rgba(30,58,92,0.35)" }}
              formatter={(value: any) => [`$${Number(value).toLocaleString()}`, ""]}
            />
            <Bar name="Value" dataKey="value" radius={[4, 4, 0, 0]}>
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
  heroImageUrl,
}: {
  section: ReportSection;
  listingId: string;
  reportImages?: ReportImageEntry[];
  printMode: boolean;
  tourSrcDoc?: string | null;
  inlineVisuals?: ReportVisualEntry[];
  heroImageUrl?: string | null;
}) {
  const ChartComponent = SECTION_CHART_MAP[section.sectionKey];
  const chartData = section.chartData
    ? (typeof section.chartData === "string" ? JSON.parse(section.chartData) : section.chartData)
    : undefined;

  const hasContent = section.body || (section.bulletPoints?.length ?? 0) > 0 || section.tableData;
  const is360 = section.sectionKey === "360_business_walkthrough";

  // Interactive tour: load the same tour spaces the public listing uses so the
  // report renders the full walkthrough (clickable hotspots + thumbnail nav).
  const [tourSpaces, setTourSpaces] = useState<TourSpace[] | null>(null);
  const [tourAutoPan, setTourAutoPan] = useState(false);
  useEffect(() => {
    if (!is360 || !listingId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/biz360/kv/biz360_tour_spaces_v2_${listingId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/biz360/kv/biz360_tour_settings_v1_${listingId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([spacesData, settingsData]) => {
      if (cancelled) return;
      const arr = Array.isArray(spacesData?.value) ? spacesData.value : (Array.isArray(spacesData) ? spacesData : []);
      const mapped: TourSpace[] = arr.map((s: any) => ({
        id: s.id,
        name: s.name,
        panoramaUrl: s.panoramaUrl ?? "",
        isStartScene: !!s.isStartScene,
        autoPan: !!s.autoPan,
        audioUrl: s.audioUrl,
        audioName: s.audioName,
        groundPitch: s.groundPitch,
        panoramaStartYaw: s.panoramaStartYaw ?? 0,
        defaultYaw: typeof s.defaultYaw === "number" ? s.defaultYaw : undefined,
        enabled: s.enabled,
        pins: Array.isArray(s.pins) ? s.pins : [],
      }));
      setTourSpaces(mapped);
      const sv = settingsData?.value ?? settingsData;
      setTourAutoPan(!!sv?.autoPanAll);
    });
    return () => { cancelled = true; };
  }, [is360, listingId]);
  const hasInteractiveTour = !!tourSpaces && tourSpaces.some((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"));

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
    business_overview:          ["interior"],
    plant_equipment_summary:    ["equipment"],
    lease_premises_summary:     ["exterior"],
    staff_owner_involvement:    ["team"],
    brand_digital_assets:       ["product"],
    "360_business_walkthrough": ["360_preview"],
  };
  // Don't repeat the hero photo inside a section — it already headlines the cover.
  const heroPublicId = (heroImageUrl?.match(/\/upload\/(?:[^/]+\/)*(?:v\d+\/)?(.+?)(?:\.\w+)?$/) ?? [])[1] ?? null;
  const isHeroImage = (img: ReportImageEntry) =>
    img.imageRole === "listing_hero" ||
    (!!heroImageUrl && (img.url === heroImageUrl ||
      (!!img.cloudinaryPublicId && !!heroPublicId && heroPublicId.includes(img.cloudinaryPublicId))));
  const sectionImages: ReportImageEntry[] = reportImages
    ? (() => {
        const bySectionKey = reportImages.filter(
          (img) => img.sectionKey === section.sectionKey && !img.isPanoramic && !isHeroImage(img),
        );
        if (bySectionKey.length) return bySectionKey.slice(0, 3);
        const roleMatches = SECTION_ROLE_MAP[section.sectionKey] ?? [];
        if (!roleMatches.length) return [];
        return reportImages
          .filter((img) => roleMatches.includes(img.imageRole) && !isHeroImage(img))
          .slice(0, 2);
      })()
    : [];

  return (
    <div className="space-y-4">
      {!hasAnything && (
        <p className="text-slate-500 italic text-sm">This section has not yet been completed.</p>
      )}
      {/* Section images float right so the body text + bullets wrap beside them */}
      {sectionImages.length > 0 && !is360 && (
        <SectionImageStrip images={sectionImages} printMode={printMode} />
      )}
      {section.body && <SectionBodyText body={section.body} />}
      {section.bulletPoints && section.bulletPoints.length > 0 && (
        <SectionBullets bullets={section.bulletPoints} />
      )}
      {/* inline visuals — sit directly under the section text/bullets, flowing into
          the vacant gap beside the floated image (no clearing gap above them).
          flow-root establishes a BFC so the chart tucks beside the float instead
          of rendering full-width behind it. */}
      {inlineVisuals && inlineVisuals.length > 0 && (
        <div className="flow-root space-y-3">
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
      {/* Clear the floated images before any full-width chart/table */}
      <div className="clear-both" />
      {!!section.tableData && <SectionTable data={section.tableData} />}
      {chartWillRender && (
        <div className="report-chart-card mt-6 p-4 rounded-xl bg-[#070F1C]/60 border border-[#1E3A5C]/60">
          <ChartComponent data={chartData} />
        </div>
      )}
      {is360 && (
        hasInteractiveTour ? (
          <div className="mt-4">
            <InteractiveTour spaces={tourSpaces!} autoPanAll={tourAutoPan} />
          </div>
        ) : tourUrl ? (
          <div className="mt-4 rounded-xl overflow-hidden border border-[#1E3A5C] bg-black" style={{ height: "clamp(360px, 58vw, 580px)" }}>
            <iframe
              src={tourUrl}
              className="w-full h-full"
              allow="fullscreen; xr-spatial-tracking"
              title="360° Business Walkthrough"
              onLoad={() => recordAccessLog(listingId, "tour_clicked", { sectionKey: section.sectionKey })}
            />
          </div>
        ) : resolvedSrcDoc ? (
          <div className="mt-4 rounded-xl overflow-hidden border border-[#1E3A5C] bg-black" style={{ height: "clamp(360px, 58vw, 580px)" }}>
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
  { key: "valuation",           title: "Valuation & Pricing",             sectionKeys: ["app_valuation_summary","valuation_methodology","valuation_range_explanation"] },
  { key: "earnings_adjustments", title: "Earnings & Adjustments",         sectionKeys: ["cogs_mapping_summary","addbacks_adjusted_ebitda"] },
  { key: "assets_equipment",    title: "Assets & Equipment",              sectionKeys: ["plant_equipment_summary","sale_inclusions","sale_exclusions","stock_working_capital"] },
  { key: "lease_premises",      title: "Lease & Premises",                sectionKeys: ["lease_premises_summary","business_location_market_context","canberra_location_explainer"] },
  { key: "staff_operations",    title: "Staff & Operations",              sectionKeys: ["staff_owner_involvement","operations_systems"] },
  { key: "brand_customers",     title: "Brand, Customers & Suppliers",    sectionKeys: ["supplier_summary","customer_base","brand_digital_assets","reviews_reputation"] },
  { key: "growth_risk",         title: "Growth & Risk",                   sectionKeys: ["growth_opportunities","risks_mitigations"] },
  { key: "virtual_tour",        title: "Virtual Tour & Property",         sectionKeys: ["360_business_walkthrough","key_tour_highlights"] },
  { key: "due_diligence",       title: "Due Diligence",                   sectionKeys: ["due_diligence_documents_available","verified_information","buyer_access_confidentiality"] },
  { key: "buyer_pack",          title: "Buyer Pack & Next Steps",         sectionKeys: ["next_steps","disclaimer"] },
];

// ── Section number → visual style ─────────────────────────────────────────────
const ACCENT_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1",
];

// ── Equipment register ────────────────────────────────────────────────────────
interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  division?: string;
  brand?: string | null;
  condition?: string | null;
  secondhandValue: number;
  replacementCost: number;
}
interface EquipmentRegister {
  items: EquipmentItem[];
  totals: { secondhand: number; replacement: number };
  count: number;
}

// ── Equipment register section ────────────────────────────────────────────────
function EquipmentRegisterSection({ reg, printMode, inline }: { reg: EquipmentRegister; printMode: boolean; inline?: boolean }) {
  const fmt = (n: number) =>
    n > 0 ? `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}` : "—";

  // Division filter tabs (e.g. Espresso Bar, Coffee Roastery, Coffee Carts).
  const divisions = Array.from(new Set(reg.items.map((i) => (i.division || "General").trim() || "General"))).sort();
  const showTabs = divisions.length > 1;
  const [activeDivision, setActiveDivision] = useState<string>("All");
  // On phones we show one price column at a time (item + price) via this toggle;
  // tablet/desktop show both second-hand and replacement side by side.
  const [priceView, setPriceView] = useState<"secondhand" | "replacement">("secondhand");
  // When printing, always show everything regardless of the on-screen filter.
  const effectiveDivision = printMode ? "All" : activeDivision;
  const viewItems = effectiveDivision === "All"
    ? reg.items
    : reg.items.filter((i) => ((i.division || "General").trim() || "General") === effectiveDivision);
  const totals = viewItems.reduce(
    (a, i) => ({ secondhand: a.secondhand + i.secondhandValue, replacement: a.replacement + i.replacementCost }),
    { secondhand: 0, replacement: 0 },
  );
  const count = viewItems.length;

  const groups: Record<string, EquipmentItem[]> = {};
  for (const it of viewItems) (groups[it.category] ||= []).push(it);
  const cats = Object.keys(groups).sort();
  const th = cn("px-4 py-2.5 font-semibold text-xs uppercase tracking-wider", printMode ? "text-slate-500" : "text-slate-400");
  return (
    <section id="equipment-register" className={inline ? "mt-8 scroll-mt-24" : "max-w-[1440px] mx-auto px-6 mt-14 scroll-mt-24"}>
      <div className={cn("rounded-2xl border p-6 sm:p-8 report-avoid-break", printMode ? "bg-white border-slate-200" : "bg-[#0A1828]/50 border-[#1E3A5C]/60")}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: "#F59E0B", minHeight: 40 }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <Wrench size={18} className={printMode ? "text-amber-600" : "text-amber-400"} />
              <h3 className={cn("text-lg font-bold", printMode ? "text-slate-900" : "text-white")}>Equipment Register</h3>
            </div>
            <p className={cn("text-sm", printMode ? "text-slate-500" : "text-slate-500")}>
              {count} included item{count === 1 ? "" : "s"}{effectiveDivision !== "All" ? ` in ${effectiveDivision}` : ""} · second-hand value vs. replacement (new) cost
            </p>
          </div>
        </div>

        {showTabs && !printMode && (
          <div className="flex flex-wrap gap-2 mb-5">
            {["All", ...divisions].map((d) => {
              const active = activeDivision === d;
              return (
                <button
                  key={d}
                  onClick={() => setActiveDivision(d)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    active
                      ? "bg-amber-500 border-amber-500 text-[#0A1828]"
                      : "bg-transparent border-[#1E3A5C] text-slate-300 hover:border-amber-500/50",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        )}

        <p className={cn("text-[15px] leading-relaxed mb-6", printMode ? "text-slate-700" : "text-slate-300")}>
          The equipment included in the sale is listed below. Our valuation is based on the{" "}
          <strong>second-hand value</strong> — what each item is realistically worth today. The{" "}
          <strong>replacement cost</strong> shows what it would cost a buyer to purchase the same
          equipment <em>brand new</em>, which highlights the substantial asset base underpinning the
          asking price.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className={cn("rounded-xl p-4 border", printMode ? "bg-amber-50 border-amber-100" : "bg-amber-500/10 border-amber-500/20")}>
            <div className={cn("text-[11px] font-semibold uppercase tracking-wider mb-1", printMode ? "text-slate-500" : "text-slate-400")}>Second-hand value (our figure)</div>
            <div className={cn("text-2xl font-bold", printMode ? "text-amber-700" : "text-amber-300")}>{fmt(totals.secondhand)}</div>
          </div>
          <div className={cn("rounded-xl p-4 border", printMode ? "bg-blue-50 border-blue-100" : "bg-blue-500/10 border-blue-500/20")}>
            <div className={cn("text-[11px] font-semibold uppercase tracking-wider mb-1", printMode ? "text-slate-500" : "text-slate-400")}>Replacement (new) cost</div>
            <div className={cn("text-2xl font-bold", printMode ? "text-blue-700" : "text-blue-300")}>{fmt(totals.replacement)}</div>
          </div>
        </div>

        {/* Mobile: item + one price with a Second-hand / Replacement toggle */}
        {!printMode && (
          <div className="sm:hidden">
            <div className="inline-flex rounded-lg border border-[#1E3A5C] p-0.5 mb-3">
              {([["secondhand", "Second-hand"], ["replacement", "Replacement"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setPriceView(k)}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                    priceView === k ? "bg-amber-500 text-[#0A1828]" : "text-slate-400")}>
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-[#1E3A5C] overflow-hidden">
              {cats.map((cat) => {
                const items = groups[cat];
                const sub = items.reduce((a, i) => ({ s: a.s + i.secondhandValue, r: a.r + i.replacementCost }), { s: 0, r: 0 });
                const val = (n: { s: number; r: number }) => priceView === "secondhand" ? n.s : n.r;
                return (
                  <Fragment key={cat}>
                    <div className="bg-[#0F2040]/50 px-4 py-2 font-bold text-xs uppercase tracking-wide text-slate-300">{cat}</div>
                    {items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-[#1E3A5C]/50">
                        <span className="text-slate-200 text-sm min-w-0 break-words">
                          {it.name}{it.brand ? <span className="text-slate-500"> · {it.brand}</span> : null}
                        </span>
                        <span className={cn("text-right tabular-nums whitespace-nowrap font-medium flex-shrink-0", priceView === "secondhand" ? "text-amber-300" : "text-blue-300")}>
                          {fmt(priceView === "secondhand" ? it.secondhandValue : it.replacementCost)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-[#1E3A5C] bg-[#0F2040]/30">
                      <span className="text-slate-400 text-xs font-semibold">Subtotal · {cat}</span>
                      <span className={cn("font-bold tabular-nums whitespace-nowrap", priceView === "secondhand" ? "text-amber-300" : "text-blue-300")}>{fmt(val(sub))}</span>
                    </div>
                  </Fragment>
                );
              })}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#1E3A5C] bg-[#0F2040]">
                <span className="text-white font-bold">Total</span>
                <span className={cn("font-bold tabular-nums whitespace-nowrap", priceView === "secondhand" ? "text-amber-300" : "text-blue-300")}>
                  {fmt(priceView === "secondhand" ? totals.secondhand : totals.replacement)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tablet / desktop (and print): full two-column table, horizontally scrollable if tight */}
        <div className={cn("overflow-x-auto rounded-xl border", printMode ? "border-slate-200" : "border-[#1E3A5C]", printMode ? "" : "hidden sm:block")}>
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className={printMode ? "bg-slate-100" : "bg-[#0F2040]"}>
                <th className={cn(th, "text-left")}>Item</th>
                <th className={cn(th, "text-right whitespace-nowrap")}>Second-hand</th>
                <th className={cn(th, "text-right whitespace-nowrap")}>Replacement (new)</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => {
                const items = groups[cat];
                const sub = items.reduce((a, i) => ({ s: a.s + i.secondhandValue, r: a.r + i.replacementCost }), { s: 0, r: 0 });
                return (
                  <Fragment key={cat}>
                    <tr className={printMode ? "bg-slate-50" : "bg-[#0F2040]/50"}>
                      <td colSpan={3} className={cn("px-4 py-2 font-bold text-xs uppercase tracking-wide", printMode ? "text-slate-600" : "text-slate-300")}>{cat}</td>
                    </tr>
                    {items.map((it) => (
                      <tr key={it.id} className={cn("border-t", printMode ? "border-slate-100" : "border-[#1E3A5C]/50")}>
                        <td className={cn("px-4 py-2.5", printMode ? "text-slate-700" : "text-slate-200")}>
                          {it.name}
                          {it.brand ? <span className={printMode ? "text-slate-400" : "text-slate-500"}> · {it.brand}</span> : null}
                        </td>
                        <td className={cn("px-4 py-2.5 text-right tabular-nums whitespace-nowrap", printMode ? "text-amber-700" : "text-amber-300")}>{fmt(it.secondhandValue)}</td>
                        <td className={cn("px-4 py-2.5 text-right tabular-nums whitespace-nowrap", printMode ? "text-blue-700" : "text-blue-300")}>{fmt(it.replacementCost)}</td>
                      </tr>
                    ))}
                    <tr className={cn("border-t", printMode ? "border-slate-200 bg-slate-50" : "border-[#1E3A5C] bg-[#0F2040]/30")}>
                      <td className={cn("px-4 py-2 text-right font-semibold text-xs", printMode ? "text-slate-500" : "text-slate-400")}>Subtotal · {cat}</td>
                      <td className={cn("px-4 py-2 text-right font-bold tabular-nums whitespace-nowrap", printMode ? "text-amber-700" : "text-amber-300")}>{fmt(sub.s)}</td>
                      <td className={cn("px-4 py-2 text-right font-bold tabular-nums whitespace-nowrap", printMode ? "text-blue-700" : "text-blue-300")}>{fmt(sub.r)}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={printMode ? "bg-slate-100" : "bg-[#0F2040]"}>
                <td className={cn("px-4 py-3 text-right font-bold", printMode ? "text-slate-900" : "text-white")}>Total</td>
                <td className={cn("px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap", printMode ? "text-amber-700" : "text-amber-300")}>{fmt(totals.secondhand)}</td>
                <td className={cn("px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap", printMode ? "text-blue-700" : "text-blue-300")}>{fmt(totals.replacement)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

// ── Main Report Page ──────────────────────────────────────────────────────────
export function ReportPage() {
  // versionId may come from route param (/reports/:listingId/:versionId)
  // or from query string (?v=...) for legacy links.
  const params = useParams<{ listingId: string; versionId?: string }>();
  const [, navigate] = useLocation();
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentRegister | null>(null);
  // NDA gate — buyers accessing via a report-access token must accept the
  // per-listing NDA before any confidential content is shown.
  const [ndaRequired, setNdaRequired]   = useState(false);
  const [ndaAccepted, setNdaAccepted]   = useState(false);
  const [ndaChecked, setNdaChecked]     = useState(false);
  const [ndaName, setNdaName]           = useState("");
  const [ndaAgree, setNdaAgree]         = useState(false);
  const [ndaSubmitting, setNdaSubmitting] = useState(false);
  const [ndaError, setNdaError]         = useState<string | null>(null);
  const [ndaText, setNdaText]           = useState<string>("");
  const [ndaManualOnly, setNdaManualOnly] = useState(false);
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

    // Buyer portal JWT — if the buyer is logged into the portal, send their JWT so
    // the server can check group membership and unlock approved_buyers sections without
    // relying on the URL accessToken (which may be stale from an older session).
    const buyerPortalToken = localStorage.getItem("exit360_buyer_token") || null;

    // Build query string helper (appends accessToken when present)
    function qs(base: string): string {
      const at = accessToken;
      return at ? `${base}${base.includes("?") ? "&" : "?"}accessToken=${encodeURIComponent(at)}` : base;
    }

    // Build headers for all report fetch calls
    function buildHeaders(): Record<string, string> {
      const h: Record<string, string> = {};
      if (authToken) h["Authorization"] = `Bearer ${authToken}`;
      if (buyerPortalToken) h["X-Buyer-Token"] = buyerPortalToken;
      return h;
    }

    if (versionId) {
      // Versioned view: sellers use the auth-required snapshot endpoint (full view);
      // unauthenticated/buyer viewers use the public-snapshot endpoint (published-only,
      // seller_only sections filtered out). accessToken is forwarded so approved_buyers
      // sections can be unlocked for OTP-verified buyers on versioned links.
      const endpoint = authToken
        ? `/api/report-versions/snapshot/${versionId}`
        : qs(`/api/report-versions/public-snapshot/${versionId}`);
      fetch(endpoint, { headers: buildHeaders() })
        .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
        .then((json: { sections: ReportSection[]; title?: string }) =>
          setData({ sections: json.sections, accessLevel: authToken ? "seller" : "public" }))
        .catch(() => {
          // Fall back to live sections if snapshot not accessible
          fetch(qs(`/api/report-sections/html/${listingId}`), { headers: buildHeaders() })
            .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
            .then((json: ReportData) => setData(json))
            .catch((e) => setError(String(e)));
        })
        .finally(() => setLoading(false));
    } else {
      // Live view: send seller token if present (unlocks approved_buyers + seller_only sections).
      // buyerPortalToken forwarded so portal members always get approved_buyers unlocked.
      fetch(qs(`/api/report-sections/html/${listingId}`), { headers: buildHeaders() })
        .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
        .then((json: ReportData) => setData(json))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    recordAccessLog(listingId, "report_viewed", versionId ? { versionId } : {});

    // Log an identified report visit (who + when) for the seller's activity feed.
    // Skip when it's the seller previewing their own report (seller token, no
    // buyer identity); log identified buyers and anonymous public visitors.
    try {
      const portalTok = localStorage.getItem("exit360_buyer_token");
      const sellerTok = previewToken || localStorage.getItem("biz360_auth_token");
      const buyerTok = portalTok || accessToken;
      if (buyerTok || !sellerTok) {
        fetch(`/api/public/listing/${listingId}/log-view`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentType: "report", token: buyerTok || undefined }),
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }
  }, [listingId, versionId, accessToken, previewToken, previewCode]);

  // Equipment register — included items with second-hand + replacement values.
  useEffect(() => {
    if (!listingId) return;
    fetch(`/api/public/listing/${listingId}/equipment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: EquipmentRegister | null) => {
        if (json && Array.isArray(json.items) && json.items.length > 0) setEquipment(json);
        else setEquipment(null);
      })
      .catch(() => setEquipment(null));
  }, [listingId]);

  // Check the NDA gate for buyers arriving with a report-access token.
  useEffect(() => {
    if (!listingId || !accessToken) { setNdaChecked(true); return; }
    let active = true;
    fetch("/api/buyer-portal/nda/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, accessToken }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { required?: boolean; accepted?: boolean; ndaText?: string; manualOnly?: boolean } | null) => {
        if (!active) return;
        setNdaRequired(!!d?.required);
        setNdaAccepted(!!d?.accepted);
        if (typeof d?.ndaText === "string") setNdaText(d.ndaText);
        setNdaManualOnly(!!d?.manualOnly);
        setNdaChecked(true);
      })
      .catch(() => { if (active) setNdaChecked(true); });
    return () => { active = false; };
  }, [listingId, accessToken]);

  async function acceptNda() {
    const name = ndaName.trim();
    if (name.length < 2) { setNdaError("Please enter your full name."); return; }
    if (!ndaAgree) { setNdaError("Please tick the box to agree to the NDA."); return; }
    setNdaSubmitting(true); setNdaError(null);
    try {
      const r = await fetch("/api/buyer-portal/nda/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, accessToken, fullName: name }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.accepted) { setNdaError(d.error ?? "Could not record your NDA. Please try again."); return; }
      recordAccessLog(listingId, "nda_signed");
      setNdaAccepted(true);
    } catch {
      setNdaError("Network error. Please try again.");
    } finally {
      setNdaSubmitting(false);
    }
  }

  function handleDownloadPdf() {
    // Print the CURRENT on-screen report (Save as PDF in the print dialog) so the
    // download always matches this version. The old server-side PDF export was a
    // separate template that didn't reflect report updates.
    recordAccessLog(listingId, "pdf_downloaded", { mode: "print" });
    // The browser's "Save as PDF" uses document.title for the filename — set it to
    // a clean, business-named title, then restore it afterwards.
    const prevTitle = document.title;
    const safeName = (data?.meta?.businessName ?? businessName ?? "Business").trim();
    document.title = `EXIT360 — ${safeName} Report`;
    setPrintMode(true);
    setTimeout(() => {
      const restore = () => {
        setPrintMode(false);
        document.title = prevTitle;
        window.removeEventListener("afterprint", restore);
      };
      window.addEventListener("afterprint", restore);
      window.print();
    }, 300);
  }

  function handlePrint() {
    window.print();
    recordAccessLog(listingId, "report_printed");
  }

  // ── SECTIONS ──────────────────────────────────────────────────────────────
  // Sections removed from the report entirely (they also fall through to the
  // "ungrouped" renderer, so they must be filtered here, not just from groups).
  const REMOVED_SECTION_KEYS = new Set([
    "business_health_score",       // app-based section-completeness score, not a real valuation
    "lease_risk_valuation_impact", // empty / low-value risk breakdown
    "swot_analysis",
  ]);
  const sections = (data?.sections ?? []).filter(
    (s) => s.includeInHtml && !REMOVED_SECTION_KEYS.has(s.sectionKey),
  );
  // Visuals (charts) removed from the report — these are reportVisuals, not
  // sections, so they need filtering separately from REMOVED_SECTION_KEYS.
  const REMOVED_VISUAL_TITLES = new Set([
    "business health score",
    "buyer engagement funnel",
    "lease risk breakdown",
  ]);
  const isRemovedVisual = (v: ReportVisualEntry) =>
    REMOVED_VISUAL_TITLES.has((v.title ?? "").trim().toLowerCase());
  // The revenue "by division" donut reads best 50/50 beside the divisions
  // breakdown table, so force it into the section's sidebar column.
  const SIDE_PLACEMENT_TITLE_HINTS = [
    "by division",
    "revenue by division",
    "revenue by",
    "division breakdown",
    "divisions breakdown",
  ];
  // The equipment "by category" chart should tuck directly under the section
  // paragraph, in the vacant gap beside the floated image (inline, no gap).
  const isNarrowChart = (v: ReportVisualEntry) => {
    const t = (v.title ?? "").trim().toLowerCase();
    return t.includes("by category") || t.includes("equipment by") || t.includes("by segment");
  };
  const asSidePlacement = (v: ReportVisualEntry): ReportVisualEntry => {
    const t = (v.title ?? "").trim().toLowerCase();
    if (SIDE_PLACEMENT_TITLE_HINTS.some((h) => t.includes(h))) {
      return { ...v, sectionPlacement: "sidebar" };
    }
    if (isNarrowChart(v)) {
      return { ...v, sectionPlacement: "inline" };
    }
    return v;
  };
  const businessName = data?.meta?.businessName ?? "Confidential Business";
  const contactUrl = (intent: string) =>
    `/sign-in?intent=${intent}&listingId=${listingId}&listingName=${encodeURIComponent(businessName)}&return=${encodeURIComponent(`/listings/${listingId}`)}`;
  // Exit routes so a buyer is never stuck inside the report.
  const listingUrl = `/listings/${listingId}`;
  const buyerLoggedIn = typeof window !== "undefined" && !!localStorage.getItem("exit360_buyer_token");
  const portalUrl = buyerLoggedIn ? "/buyers/portal" : "/buyers";

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

  // ── NDA GATE ────────────────────────────────────────────────────────────────
  // Buyers arriving with a report-access token must accept the per-listing NDA
  // before any confidential content renders.
  if (accessToken && ndaChecked && ndaRequired && !ndaAccepted) {
    const bizName = (data?.meta?.businessName ?? businessName ?? "this business").trim();
    return (
      <div className="min-h-screen bg-[#070F1C] text-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-[#0A1828] border border-[#1E3A5C] rounded-2xl p-7">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
            <FileText className="text-blue-400" size={22} />
          </div>
          <h1 className="text-xl font-bold mb-2">Non-Disclosure Agreement</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            The information memorandum for <span className="text-white font-medium">{bizName}</span> is
            strictly confidential.
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[#1E3A5C] bg-[#070F1C] p-3 text-xs text-slate-400 leading-relaxed mb-4 whitespace-pre-wrap">
            {ndaText || "By signing, you agree that all financials, documents and business details in this report are strictly confidential and used solely to evaluate this opportunity."}
          </div>
          {ndaManualOnly ? (
            <>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Access to this report is granted directly by the seller or broker. Please contact them to
                request access — once granted, this report will open automatically for your verified number.
              </p>
              <a href={contactUrl("info")} className="block w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold grid place-items-center">
                Request access
              </a>
            </>
          ) : (
            <>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Your full name</label>
              <input
                type="text"
                value={ndaName}
                onChange={(e) => setNdaName(e.target.value)}
                placeholder="e.g. Cara Matthews"
                className="w-full px-3.5 py-2.5 rounded-lg border-2 border-[#1E3A5C] bg-[#070F1C] text-white text-sm outline-none focus:border-blue-500/60 transition-colors mb-3"
              />
              <label className="flex items-start gap-2.5 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={ndaAgree}
                  onChange={(e) => setNdaAgree(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-500 flex-shrink-0"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  I have read and agree to the Non-Disclosure Agreement for {bizName}.
                </span>
              </label>
              {ndaError && <p className="text-sm text-red-400 mb-3">{ndaError}</p>}
              <button
                onClick={acceptNda}
                disabled={ndaSubmitting}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {ndaSubmitting ? "Recording…" : "Agree & View Report"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("min-h-screen font-sans relative", printMode ? "bg-white text-slate-900 print-mode" : "text-white")}
    >

      {/* ── Animated morphing background ───────────────────────────────────── */}
      {!printMode && (
        <div className="report-bg-anim fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
          <span className="report-blob report-blob--a" />
          <span className="report-blob report-blob--b" />
          <span className="report-blob report-blob--c" />
          <span className="report-blob report-blob--d" />
          <span className="report-bg-noise" />
        </div>
      )}

      {/* ── Sticky Nav ─────────────────────────────────────────────────────── */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b print:hidden transition-colors",
        printMode ? "bg-white border-slate-200" : "bg-[#070F1C]/95 backdrop-blur border-[#1E3A5C]"
      )}>
        <div className="max-w-[1440px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {groupedSections.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open chapters"
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                className={cn(
                  "xl:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border flex-shrink-0 relative z-10 active:scale-95 transition-transform",
                  printMode ? "border-slate-200 text-slate-600" : "border-[#1E3A5C] text-slate-300 hover:text-white"
                )}
              >
                <Menu size={18} />
              </button>
            )}
            <button
              onClick={() => navigate(listingUrl)}
              title="Back to listing"
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors flex-shrink-0",
                printMode ? "border-slate-200 text-slate-600 hover:bg-slate-50" : "border-[#1E3A5C] text-slate-300 hover:text-white hover:bg-[#0F2040]"
              )}
            >
              <ArrowLeft size={13} /> <span className="hidden sm:inline">Listing</span>
            </button>
            {printMode ? (
              <span className="text-xs font-bold tracking-wider text-slate-400">EXIT360</span>
            ) : (
              <Logo height={18} className="text-primary" />
            )}
            <span className={cn("hidden sm:inline", printMode ? "text-slate-300" : "text-[#1E3A5C]")}>/</span>
            <span className={cn("text-sm font-semibold truncate hidden sm:inline", printMode ? "text-slate-700" : "text-white")}>
              {businessName}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate(portalUrl)}
              title="My Portal"
              className={cn(
                "hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                printMode ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-[#0F2040] border-[#1E3A5C] text-slate-300 hover:text-white"
              )}
            >
              <User size={12} /> My Portal
            </button>
            {equipment && (
              <a
                href="#equipment-register"
                className={cn(
                  "hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                  printMode ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-[#0F2040] border-[#1E3A5C] text-slate-300 hover:text-white"
                )}
              >
                <Wrench size={12} /> Equipment
              </a>
            )}
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
              onClick={() => { recordAccessLog(listingId, "inspection_booked"); navigate(contactUrl("call")); }}
              className={cn(
                "hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                printMode
                  ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  : "bg-[#0F2040] border-[#1E3A5C] text-slate-300 hover:text-white"
              )}
            >
              <Calendar size={12} /> Book Inspection
            </button>
            <button
              onClick={() => { recordAccessLog(listingId, "contact_clicked"); navigate(contactUrl("info")); }}
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                printMode
                  ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  : "bg-[#0F2040] border-[#1E3A5C] text-slate-300 hover:text-white"
              )}
            >
              <Phone size={12} /> Contact Seller
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

      {/* ── Mobile chapter drawer ──────────────────────────────────────────── */}
      {mobileNavOpen && groupedSections.length > 0 && (
        <div className="xl:hidden fixed inset-0 z-[60] print:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[82vw] bg-[#070F1C] border-r border-[#1E3A5C] overflow-y-auto py-5 shadow-2xl">
            <div className="flex items-center justify-between px-5 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Chapters</span>
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close" className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            {groupedSections.map((g, i) => (
              <a
                key={g.key}
                href={`#chapter-${g.key}`}
                onClick={() => { setActiveChapter(g.key); setMobileNavOpen(false); }}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 text-[15px] border-l-2",
                  activeChapter === g.key ? "border-blue-500 bg-blue-500/10 text-blue-300 font-semibold" : "border-transparent text-slate-300 hover:bg-[#1E3A5C]/40 hover:text-white"
                )}
              >
                <span className="text-xs font-bold text-blue-600 w-5">{String(i + 1).padStart(2, "0")}</span>
                <span>{g.title}</span>
              </a>
            ))}
            <div className="mt-4 pt-4 mx-5 border-t border-[#1E3A5C]">
              <span className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Quick Links</span>
              {equipment && (
                <a href="#equipment-register" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 py-2 text-[15px] text-slate-300 hover:text-white">
                  <Wrench size={14} className="flex-shrink-0" /> Equipment Register
                </a>
              )}
              <button onClick={() => { setMobileNavOpen(false); navigate(listingUrl); }} className="flex items-center gap-2 py-2 text-[15px] text-slate-300 hover:text-white w-full text-left">
                <ArrowLeft size={14} className="flex-shrink-0" /> View Listing
              </button>
              <button onClick={() => { setMobileNavOpen(false); navigate(portalUrl); }} className="flex items-center gap-2 py-2 text-[15px] text-slate-300 hover:text-white w-full text-left">
                <User size={14} className="flex-shrink-0" /> My Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cover Section — title block above, clean hero image banner below ── */}
      <section id="cover" className={cn(
        "relative pt-14",
        printMode ? "bg-slate-50 border-b border-slate-200" : ""
      )}>
        {/* Title block (sits on the animated background, not over the image) */}
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 pt-14 pb-8">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border",
              printMode ? "bg-red-50 border-red-200 text-red-700" : "bg-red-500/15 border-red-500/30 text-red-300"
            )}>
              <Shield size={11} /> CONFIDENTIAL
            </span>
            <span className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border",
              printMode ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-blue-500/15 border-blue-500/30 text-blue-200"
            )}>
              <CheckCircle2 size={11} /> Exit360 Verified
            </span>
          </div>

          <p className={cn("text-sm font-semibold uppercase tracking-[0.25em] mb-3", printMode ? "text-slate-400" : "text-blue-300")}>
            Information Memorandum
          </p>
          <h1
            className={cn("text-5xl md:text-7xl xl:text-8xl font-extrabold mb-4 leading-[1.02] tracking-tight", printMode ? "text-slate-900" : "")}
            style={printMode ? undefined : {
              backgroundImage: "linear-gradient(120deg, #ffffff 0%, #dbeafe 40%, #c4b5fd 75%, #99f6e4 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {businessName}
          </h1>

          {/* Business metadata row: category · location · asking price */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4">
            {data?.meta?.category && (
              <span className={cn("inline-flex items-center gap-1.5 text-sm", printMode ? "text-slate-500" : "text-slate-300")}>
                <Tag size={13} /> {data.meta.category}
              </span>
            )}
            {data?.meta?.location && (
              <span className={cn("inline-flex items-center gap-1.5 text-sm", printMode ? "text-slate-500" : "text-slate-300")}>
                <MapPin size={13} /> {data.meta.location}
              </span>
            )}
            {data?.meta?.askingPrice != null && data.meta.askingPrice > 0 && (
              <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", printMode ? "text-emerald-700" : "text-emerald-300")}>
                <DollarSign size={13} /> {data.meta.askingPrice >= 1_000_000
                  ? `$${(data.meta.askingPrice / 1_000_000).toFixed(2)}M`
                  : data.meta.askingPrice >= 1_000
                  ? `$${(data.meta.askingPrice / 1_000).toFixed(0)}K`
                  : `$${data.meta.askingPrice.toLocaleString()}`}
              </span>
            )}
          </div>

          <p className={cn("text-sm mb-8", printMode ? "text-slate-500" : "text-slate-400")}>
            Confidential Business Profile · Prepared by Exit360 · {new Date().toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              onClick={() => { recordAccessLog(listingId, "contact_clicked"); navigate(contactUrl("info")); }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <Phone size={15} /> Contact Seller
            </button>
            <button
              onClick={() => { recordAccessLog(listingId, "inspection_booked"); navigate(contactUrl("call")); }}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors",
                printMode ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-[#0F2040]/70 border-[#1E3A5C] text-slate-200 hover:text-white"
              )}
            >
              <Calendar size={15} /> Book Inspection
            </button>
            <button
              onClick={() => navigate(listingUrl)}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors",
                printMode ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-[#0F2040]/70 border-[#1E3A5C] text-slate-200 hover:text-white"
              )}
            >
              <ArrowLeft size={15} /> View Listing
            </button>
            <button
              onClick={() => navigate(portalUrl)}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors",
                printMode ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-[#0F2040]/70 border-[#1E3A5C] text-slate-200 hover:text-white"
              )}
            >
              <User size={15} /> My Portal
            </button>
          </div>
        </div>

        {/* Clean, high-resolution hero image banner (no overlay) */}
        {data?.meta?.heroImageUrl && (
          <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 pb-14">
            <div className={cn(
              "rounded-2xl overflow-hidden border shadow-2xl",
              printMode ? "border-slate-200" : "border-[#1E3A5C]"
            )}>
              <img
                src={cldHero(data.meta.heroImageUrl)}
                alt={`${businessName} — cover photo`}
                className="w-full object-cover h-[46vh] md:h-[64vh] xl:h-[72vh]"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  const fallback = cldHiRes(data.meta.heroImageUrl, 2560);
                  if (el.src !== fallback && el.dataset.fallback !== "1") {
                    el.dataset.fallback = "1";
                    el.src = fallback;
                  } else {
                    el.style.display = "none";
                  }
                }}
              />
            </div>
          </div>
        )}
      </section>


      {/* Top horizontal chapter strip + Contents block removed — the left sidebar is the nav. */}

      {/* ── Sidebar + content — centred together, capped at 1440px ──────────────── */}
      <div className="max-w-[1440px] mx-auto xl:flex xl:items-start">
      {/* ── Desktop sidebar ───────────────────────────────────────────────────── */}
      {groupedSections.length > 0 && (
        <aside className={cn(
          "hidden xl:flex flex-col sticky top-14 self-start w-72 flex-shrink-0 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-r z-30 py-6 print:hidden",
          printMode ? "bg-white border-slate-200" : "border-[#1E3A5C]"
        )}>
          <div className="px-5 mb-4">
            <span className={cn("text-xs font-bold uppercase tracking-widest", printMode ? "text-slate-400" : "text-slate-500")}>
              Chapters
            </span>
          </div>
          {groupedSections.map((g, i) => {
            const isOpen = openChapter === g.key;
            return (
            <div key={g.key}>
              <a
                href={`#chapter-${g.key}`}
                onClick={() => {
                  setActiveChapter(g.key);
                  // Accordion: open the touched chapter, close the previously open one.
                  setOpenChapter((prev) => (prev === g.key ? null : g.key));
                }}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 text-[15px] leading-snug transition-colors border-l-2",
                  activeChapter === g.key
                    ? "border-blue-500 bg-blue-500/10 text-blue-300 font-semibold"
                    : printMode
                    ? "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    : "border-transparent text-slate-400 hover:bg-[#1E3A5C]/40 hover:text-white"
                )}
              >
                <span className={cn(
                  "text-xs font-bold flex-shrink-0 w-5",
                  activeChapter === g.key ? "text-blue-400" : "text-blue-600"
                )}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1">{g.title}</span>
                {g.sections.length > 0 && (
                  <ChevronDown size={13} className={cn("flex-shrink-0 transition-transform opacity-70", isOpen ? "rotate-180" : "")} />
                )}
              </a>
              {isOpen && g.sections.length > 0 && (
                <div className="pb-1">
                  {g.sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.sectionKey}`}
                      className={cn(
                        "flex items-center gap-2 pl-12 pr-4 py-1.5 text-[13px] leading-snug transition-colors",
                        printMode ? "text-slate-500 hover:text-slate-800" : "text-slate-500 hover:text-slate-200"
                      )}
                    >
                      <ChevronRight size={11} className="flex-shrink-0 opacity-60" />
                      <span>{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
          })}

          {/* Quick links — so the buyer can always leave the report */}
          <div className={cn("mt-5 pt-4 mx-5 border-t", printMode ? "border-slate-200" : "border-[#1E3A5C]")}>
            <span className={cn("block text-xs font-bold uppercase tracking-widest mb-2", printMode ? "text-slate-400" : "text-slate-500")}>
              Quick Links
            </span>
            {equipment && (
              <a href="#equipment-register" className={cn("flex items-center gap-2 py-1.5 text-[14px] transition-colors", printMode ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white")}>
                <Wrench size={13} className="flex-shrink-0" /> Equipment Register
              </a>
            )}
            <button onClick={() => navigate(listingUrl)} className={cn("flex items-center gap-2 py-1.5 text-[14px] w-full text-left transition-colors", printMode ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white")}>
              <ArrowLeft size={13} className="flex-shrink-0" /> View Listing
            </button>
            <button onClick={() => navigate(portalUrl)} className={cn("flex items-center gap-2 py-1.5 text-[14px] w-full text-left transition-colors", printMode ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white")}>
              <User size={13} className="flex-shrink-0" /> My Portal
            </button>
          </div>
        </aside>
      )}

      {/* ── Chapter Groups ────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 px-6 py-10 space-y-14">
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
                              .filter((v) => v.sectionKey === section.sectionKey && v.includeInHtml && !isRemovedVisual(v))
                              .map(asSidePlacement)
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
                          const narrow = isNarrowChart(v);
                          if (v.status === "ready") {
                            if (narrow) {
                              return (
                                <div key={v.id} className="w-full sm:max-w-md">
                                  <ReportVisualBlock visual={v} printMode={printMode} />
                                </div>
                              );
                            }
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
                          : <SectionContent section={section} listingId={listingId} reportImages={data?.meta?.reportImages} printMode={printMode} tourSrcDoc={data?.meta?.tourSrcDoc} inlineVisuals={inlineVisuals} heroImageUrl={data?.meta?.heroImageUrl} />;
                        return (
                          <>
                            {/* above_body: render before section body */}
                            {aboveVisuals.map(renderVisual)}
                            {/* sidebar: flex-row layout with section body in main column */}
                            {sidebarVisuals.length > 0 ? (
                              <div className="flex flex-col sm:flex-row gap-6 items-start">
                                <div className="flex-1 min-w-0">{mainContent}</div>
                                <div className="w-full sm:w-[42%] lg:w-[44%] flex-shrink-0 space-y-3">
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

                {/* Full equipment register lives under the Assets & Equipment chapter */}
                {group.key === "assets_equipment" && equipment && (
                  <EquipmentRegisterSection reg={equipment} printMode={printMode} inline />
                )}
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
                      .filter((v) => v.sectionKey === section.sectionKey && v.includeInHtml && !isRemovedVisual(v))
                      .map(asSidePlacement)
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
                  : <SectionContent section={section} listingId={listingId} reportImages={data?.meta?.reportImages} printMode={printMode} tourSrcDoc={data?.meta?.tourSrcDoc} inlineVisuals={inlineVisuals} heroImageUrl={data?.meta?.heroImageUrl} />;
                return (
                  <>
                    {aboveVisuals.map(renderVisual)}
                    {sidebarVisuals.length > 0 ? (
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="flex-1 min-w-0">{mainContent}</div>
                        <div className="w-full sm:w-[42%] lg:w-[44%] flex-shrink-0 space-y-3">
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
            .filter((v) => !v.sectionKey && v.includeInHtml && !isRemovedVisual(v))
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
      </div>

      {/* Equipment register now renders inside the Assets & Equipment chapter above.
          Fallback: if that chapter isn't present but equipment exists, show it here. */}
      {equipment && !groupedSections.some((g) => g.key === "assets_equipment") && (
        <EquipmentRegisterSection reg={equipment} printMode={printMode} />
      )}

      {/* ── Disclaimer ────────────────────────────────────────────────────────── */}
      <footer className={cn(
        "border-t mt-4 py-10 print:pt-4",
        printMode ? "bg-slate-50 border-slate-200" : "bg-[#070F1C] border-[#1E3A5C]"
      )}>
        <div className="max-w-[1440px] mx-auto px-6 space-y-4">
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
        /* Print / PDF readability: the dark-theme body text utilities are far too
           light on white. Force them to the same dark slate as the side menu. */
        .print-mode .text-slate-200,
        .print-mode .text-slate-300 { color: #1e293b !important; }
        .print-mode .text-slate-400 { color: #334155 !important; }
        .print-mode .text-slate-500 { color: #475569 !important; }
        /* Chart/visual cards read on a dark panel — lighten them for print. */
        .print-mode .report-chart-card { background: #f8fafc !important; border-color: #e2e8f0 !important; }
        @media print {
          /* Let long content flow across pages without slicing cards mid-row */
          section, .report-avoid-break { break-inside: avoid; }
          .report-bg-anim { display: none !important; }
        }

        /* Animated morphing background — ultra-smooth, no visible rings */
        /* Canvas + blobs follow the active colour theme (grad-from/via/to/glow) */
        .report-bg-anim { background: hsl(var(--background)); }
        .report-blob {
          position: absolute;
          display: block;
          border-radius: 50%;
          filter: blur(140px);
          mix-blend-mode: screen;
          will-change: transform;
        }
        /* Many gentle stops + heavy blur => no banding/rings on the dark canvas */
        .report-blob--a {
          width: 62vw; height: 62vw; left: -14vw; top: -18vw;
          background: radial-gradient(circle at 50% 50%,
            hsl(var(--grad-from) / 0.42) 0%, hsl(var(--grad-from) / 0.34) 14%, hsl(var(--grad-from) / 0.24) 28%,
            hsl(var(--grad-from) / 0.15) 42%, hsl(var(--grad-from) / 0.08) 58%, hsl(var(--grad-from) / 0.03) 74%, hsl(var(--grad-from) / 0) 90%);
          animation: blobMoveA 16s ease-in-out infinite alternate;
        }
        .report-blob--b {
          width: 58vw; height: 58vw; right: -16vw; top: -10vw;
          background: radial-gradient(circle at 50% 50%,
            hsl(var(--grad-via) / 0.40) 0%, hsl(var(--grad-via) / 0.32) 14%, hsl(var(--grad-via) / 0.22) 28%,
            hsl(var(--grad-via) / 0.14) 42%, hsl(var(--grad-via) / 0.07) 58%, hsl(var(--grad-via) / 0.03) 74%, hsl(var(--grad-via) / 0) 90%);
          animation: blobMoveB 19s ease-in-out infinite alternate;
        }
        .report-blob--c {
          width: 66vw; height: 66vw; right: -4vw; top: 38vh;
          background: radial-gradient(circle at 50% 50%,
            hsl(var(--grad-to) / 0.30) 0%, hsl(var(--grad-to) / 0.23) 14%, hsl(var(--grad-to) / 0.16) 28%,
            hsl(var(--grad-to) / 0.10) 42%, hsl(var(--grad-to) / 0.05) 58%, hsl(var(--grad-to) / 0.02) 74%, hsl(var(--grad-to) / 0) 90%);
          animation: blobMoveC 22s ease-in-out infinite alternate;
        }
        .report-blob--d {
          width: 64vw; height: 64vw; left: 2vw; bottom: -22vw;
          background: radial-gradient(circle at 50% 50%,
            hsl(var(--glow) / 0.32) 0%, hsl(var(--glow) / 0.25) 14%, hsl(var(--glow) / 0.17) 28%,
            hsl(var(--glow) / 0.10) 42%, hsl(var(--glow) / 0.05) 58%, hsl(var(--glow) / 0.02) 74%, hsl(var(--glow) / 0) 90%);
          animation: blobMoveD 18s ease-in-out infinite alternate;
        }
        /* Fine noise overlay dithers away 8-bit colour banding on the gradients */
        .report-bg-noise {
          position: absolute; inset: 0; pointer-events: none;
          opacity: 0.05; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        @keyframes blobMoveA {
          0%   { transform: translate3d(0,0,0) scale(1); }
          100% { transform: translate3d(20vw, 14vh, 0) scale(1.2); }
        }
        @keyframes blobMoveB {
          0%   { transform: translate3d(0,0,0) scale(1.1); }
          100% { transform: translate3d(-18vw, 18vh, 0) scale(0.9); }
        }
        @keyframes blobMoveC {
          0%   { transform: translate3d(0,0,0) scale(0.95); }
          100% { transform: translate3d(-16vw, -20vh, 0) scale(1.15); }
        }
        @keyframes blobMoveD {
          0%   { transform: translate3d(0,0,0) scale(1.12); }
          100% { transform: translate3d(18vw, -16vh, 0) scale(0.92); }
        }
        @media (prefers-reduced-motion: reduce) {
          .report-blob { animation: none !important; }
        }
        /* On phones the continuously-animating, heavily-blurred blobs are very
           expensive to composite and can starve touch handling (the topbar menu
           needing several taps). Freeze the animation and lighten the blur on
           small screens — the gradient still looks great, just static. */
        @media (max-width: 767px) {
          .report-blob { animation: none !important; filter: blur(90px) !important; }
        }
      `}</style>
    </div>
  );
}
