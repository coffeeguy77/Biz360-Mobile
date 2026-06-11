import { useParams } from "wouter";
import { useEffect, useState, useRef } from "react";
import {
  Lock, Download, ExternalLink, Phone, Calendar, Shield,
  CheckCircle2, FileText, MapPin, Printer, ChevronRight, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ValuationBridgeChart, RevenueDivisionChart, ValuationDivisionChart,
  EquipmentCategoryChart, BuyerEngagementChart, LeaseRiskChart,
  RevenueSourceChart, HealthScoreChart, SECTION_CHART_MAP,
} from "@/components/report/ChartComponents";

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

interface ReportMeta {
  businessName: string;
  listingId: string;
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

function SectionBodyText({ body }: { body: string }) {
  const paras = body.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="space-y-3">
      {paras.map((p, i) => (
        <p key={i} className="text-slate-300 leading-relaxed text-[15px]">{p.trim()}</p>
      ))}
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
    <div className="mt-4 overflow-x-auto rounded-xl border border-[#1E3A5C]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0F2040]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-slate-400 font-semibold text-xs uppercase tracking-wider">
                {h.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn("border-t border-[#1E3A5C]", i % 2 === 0 ? "bg-transparent" : "bg-[#0F2040]/40")}>
              {headers.map((h) => (
                <td key={h} className="px-4 py-2.5 text-slate-300">
                  {String((row as Record<string, unknown>)[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionContent({
  section,
  listingId,
}: {
  section: ReportSection;
  listingId: string;
}) {
  const ChartComponent = SECTION_CHART_MAP[section.sectionKey];
  const chartData = section.chartData
    ? (typeof section.chartData === "string" ? JSON.parse(section.chartData) : section.chartData)
    : undefined;

  const hasContent = section.body || (section.bulletPoints?.length ?? 0) > 0 || section.tableData;
  const is360 = section.sectionKey === "360_business_walkthrough";

  return (
    <div className="space-y-4">
      {!hasContent && !ChartComponent && !is360 && (
        <p className="text-slate-500 italic text-sm">This section has not yet been completed.</p>
      )}
      {section.body && <SectionBodyText body={section.body} />}
      {section.bulletPoints && section.bulletPoints.length > 0 && (
        <SectionBullets bullets={section.bulletPoints} />
      )}
      {section.tableData && <SectionTable data={section.tableData} />}
      {ChartComponent && (
        <div className="mt-6 p-4 rounded-xl bg-[#070F1C]/60 border border-[#1E3A5C]/60">
          <ChartComponent data={chartData} />
        </div>
      )}
      {is360 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => recordAccessLog(listingId, "tour_clicked", { sectionKey: section.sectionKey })}
            className="inline-flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-semibold text-sm px-5 py-2.5 rounded-xl border border-blue-500/30 transition-colors"
          >
            🎯 Enter Virtual Tour
          </button>
        </div>
      )}
    </div>
  );
}

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

  const [data, setData]           = useState<ReportData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listingId) { setError("No listing ID provided."); setLoading(false); return; }
    setLoading(true);

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
      const token = localStorage.getItem("biz360_auth_token");
      const endpoint = token
        ? `/api/report-versions/snapshot/${versionId}`
        : qs(`/api/report-versions/public-snapshot/${versionId}`);
      fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
        .then((json: { sections: ReportSection[]; title?: string }) =>
          setData({ sections: json.sections, accessLevel: token ? "seller" : "public" }))
        .catch(() => {
          // Fall back to live sections if snapshot not accessible
          const liveToken = localStorage.getItem("biz360_auth_token");
          fetch(qs(`/api/report-sections/html/${listingId}`), {
            headers: liveToken ? { Authorization: `Bearer ${liveToken}` } : {},
          })
            .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
            .then((json: ReportData) => setData(json))
            .catch((e) => setError(String(e)));
        })
        .finally(() => setLoading(false));
    } else {
      // Live view: send seller token if present (unlocks approved_buyers sections).
      // accessToken forwarded so OTP-verified buyers can unlock approved_buyers sections.
      const token = localStorage.getItem("biz360_auth_token");
      fetch(qs(`/api/report-sections/html/${listingId}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
        .then((json: ReportData) => setData(json))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    recordAccessLog(listingId, "report_viewed", versionId ? { versionId } : {});
  }, [listingId, versionId, accessToken]);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      // Public buyer PDF — no auth required. Includes only public sections.
      const res = await fetch(`/api/report-exports/pdf-public/${listingId}`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `im-report-${listingId}.pdf`; a.click();
      URL.revokeObjectURL(url);
      recordAccessLog(listingId, "pdf_downloaded", { mode: "buyer_public" });
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

  const tocSections = sections.filter((s) =>
    !["disclaimer"].includes(s.sectionKey)
  );

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
          <p className={cn("text-base mb-8", printMode ? "text-slate-500" : "text-slate-400")}>
            Confidential Business Profile · Prepared by Exit360
          </p>

          {/* Metric cards from auto-fill data (shown if section body has figures) */}
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
          </div>
        </div>
      </section>

      {/* ── Table of Contents ───────────────────────────────────────────────── */}
      {tocSections.length > 0 && (
        <nav className={cn(
          "border-y py-8 print:hidden",
          printMode ? "bg-slate-50 border-slate-200" : "bg-[#0F2040]/60 border-[#1E3A5C]"
        )}>
          <div className="max-w-5xl mx-auto px-6">
            <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-4", printMode ? "text-slate-400" : "text-slate-500")}>
              Contents
            </p>
            <div className="columns-1 sm:columns-2 md:columns-3 gap-x-6 space-y-0">
              {tocSections.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.sectionKey}`}
                  className={cn(
                    "flex items-center gap-2 py-1.5 text-sm transition-colors block",
                    printMode ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-blue-400"
                  )}
                >
                  <span className={cn("text-[10px] font-bold w-5 flex-shrink-0", printMode ? "text-slate-400" : "text-slate-600")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                  {s.isLocked && <Lock size={10} className="text-amber-400 flex-shrink-0" />}
                </a>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* ── Section Cards ────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {sections.map((section, idx) => {
          const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
          return (
            <section
              key={section.id}
              id={section.sectionKey}
              className={cn(
                "rounded-2xl border p-8 scroll-mt-16 transition-colors",
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
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded"
                      style={{ backgroundColor: accent + "22", color: accent }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <h2 className={cn("text-xl font-bold", printMode ? "text-slate-900" : "text-white")}>
                      {section.title}
                    </h2>
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

              {section.isLocked
                ? <LockedSection title={section.title} subtitle={section.subtitle ?? null} listingId={listingId} sectionKey={section.sectionKey} />
                : <SectionContent section={section} listingId={listingId} />
              }

              {/* Seller notes (only shown when caller is the verified seller) */}
              {section.sellerNotes && !section.isLocked && data?.accessLevel === "seller" && (
                <div className={cn(
                  "mt-5 p-4 rounded-xl border-l-2 border-amber-500/40 text-sm",
                  printMode ? "bg-amber-50 text-amber-800" : "bg-amber-500/5 text-amber-300"
                )}>
                  <span className="font-semibold text-xs uppercase tracking-wider block mb-1">Seller Notes</span>
                  {section.sellerNotes}
                </div>
              )}
            </section>
          );
        })}
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
