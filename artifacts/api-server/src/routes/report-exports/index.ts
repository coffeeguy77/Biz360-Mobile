import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import {
  db, reportSectionsTable, reportExportsTable, cafesTable, reportVersionsTable,
  cafeEquipmentTable, valuationSnapshotsTable, reportAccessLogsTable,
} from "@workspace/db";
import { eq, asc, and, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { generateChartSvg } from "../../lib/chart-svg";
import {
  REPORT_GROUPS, DATA_ROOM_SECTION_KEYS, METRIC_CARD_CHAPTER_KEYS,
  COVER_METRIC_TARGETS, sectionHasContent, sectionIsPlaceholder,
  type PdfStyle,
} from "../../lib/report-groups";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SVGtoPDF = require("svg-to-pdfkit");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const router = Router();

// ── Layout constants ──────────────────────────────────────────────────────────
const PAGE_W     = 595.28;
const PAGE_H     = 841.89;
const MARGIN     = 52;
const CONTENT_W  = PAGE_W - MARGIN * 2;
const HDR_H      = 36;
const FTR_H      = 30;
const CONTENT_TOP    = HDR_H + 16;
const CONTENT_BOTTOM = PAGE_H - FTR_H - 14;

// ── Color palette ─────────────────────────────────────────────────────────────
// Cover / chapter-divider pages
const DARK      = "#070F1C";
const DARK_MID  = "#0F2040";
// White body pages
const WHITE     = "#FFFFFF";
const NAVY      = "#0A1828";
const BLUE_ACC  = "#3B82F6";
const BODY_TEXT = "#374151";
const SUBTITLE_C = "#6B7280";
const HEADING_C  = "#0F172A";
const CHAPTER_BG = "#EFF6FF";
const BORDER_C   = "#E2E8F0";
const MUTED_HDR  = "#94A3B8";

interface PdfCtx { doc: any; biz: string; pg: number; }

// ── White content page (navy header + footer) ─────────────────────────────────
function whitePage(ctx: PdfCtx): number {
  ctx.doc.addPage({ size: "A4", margin: 0 });
  ctx.pg++;
  ctx.doc.save().rect(0, 0, PAGE_W, PAGE_H).fill(WHITE).restore();
  ctx.doc.save().rect(0, 0, PAGE_W, HDR_H).fill(NAVY).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED_HDR)
    .text(ctx.biz.slice(0, 50), MARGIN, 14, { width: CONTENT_W / 2 });
  ctx.doc.font("Helvetica").fontSize(7).fillColor(MUTED_HDR)
    .text("Information Memorandum", MARGIN + CONTENT_W / 2, 14, { width: CONTENT_W / 2, align: "right" });
  ctx.doc.save().rect(0, PAGE_H - FTR_H, PAGE_W, FTR_H).fill(NAVY).restore();
  ctx.doc.font("Helvetica").fontSize(7).fillColor(SUBTITLE_C)
    .text("Confidential · Exit360", MARGIN, PAGE_H - 19, { width: CONTENT_W / 2 });
  ctx.doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED_HDR)
    .text(`${ctx.pg}`, MARGIN, PAGE_H - 19, { width: CONTENT_W, align: "right" });
  return CONTENT_TOP;
}

// ── Overflow guard ─────────────────────────────────────────────────────────────
function checkY(ctx: PdfCtx, y: number, need: number): number {
  return y + need > CONTENT_BOTTOM ? whitePage(ctx) : y;
}

// ── Text sanitizer ────────────────────────────────────────────────────────────
// Strip emoji and supplementary-plane characters that PDFKit's built-in fonts
// (Helvetica, Times-Roman, etc.) cannot encode — they produce broken byte
// sequences like "Ø<ß÷" in the rendered PDF.
function sanitizePdfText(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, "")  // emoji block + supplementary symbols
    .replace(/[\u{2600}-\u{27BF}]/gu, "")     // Misc Symbols, Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")     // Variation Selectors
    .replace(/\s+/g, " ")
    .trim();
}

// ── Business name extractor from section data ─────────────────────────────────
// Scans section tableData for a "Business Name" or "Trading Name" row — used as
// a fallback when val_cafes DB fields are empty or generic.
function extractBusinessNameFromSections(sections: any[]): string | null {
  function parseTable(td: unknown): Record<string, unknown>[] | null {
    if (typeof td === "string") { try { return JSON.parse(td); } catch { return null; } }
    return Array.isArray(td) ? (td as Record<string, unknown>[]) : null;
  }
  for (const key of ["executive_summary", "business_overview", "app_valuation_summary"]) {
    const sec = sections.find((s) => s.sectionKey === key);
    if (!sec?.tableData) continue;
    const rows = parseTable(sec.tableData);
    if (!rows?.length) continue;
    for (const row of rows) {
      const ks = Object.keys(row);
      if (ks.length < 2) continue;
      const label = String(row[ks[0]] ?? "").toLowerCase();
      const value = String(row[ks[1]] ?? "").trim();
      if (!value) continue;
      if (label.includes("business name") || label.includes("trading name") || label.includes("company name")) {
        return sanitizePdfText(value);
      }
    }
  }
  return null;
}

// ── Business name resolver — shared by both PDF handlers ──────────────────────
// Required fallback chain (task spec order):
//   listing.business_name → listing.title → listing.name → listing.trading_name
//   → section tableData "Business Name" / "Trading Name" row
//   → "My Business"
// businessName, title, and tradingName are real DB columns in val_cafes.
function resolveBusinessName(
  cafe: { name: string; businessName?: string | null; title?: string | null; tradingName?: string | null } | undefined | null,
  sections: any[],
): string {
  // Use trim+truthy so empty strings fall through to the next candidate
  const t = (v: string | null | undefined): string | undefined =>
    v?.trim() || undefined;
  const raw = t(cafe?.businessName)
    ?? t(cafe?.title)
    ?? t(cafe?.name)
    ?? t(cafe?.tradingName)
    ?? extractBusinessNameFromSections(sections)
    ?? "My Business";
  return sanitizePdfText(raw);
}

// ── Currency formatter ─────────────────────────────────────────────────────────
function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// ── Image pipeline ─────────────────────────────────────────────────────────────
// SSRF safety: only fetch images from known-safe HTTPS CDN hosts.
// Private/link-local IPs, metadata endpoints, and arbitrary hosts are blocked.
const ALLOWED_IMG_HOSTS = new Set([
  "res.cloudinary.com",
  "images.unsplash.com",
  "lh3.googleusercontent.com",
  "storage.googleapis.com",
  "cdn.exit360.com.au",
]);
const ALLOWED_IMG_PATTERNS: RegExp[] = [
  /^[a-z0-9-]+\.cloudinary\.com$/,
  /^[a-z0-9-]+\.s3\.[a-z0-9-]+\.amazonaws\.com$/,
  /^[a-z0-9-]+\.s3\.amazonaws\.com$/,
  /^[a-z0-9-]+\.replit\.app$/,
  /^[a-z0-9-]+\.replit\.dev$/,
  /^[a-z0-9-]+\.exit360\.com\.au$/,
];
const MAX_IMG_BYTES = 8_000_000; // 8 MB

function isAllowedImageUrl(rawUrl: string): boolean {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return false; }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (ALLOWED_IMG_HOSTS.has(host)) return true;
  if (ALLOWED_IMG_PATTERNS.some((p) => p.test(host))) return true;
  return false;
}

async function fetchImageBuffer(url: string, timeoutMs = 4000): Promise<Buffer | null> {
  if (!isAllowedImageUrl(url)) return null;
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);
    if (!resp.ok) return null;
    // Reject oversized responses before buffering
    const contentLength = resp.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMG_BYTES) return null;
    const arr = await resp.arrayBuffer();
    if (arr.byteLength > MAX_IMG_BYTES) return null;
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

function resolveImageUrl(sections: any[], ...sectionKeys: string[]): string | null {
  for (const key of sectionKeys) {
    const sec = sections.find((s) => s.sectionKey === key);
    if (!sec) continue;
    const cd = (() => {
      const raw = sec.chartData;
      if (!raw) return null;
      return typeof raw === "string"
        ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
        : raw;
    })();
    if (cd && typeof cd === "object" && !Array.isArray(cd)) {
      const urlKey = Object.keys(cd).find((k) => /url|image|thumbnail|photo/i.test(k));
      if (urlKey && typeof (cd as any)[urlKey] === "string" && (cd as any)[urlKey].startsWith("http")) {
        return (cd as any)[urlKey] as string;
      }
    }
    if (Array.isArray(cd)) {
      for (const item of cd) {
        if (item && typeof item === "object") {
          const urlKey = Object.keys(item).find((k) => /url|image|thumbnail|photo/i.test(k));
          if (urlKey && typeof item[urlKey] === "string" && item[urlKey].startsWith("http")) {
            return item[urlKey] as string;
          }
        }
      }
    }
    if (sec.body) {
      const m = (sec.body as string).match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/i);
      if (m) return m[0];
    }
  }
  return null;
}

// ── Body image block renderer ──────────────────────────────────────────────────
function renderBodyImage(
  ctx: PdfCtx, imageBuffer: Buffer | null, caption: string, y: number, isSellerDraft: boolean,
): number {
  const IMG_H = 150;
  if (!imageBuffer) {
    if (!isSellerDraft) return y;
    y = checkY(ctx, y, 32);
    ctx.doc.save().rect(MARGIN, y, CONTENT_W, 24).fill("#FEF3C7").restore();
    ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor("#92400E")
      .text(`${caption}: Image not supplied by seller.`, MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
    return y + 24 + 10;
  }
  y = checkY(ctx, y, IMG_H + 20);
  try {
    ctx.doc.image(imageBuffer, MARGIN, y, { fit: [CONTENT_W, IMG_H], align: "center", valign: "center" });
    ctx.doc.font("Helvetica").fontSize(7).fillColor(SUBTITLE_C)
      .text(caption, MARGIN, y + IMG_H + 3, { width: CONTENT_W });
    return y + IMG_H + 18;
  } catch {
    if (!isSellerDraft) return y;
    ctx.doc.save().rect(MARGIN, y, CONTENT_W, 24).fill("#FEF3C7").restore();
    ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor("#92400E")
      .text(`${caption}: Image could not be loaded.`, MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
    return y + 24 + 10;
  }
}

// ── Valuation Bridge visual ────────────────────────────────────────────────────
function renderValuationBridge(
  ctx: PdfCtx,
  snapshot: { adjustedEbitda: string | null; valuationMidpoint: string | null; totalEquipmentValue: string | null } | null,
  y: number, isSellerDraft: boolean,
): number {
  const adjEbitda = parseFloat(snapshot?.adjustedEbitda ?? "0") || 0;
  const midpoint  = parseFloat(snapshot?.valuationMidpoint ?? "0") || 0;
  const equip     = parseFloat(snapshot?.totalEquipmentValue ?? "0") || 0;
  if (!adjEbitda && !midpoint) {
    if (!isSellerDraft) return y;
    y = checkY(ctx, y, 28);
    ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
    ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
      .text("Valuation bridge data not available.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
    return y + 22 + 10;
  }
  const operatingVal = Math.max(0, midpoint - equip);
  const multiple = adjEbitda > 0 ? operatingVal / adjEbitda : 0;

  y = checkY(ctx, y, 100);
  ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(HEADING_C)
    .text("VALUATION BRIDGE", MARGIN, y, { width: CONTENT_W });
  y += 14;

  const BOX_W = Math.floor(CONTENT_W / 4) - 8;
  const BOX_H = 58;
  const items: Array<{ label: string; value: string; color: string; connector: string }> = [
    { label: "Adj. EBITDA",    value: fmtCurrency(adjEbitda),     color: BLUE_ACC,   connector: `×${multiple.toFixed(1)}x` },
    { label: "Oper. Value",    value: fmtCurrency(operatingVal),  color: "#10B981",  connector: "+" },
    { label: "Equipment",      value: fmtCurrency(equip),         color: "#F59E0B",  connector: "=" },
    { label: "Est. Value",     value: fmtCurrency(midpoint),      color: NAVY,       connector: "" },
  ];
  items.forEach(({ label, value, color, connector }, i) => {
    const bx = MARGIN + i * (BOX_W + 10);
    ctx.doc.save().rect(bx, y, BOX_W, BOX_H).fill(color).restore();
    ctx.doc.font("Helvetica").fontSize(7).fillColor(WHITE)
      .text(label.toUpperCase(), bx + 6, y + 7, { width: BOX_W - 12 });
    ctx.doc.font("Helvetica-Bold").fontSize(12).fillColor(WHITE)
      .text(value, bx + 6, y + 20, { width: BOX_W - 12 });
    if (connector) {
      ctx.doc.font("Helvetica-Bold").fontSize(10).fillColor(SUBTITLE_C)
        .text(connector, bx + BOX_W + 2, y + BOX_H / 2 - 7, { width: 12, align: "center" });
    }
  });
  return y + BOX_H + 16;
}

// ── Equipment Summary block ────────────────────────────────────────────────────
function renderEquipmentSummary(
  ctx: PdfCtx,
  equipment: Array<{ name: string; category: string | null; currentValue: string | null }>,
  y: number, isSellerDraft: boolean,
): number {
  const active = equipment.filter((e) => parseFloat(e.currentValue ?? "0") > 0);
  if (!active.length) {
    if (!isSellerDraft) return y;
    y = checkY(ctx, y, 28);
    ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
    ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
      .text("Equipment ledger not available.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
    return y + 22 + 10;
  }
  const totalValue = active.reduce((s, e) => s + parseFloat(e.currentValue ?? "0"), 0);
  const top5 = [...active].sort((a, b) => parseFloat(b.currentValue!) - parseFloat(a.currentValue!)).slice(0, 5);
  const catCount = new Set(active.map((e) => e.category).filter(Boolean)).size;

  y = checkY(ctx, y, 60 + top5.length * 17 + 36);
  ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(HEADING_C)
    .text("EQUIPMENT SUMMARY", MARGIN, y, { width: CONTENT_W });
  y += 14;

  const stats = [
    { label: "Total Value", value: fmtCurrency(totalValue) },
    { label: "Asset Count", value: String(active.length) },
    { label: "Categories", value: String(catCount) },
  ];
  const statW = CONTENT_W / stats.length;
  stats.forEach(({ label, value }, i) => {
    const bx = MARGIN + i * statW;
    ctx.doc.save().rect(bx, y, statW - 6, 36).fill(CHAPTER_BG).restore();
    ctx.doc.save().rect(bx, y, 4, 36).fill(BLUE_ACC).restore();
    ctx.doc.font("Helvetica").fontSize(7).fillColor(SUBTITLE_C)
      .text(label.toUpperCase(), bx + 10, y + 6, { width: statW - 16 });
    ctx.doc.font("Helvetica-Bold").fontSize(12).fillColor(HEADING_C)
      .text(value, bx + 10, y + 18, { width: statW - 16 });
  });
  y += 44;

  ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(HEADING_C)
    .text("Top Assets by Value", MARGIN, y, { width: CONTENT_W });
  y += 12;
  ctx.doc.save().rect(MARGIN, y, CONTENT_W, 17).fill(DARK_MID).restore();
  const C1 = CONTENT_W * 0.44, C2 = CONTENT_W * 0.28, C3 = CONTENT_W * 0.28;
  ctx.doc.font("Helvetica-Bold").fontSize(7).fillColor(WHITE)
    .text("ASSET", MARGIN + 4, y + 5, { width: C1 });
  ctx.doc.text("CATEGORY", MARGIN + C1 + 4, y + 5, { width: C2 });
  ctx.doc.text("VALUE", MARGIN + C1 + C2 + 4, y + 5, { width: C3 });
  y += 17;
  top5.forEach((eq, i) => {
    const bg = i % 2 === 0 ? WHITE : "#F8FAFC";
    ctx.doc.save().rect(MARGIN, y, CONTENT_W, 16).fill(bg).restore();
    ctx.doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
      .text(eq.name.slice(0, 40), MARGIN + 4, y + 4, { width: C1 - 8 });
    ctx.doc.text((eq.category ?? "—").slice(0, 28), MARGIN + C1 + 4, y + 4, { width: C2 - 8 });
    ctx.doc.text(fmtCurrency(parseFloat(eq.currentValue!)), MARGIN + C1 + C2 + 4, y + 4, { width: C3 - 8 });
    y += 16;
  });
  return y + 14;
}

// ── Lease Risk Distribution chart ──────────────────────────────────────────────
function renderLeaseRisk(
  ctx: PdfCtx, leaseChartData: Array<Record<string, unknown>> | null, y: number, isSellerDraft: boolean,
): number {
  if (!leaseChartData?.length) {
    if (!isSellerDraft) return y;
    y = checkY(ctx, y, 28);
    ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
    ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
      .text("Lease risk data not available.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
    return y + 22 + 10;
  }
  const RISK_COLORS: Record<string, string> = { critical: "#EF4444", high: "#F97316", medium: "#F59E0B", low: "#10B981" };
  const total = leaseChartData.reduce((s, r) => s + Number(r.value ?? r.count ?? 0), 0) || 1;

  y = checkY(ctx, y, 70);
  ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(HEADING_C)
    .text("LEASE RISK DISTRIBUTION", MARGIN, y, { width: CONTENT_W });
  y += 14;

  const BAR_H = 18;
  let bx = MARGIN;
  leaseChartData.forEach((r) => {
    const val = Number(r.value ?? r.count ?? 0);
    const w = Math.max(2, Math.floor(CONTENT_W * val / total));
    const key = String(r.name ?? r.risk ?? "").toLowerCase();
    const color = RISK_COLORS[key] ?? BLUE_ACC;
    ctx.doc.save().rect(bx, y, w, BAR_H).fill(color).restore();
    bx += w;
  });
  y += BAR_H + 6;

  let lx = MARGIN;
  leaseChartData.forEach((r) => {
    const val = Number(r.value ?? r.count ?? 0);
    const pct = Math.round(val / total * 100);
    const key = String(r.name ?? r.risk ?? "").toLowerCase();
    const color = RISK_COLORS[key] ?? BLUE_ACC;
    const label = `${String(r.name ?? r.risk ?? "").slice(0, 10)}: ${pct}%`;
    ctx.doc.save().rect(lx, y + 2, 8, 8).fill(color).restore();
    ctx.doc.font("Helvetica").fontSize(7).fillColor(BODY_TEXT)
      .text(label, lx + 12, y + 3, { width: 80 });
    lx += 96;
    if (lx + 90 > MARGIN + CONTENT_W) { lx = MARGIN; y += 14; }
  });
  return y + 18;
}

// ── Business Health Score visual ───────────────────────────────────────────────
function renderHealthScore(
  ctx: PdfCtx, score: number, y: number,
): number {
  const normalized = score <= 10 ? score * 10 : score;
  const { badge, color } = normalized >= 80 ? { badge: "Strong",     color: "#10B981" }
    : normalized >= 60                       ? { badge: "Good",       color: BLUE_ACC  }
    : normalized >= 40                       ? { badge: "Fair",       color: "#F59E0B" }
    :                                          { badge: "Needs Work", color: "#EF4444" };

  y = checkY(ctx, y, 80);
  ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(HEADING_C)
    .text("BUSINESS HEALTH SCORE", MARGIN, y, { width: CONTENT_W });
  y += 14;

  ctx.doc.save().rect(MARGIN, y, 64, 62).fill(CHAPTER_BG).restore();
  ctx.doc.save().rect(MARGIN, y, 6, 62).fill(color).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(26).fillColor(color)
    .text(String(Math.round(normalized)), MARGIN + 10, y + 8, { width: 54, align: "center" });
  ctx.doc.font("Helvetica").fontSize(7).fillColor(SUBTITLE_C)
    .text("/ 100", MARGIN + 10, y + 44, { width: 54, align: "center" });

  ctx.doc.save().rect(MARGIN + 72, y + 6, 72, 22).fill(color).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(11).fillColor(WHITE)
    .text(badge.toUpperCase(), MARGIN + 72, y + 12, { width: 72, align: "center" });
  ctx.doc.font("Helvetica").fontSize(8).fillColor(SUBTITLE_C)
    .text("Business Health Score", MARGIN + 72, y + 36, { width: 150 });

  return y + 70;
}

// ── Buyer Engagement Funnel ────────────────────────────────────────────────────
function renderBuyerFunnel(
  ctx: PdfCtx, funnel: Array<{ eventType: string; count: number }>, y: number,
): number {
  // Order matches spec: Views → Tour Starts → Unique Buyers → Messages → Calls → Saves
  const EVENT_ORDER = [
    { key: "section_viewed",    label: "Views" },
    { key: "tour_clicked",      label: "Tour Starts" },
    { key: "unique_buyers",     label: "Unique Buyers" },
    { key: "contact_clicked",   label: "Messages" },
    { key: "inspection_booked", label: "Calls / Inspections" },
    { key: "pdf_downloaded",    label: "Saves (PDF)" },
  ];
  const mapped = EVENT_ORDER
    .map(({ key, label }) => ({ label, count: funnel.find((f) => f.eventType === key)?.count ?? 0 }))
    .filter((r) => r.count > 0);
  if (!mapped.length) return y;

  y = checkY(ctx, y, 30 + mapped.length * 18);
  ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(HEADING_C)
    .text("BUYER ENGAGEMENT", MARGIN, y, { width: CONTENT_W });
  y += 14;
  const maxCount = Math.max(...mapped.map((r) => r.count));
  const LABEL_W = CONTENT_W * 0.36;
  const BAR_AREA_W = CONTENT_W * 0.52;
  mapped.forEach(({ label, count }) => {
    const barW = Math.max(4, Math.floor(BAR_AREA_W * count / maxCount));
    ctx.doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
      .text(label, MARGIN, y + 2, { width: LABEL_W });
    ctx.doc.save().rect(MARGIN + LABEL_W, y, BAR_AREA_W, 12).fill(CHAPTER_BG).restore();
    ctx.doc.save().rect(MARGIN + LABEL_W, y, barW, 12).fill(BLUE_ACC).restore();
    ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(HEADING_C)
      .text(String(count), MARGIN + LABEL_W + BAR_AREA_W + 6, y + 2, { width: 36 });
    y += 17;
  });
  return y + 8;
}

// ── Revenue / Valuation by Division horizontal bar chart ──────────────────────
// Excluded divisions (included:false | is_included_in_sale:false) are rendered in
// a muted grey so buyers can distinguish what is and isn't part of the sale.
function renderDivisionChart(
  ctx: PdfCtx,
  chartData: Array<Record<string, unknown>>,
  valueKey: string,
  title: string,
  y: number,
  isSellerDraft: boolean,
): number {
  if (!chartData?.length) {
    if (!isSellerDraft) return y;
    y = checkY(ctx, y, 28);
    ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
    ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
      .text(`${title}: Data not available.`, MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
    return y + 22 + 10;
  }

  // Detect the value key — fall back to any numeric-looking key if specified one is absent
  const rows = chartData.slice(0, 8);
  const actualValueKey = (rows[0] && rows[0][valueKey] !== undefined)
    ? valueKey
    : Object.keys(rows[0]).find((k) =>
        !["name", "division", "included", "is_included_in_sale", "id", "unit_id", "cafeId"].includes(k)
      ) ?? valueKey;

  const maxVal = Math.max(...rows.map((r) => Math.abs(Number(r[actualValueKey] ?? 0)))) || 1;
  const LABEL_W = Math.floor(CONTENT_W * 0.33);
  const BAR_AREA_W = Math.floor(CONTENT_W * 0.50);
  const VAL_W = CONTENT_W - LABEL_W - BAR_AREA_W - 4;
  const ROW_H = 20;

  y = checkY(ctx, y, 30 + rows.length * (ROW_H + 2));
  ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(HEADING_C)
    .text(title.toUpperCase(), MARGIN, y, { width: CONTENT_W });
  y += 14;

  rows.forEach((row) => {
    const nameStr = String(row.name ?? row.division ?? "").slice(0, 30);
    const val     = Number(row[actualValueKey] ?? 0);
    // Excluded = explicitly false in any common field name
    const isExcluded = row.included === false
      || row.is_included_in_sale === false
      || String(row.included ?? "").toLowerCase() === "false"
      || String(row.is_included_in_sale ?? "").toLowerCase() === "false";
    const barColor  = isExcluded ? "#94A3B8" : BLUE_ACC;
    const textColor = isExcluded ? SUBTITLE_C : BODY_TEXT;
    const barW = Math.max(4, Math.floor(BAR_AREA_W * Math.abs(val) / maxVal));

    const label = isExcluded ? `${nameStr} (excl.)` : nameStr;
    ctx.doc.font("Helvetica").fontSize(8).fillColor(textColor)
      .text(label.slice(0, 34), MARGIN, y + 4, { width: LABEL_W });
    ctx.doc.save().rect(MARGIN + LABEL_W, y + 2, BAR_AREA_W, ROW_H - 6).fill("#F1F5F9").restore();
    ctx.doc.save().rect(MARGIN + LABEL_W, y + 2, barW, ROW_H - 6).fill(barColor).restore();
    ctx.doc.font("Helvetica").fontSize(7).fillColor(textColor)
      .text(fmtCurrency(val), MARGIN + LABEL_W + BAR_AREA_W + 4, y + 4, { width: VAL_W });
    y += ROW_H;
  });
  return y + 12;
}

// ── Due Diligence Checklist badge grid ─────────────────────────────────────────
function renderDueDiligenceChecklist(
  ctx: PdfCtx, bulletPoints: string[], y: number,
): number {
  const items = bulletPoints.filter(Boolean).slice(0, 24);
  if (!items.length) return y;

  y = checkY(ctx, y, 40 + Math.ceil(items.length / 3) * 22);
  ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(HEADING_C)
    .text("DOCUMENTS & DILIGENCE CHECKLIST", MARGIN, y, { width: CONTENT_W });
  y += 14;

  const COLS = 3;
  const BADGE_W = Math.floor(CONTENT_W / COLS) - 4;
  const BADGE_H = 18;
  const BADGE_GAP = 4;
  const rowsNeeded = Math.ceil(items.length / COLS);

  for (let row = 0; row < rowsNeeded; row++) {
    y = checkY(ctx, y, BADGE_H + BADGE_GAP);
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      if (idx >= items.length) break;
      const bx = MARGIN + col * (BADGE_W + 4);
      ctx.doc.save().rect(bx, y, BADGE_W, BADGE_H).fill("#DCFCE7").restore();
      ctx.doc.save().rect(bx, y, 4, BADGE_H).fill("#10B981").restore();
      ctx.doc.font("Helvetica").fontSize(7.5).fillColor("#14532D")
        .text(items[idx].trim().slice(0, 40), bx + 8, y + 5, { width: BADGE_W - 12 });
    }
    y += BADGE_H + BADGE_GAP;
  }
  return y + 8;
}

// ── Cover metrics extractor ────────────────────────────────────────────────────
// Uses COVER_METRIC_TARGETS for deterministic extraction of the 6 key cover fields:
// asking price, valuation range, revenue, EBITDA, equipment value, lease term.
function extractCoverMetrics(sections: any[]): { label: string; value: string }[] {
  function parseTable(td: unknown): Record<string, unknown>[] | null {
    if (typeof td === "string") { try { return JSON.parse(td); } catch { return null; } }
    return Array.isArray(td) ? (td as Record<string, unknown>[]) : null;
  }

  const metrics: { label: string; value: string }[] = [];

  for (const target of COVER_METRIC_TARGETS) {
    const sec = sections.find((s) => s.sectionKey === target.sectionKey);
    if (!sec?.tableData) continue;
    const rows = parseTable(sec.tableData);
    if (!rows?.length) continue;
    for (const row of rows) {
      const keys = Object.keys(row);
      if (keys.length < 2) continue;
      const rowLabel = String(row[keys[0]] ?? "").toLowerCase();
      const rowValue = String(row[keys[1]] ?? "").trim();
      if (rowValue && target.search.some((term) => rowLabel.includes(term))) {
        metrics.push({ label: target.label, value: rowValue });
        break;
      }
    }
    // No early exit — iterate all 6 targets to collect all required cover fields
  }

  // Fallback: fill remaining slots from first available tableData section
  if (metrics.length < 2) {
    for (const sec of sections) {
      if (!sec.tableData) continue;
      const rows = parseTable(sec.tableData);
      if (!rows?.length) continue;
      for (const row of rows) {
        const keys = Object.keys(row);
        if (keys.length < 2) continue;
        const l = String(row[keys[0]] ?? "").trim();
        const v = String(row[keys[1]] ?? "").trim();
        if (l && v && !metrics.some((m) => m.label.toLowerCase() === l.toLowerCase())) {
          metrics.push({ label: l, value: v });
        }
        if (metrics.length >= 6) break;
      }
      if (metrics.length >= 6) break;
    }
  }

  // Return up to 6 metrics (all required cover fields: value, range, revenue, EBITDA, equipment, lease)
  return metrics.slice(0, 6);
}

// ── Cover page (dark navy) ─────────────────────────────────────────────────────
function renderCover(
  ctx: PdfCtx,
  meta: {
    listingId: string;
    modeLabel: string;
    styleLabel: string;
    dateStr: string;
    location?: string | null;
    category?: string | null;
  },
  metrics: { label: string; value: string }[],
  heroImageBuffer?: Buffer | null,
): void {
  const { doc, biz } = ctx;
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(DARK);
  doc.save().rect(0, 0, PAGE_W, 7).fill(BLUE_ACC).restore();

  doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE_ACC)
    .text("CONFIDENTIAL", MARGIN, 48, { width: CONTENT_W, align: "center" });
  doc.font("Helvetica-Bold").fontSize(24).fillColor(WHITE)
    .text("Information Memorandum", MARGIN, 68, { width: CONTENT_W, align: "center" });
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#60A5FA")
    .text(biz, MARGIN, 104, { width: CONTENT_W, align: "center" });

  // Location · Category metadata line — emoji stripped to avoid broken PDF encoding
  const locationParts: string[] = [];
  if (meta.location) {
    const loc = sanitizePdfText(meta.location);
    if (loc) locationParts.push(loc);
  }
  if (meta.category) {
    const cat = sanitizePdfText(meta.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    if (cat) locationParts.push(cat);
  }
  const locationLine = locationParts.join("  ·  ") || "Prepared by Exit360 · Verified Business Profile";

  doc.font("Helvetica").fontSize(9).fillColor(SUBTITLE_C)
    .text(locationLine, MARGIN, 130, { width: CONTENT_W, align: "center" });

  // Hero image — rendered as a strip between the title block and metrics.
  // The image is sourced at request time (no DB column needed); falls back to
  // the existing gradient if unavailable or if PDFKit cannot decode the buffer.
  doc.save().moveTo(MARGIN, 154).lineTo(PAGE_W - MARGIN, 154).lineWidth(1).strokeColor("#1E3A5C").stroke().restore();

  const HERO_H = 128;
  let yPos: number;
  if (heroImageBuffer) {
    try {
      doc.image(heroImageBuffer, 0, 158, { width: PAGE_W, height: HERO_H });
      // Dark overlay so white text remains legible
      doc.save().fillOpacity(0.62).rect(0, 158, PAGE_W, HERO_H).fill(DARK).restore();
      yPos = 158 + HERO_H + 10;
    } catch {
      yPos = 166;
    }
  } else {
    yPos = 166;
  }

  if (metrics.length > 0) {
    // Key metrics header
    doc.save().rect(MARGIN, yPos, CONTENT_W, 18).fill("#0A1E3C").restore();
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#60A5FA")
      .text("KEY METRICS", MARGIN + 8, yPos + 5, { width: CONTENT_W });
    yPos += 22;

    // 3-column metric cards for up to 6 required fields
    // (asking price, valuation range, revenue, EBITDA, equipment value, lease term)
    const cols = 3;
    const colW = CONTENT_W / cols;
    metrics.slice(0, 6).forEach(({ label, value }, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = MARGIN + col * colW + 8;
      const cy = yPos + row * 46;
      doc.save().rect(MARGIN + col * colW + 2, cy, colW - 6, 40).fill(DARK_MID).restore();
      doc.font("Helvetica").fontSize(7).fillColor(SUBTITLE_C).text(label.slice(0, 22).toUpperCase(), cx, cy + 6);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(WHITE).text(value.slice(0, 18), cx, cy + 18);
    });
    yPos += Math.ceil(Math.min(metrics.length, 6) / cols) * 46 + 14;

    // Compact meta row
    doc.font("Helvetica").fontSize(8).fillColor("#475569")
      .text(
        `${meta.modeLabel} · Ref: ${meta.listingId.slice(0, 8).toUpperCase()} · ${meta.styleLabel} · ${meta.dateStr}`,
        MARGIN, yPos, { width: CONTENT_W, align: "center" },
      );
    yPos += 22;
  } else {
    // Standard meta cards (no metrics available)
    doc.save().rect(MARGIN, yPos, CONTENT_W, 108).fill(DARK_MID).restore();
    const cards = [
      ["Listing Reference", meta.listingId.slice(0, 8).toUpperCase()],
      ["Report Mode",       meta.modeLabel],
      ["Date Prepared",     meta.dateStr],
      ["Export Style",      meta.styleLabel],
    ];
    cards.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = MARGIN + 16 + col * (CONTENT_W / 2);
      const cy = yPos + 16 + row * 44;
      doc.font("Helvetica").fontSize(7).fillColor(SUBTITLE_C).text(label.toUpperCase(), cx, cy);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(WHITE).text(value, cx, cy + 11);
    });
    yPos += 120;
  }

  doc.font("Helvetica").fontSize(8).fillColor("#475569")
    .text(
      "This document is confidential and intended solely for the named recipient.\nUnauthorised disclosure is strictly prohibited.",
      MARGIN, yPos + 10, { width: CONTENT_W, align: "center", lineGap: 3 },
    );

  doc.font("Helvetica-Bold").fontSize(16).fillColor(BLUE_ACC)
    .text("Exit360", MARGIN, PAGE_H - 116, { width: CONTENT_W, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor(SUBTITLE_C)
    .text("exit360.com.au", MARGIN, PAGE_H - 96, { width: CONTENT_W, align: "center" });
}

// ── Chapter metric card grid ───────────────────────────────────────────────────
// Uses the shared METRIC_CARD_CHAPTER_KEYS set (valuation, assets_equipment,
// lease_premises, virtual_tour) — spec: Valuation, Equipment, Lease, Tour.

function extractSectionMetrics(secs: any[]): { label: string; value: string }[] {
  for (const sec of secs) {
    if (!sec.tableData) continue;
    const td = sec.tableData;
    const parsed = typeof td === "string"
      ? (() => { try { return JSON.parse(td); } catch { return null; } })()
      : td;
    if (!Array.isArray(parsed) || !parsed.length) continue;
    const metrics: { label: string; value: string }[] = [];
    for (const row of parsed) {
      const keys = Object.keys(row);
      if (keys.length < 2) continue;
      const label = String(row[keys[0]] ?? "").trim();
      const value = String(row[keys[1]] ?? "").trim();
      if (label && value) metrics.push({ label, value });
      if (metrics.length >= 4) break;
    }
    if (metrics.length > 0) return metrics;
  }
  return [];
}

function renderChapterMetricCards(ctx: PdfCtx, chapterKey: string, secs: any[], y: number): number {
  if (!METRIC_CARD_CHAPTER_KEYS.has(chapterKey)) return y;
  const metrics = extractSectionMetrics(secs);
  if (!metrics.length) return y;
  y = checkY(ctx, y, 90);
  const colW = CONTENT_W / 2;
  metrics.slice(0, 4).forEach(({ label, value }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = MARGIN + col * colW + 10;
    const cy = y + row * 44;
    ctx.doc.save().rect(MARGIN + col * colW, cy, colW - 6, 38).fill(CHAPTER_BG).restore();
    ctx.doc.save().rect(MARGIN + col * colW, cy, 4, 38).fill(BLUE_ACC).restore();
    ctx.doc.font("Helvetica").fontSize(7).fillColor(BLUE_ACC)
      .text(label.slice(0, 30).toUpperCase(), cx + 4, cy + 6);
    ctx.doc.font("Helvetica-Bold").fontSize(12).fillColor(HEADING_C)
      .text(value.slice(0, 22), cx + 4, cy + 17);
  });
  return y + Math.ceil(Math.min(metrics.length, 4) / 2) * 44 + 16;
}

// ── TOC page-number estimator ──────────────────────────────────────────────────
function estimateChapterStartPages(groups: { secs: any[] }[], style: string): number[] {
  const charsPerPage = style === "detailed" ? 650 : 950;
  let page = 3; // 1=cover, 2=TOC, 3=first chapter
  return groups.map((group) => {
    const start = page;
    page += 1; // chapter header page
    for (const sec of group.secs) {
      const bodyLen = (sec.body ?? "").length;
      const bulletCount = Array.isArray(sec.bulletPoints)
        ? (sec.bulletPoints as string[]).filter(Boolean).length : 0;
      const contentEst = (bodyLen + bulletCount * 50) / charsPerPage;
      const tableEst = sec.tableData ? 0.5 : 0;
      const chartEst = sec.chartData ? 0.4 : 0;
      page += Math.max(0.3, contentEst + tableEst + chartEst);
    }
    page = Math.ceil(page);
    return start;
  });
}

// ── TOC page ──────────────────────────────────────────────────────────────────
function renderTOC(
  ctx: PdfCtx,
  groups: { key: string; title: string; secs: any[] }[],
  pageNums: number[],
): void {
  const y0 = whitePage(ctx);
  const { doc } = ctx;

  doc.font("Helvetica-Bold").fontSize(18).fillColor(HEADING_C)
    .text("Table of Contents", MARGIN, y0 + 4, { width: CONTENT_W });
  doc.save().moveTo(MARGIN, y0 + 30).lineTo(PAGE_W - MARGIN, y0 + 30)
    .lineWidth(1.5).strokeColor(BLUE_ACC).stroke().restore();

  let y = y0 + 44;
  groups.forEach((group, i) => {
    doc.save().rect(MARGIN, y, 20, 20).fill(BLUE_ACC + "22").restore();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE_ACC)
      .text(`${String(i + 1).padStart(2, "0")}`, MARGIN + 4, y + 5, { width: 16 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(HEADING_C)
      .text(group.title, MARGIN + 26, y + 4, { width: CONTENT_W - 40 });
    // Page numbers are omitted — estimated values were inaccurate; actual page
    // counts can only be known after full render. Chapter order is shown instead.
    doc.font("Helvetica").fontSize(8).fillColor(SUBTITLE_C)
      .text(`${group.secs.length} section${group.secs.length !== 1 ? "s" : ""}`, MARGIN + 26, y + 18, { width: 120 });
    y += 36;
    if (i < groups.length - 1) {
      doc.save().moveTo(MARGIN, y - 4).lineTo(PAGE_W - MARGIN, y - 4)
        .lineWidth(0.4).strokeColor(BORDER_C).stroke().restore();
    }
  });
}

// ── Chapter header banner ─────────────────────────────────────────────────────
function renderChapterHeader(
  ctx: PdfCtx,
  group: { key: string; title: string },
  chapterNum: number,
  y: number,
): number {
  const { doc } = ctx;
  doc.save().rect(0, y, PAGE_W, 44).fill(CHAPTER_BG).restore();
  doc.save().rect(0, y, 5, 44).fill(BLUE_ACC).restore();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(BLUE_ACC)
    .text(`Chapter ${chapterNum}`, MARGIN + 6, y + 7, { width: CONTENT_W });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(HEADING_C)
    .text(group.title, MARGIN + 6, y + 20, { width: CONTENT_W });
  return y + 44 + 18;
}

// ── Table renderer ────────────────────────────────────────────────────────────
function renderTable(ctx: PdfCtx, rows: Record<string, unknown>[], y: number): number {
  const { doc } = ctx;
  if (!rows.length) return y;
  const headers = Object.keys(rows[0]);
  const colW = CONTENT_W / headers.length;

  // Header row
  y = checkY(ctx, y, 22);
  doc.save().rect(MARGIN, y, CONTENT_W, 20).fill(DARK_MID).restore();
  headers.forEach((h, i) => {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE)
      .text(h.replace(/_/g, " ").toUpperCase(), MARGIN + i * colW + 4, y + 6, { width: colW - 8 });
  });
  y += 20;

  // Data rows
  for (const row of rows) {
    y = checkY(ctx, y, 18);
    doc.save().rect(MARGIN, y, CONTENT_W, 1).fill(BORDER_C).restore();
    headers.forEach((h, i) => {
      const val = String(row[h] ?? "");
      doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
        .text(val.slice(0, 40), MARGIN + i * colW + 4, y + 4, { width: colW - 8 });
    });
    y += 18;
  }
  return y + 8;
}

// ── Section block renderer ────────────────────────────────────────────────────
function renderSection(ctx: PdfCtx, section: any, y: number, isBuyerMode: boolean): number {
  const { doc } = ctx;

  // In buyer mode, replace placeholder content with a notice
  const isPlaceholder = sectionIsPlaceholder(section);
  if (isBuyerMode && isPlaceholder) {
    y = checkY(ctx, y, 36);
    doc.save().rect(MARGIN, y, CONTENT_W, 28).fill("#FEF3C7").restore();
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#92400E")
      .text(`${section.title}: Information to be confirmed by seller.`, MARGIN + 8, y + 9, { width: CONTENT_W - 16 });
    return y + 28 + 12;
  }

  // Section header needs ~52px; start new page if tight
  y = checkY(ctx, y, 52);

  // Blue left accent bar
  doc.save().rect(MARGIN, y, 3, 36).fill(BLUE_ACC).restore();

  // Title
  doc.font("Helvetica-Bold").fontSize(12).fillColor(HEADING_C)
    .text(section.title, MARGIN + 10, y, { width: CONTENT_W - 10 });
  y = doc.y + 2;

  // Subtitle
  if (section.subtitle) {
    doc.font("Helvetica").fontSize(8).fillColor(SUBTITLE_C)
      .text(section.subtitle, MARGIN + 10, y, { width: CONTENT_W - 10 });
    y = doc.y + 4;
  }

  // Placeholder badge (seller view only)
  if (!isBuyerMode && isPlaceholder) {
    doc.save().rect(MARGIN + 10, y, 90, 14).fill("#FEF3C7").restore();
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#92400E")
      .text("! NEEDS REVIEW", MARGIN + 14, y + 3, { width: 84 });
    y += 18;
  }

  // Separator line
  y += 6;
  doc.save().moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y)
    .lineWidth(0.5).strokeColor(BORDER_C).stroke().restore();
  y += 10;

  // Body paragraphs
  if (section.body && section.body.trim()) {
    const paras = section.body.split(/\n{2,}/).filter(Boolean);
    for (const para of paras) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      let est: number;
      try { est = doc.heightOfString(trimmed, { width: CONTENT_W, lineGap: 2 }); }
      catch { est = 60; }
      y = checkY(ctx, y, est + 10);
      doc.font("Helvetica").fontSize(9.5).fillColor(BODY_TEXT)
        .text(trimmed, MARGIN, y, { width: CONTENT_W, lineGap: 2 });
      y = doc.y + 8;
    }
  }

  // Bullets
  const bullets = Array.isArray(section.bulletPoints) ? (section.bulletPoints as string[]).filter(Boolean) : [];
  if (bullets.length > 0) {
    y = checkY(ctx, y, 18);
    for (const b of bullets) {
      const trimmed = b.trim();
      if (!trimmed) continue;
      let est: number;
      try { est = doc.heightOfString(trimmed, { width: CONTENT_W - 14, lineGap: 1.5 }); }
      catch { est = 20; }
      y = checkY(ctx, y, est + 6);
      doc.save().circle(MARGIN + 4, y + 4.5, 2.5).fill(BLUE_ACC).restore();
      doc.font("Helvetica").fontSize(9.5).fillColor(BODY_TEXT)
        .text(trimmed, MARGIN + 13, y, { width: CONTENT_W - 13, lineGap: 1.5 });
      y = doc.y + 4;
    }
    y += 4;
  }

  // Table data
  const tableRows = (() => {
    const td = section.tableData;
    if (!td) return null;
    const parsed = typeof td === "string" ? (() => { try { return JSON.parse(td); } catch { return null; } })() : td;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed as Record<string, unknown>[] : null;
  })();
  if (tableRows) {
    y = checkY(ctx, y, 50 + Math.min(tableRows.length, 6) * 20);
    y = renderTable(ctx, tableRows.slice(0, 20), y);
  }

  // Chart
  const chartRaw = (() => {
    const cd = section.chartData;
    if (!cd) return null;
    const parsed = typeof cd === "string" ? (() => { try { return JSON.parse(cd); } catch { return null; } })() : cd;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed as Array<Record<string, unknown>> : null;
  })();
  if (chartRaw) {
    const CHART_H = 120;
    y = checkY(ctx, y, CHART_H + 16);
    try {
      const svgStr = generateChartSvg(section.sectionKey as string, chartRaw, CONTENT_W, CHART_H);
      SVGtoPDF(doc, svgStr, MARGIN, y, { width: CONTENT_W, height: CHART_H, preserveAspectRatio: "xMinYMin meet" });
      y += CHART_H + 12;
    } catch { /* non-fatal */ }
  }

  return y + 14; // spacing after section
}

// ── Extra data fed into buildPdf from the DB queries in each handler ───────────
interface PdfExtraData {
  heroImageBuffer: Buffer | null;
  bodyImageBuffers: Map<string, Buffer | null>;   // chapterKey → buffer (null = not found)
  snapshot: {
    adjustedEbitda: string | null;
    valuationMidpoint: string | null;
    totalEquipmentValue: string | null;
    grossRevenue: string | null;
  } | null;
  equipment: Array<{ name: string; category: string | null; currentValue: string | null }>;
  buyerFunnel: Array<{ eventType: string; count: number }>;
  isSellerDraft: boolean;
}

// ── Helper: parse chartData from a section into an array (or null) ─────────────
function parseChartData(section: any): Array<Record<string, unknown>> | null {
  const cd = section?.chartData;
  if (!cd) return null;
  const parsed = typeof cd === "string"
    ? (() => { try { return JSON.parse(cd); } catch { return null; } })()
    : cd;
  return Array.isArray(parsed) && parsed.length > 0 ? parsed as Array<Record<string, unknown>> : null;
}

// ── Helper: extract a numeric score from section tableData / chartData ─────────
function extractScore(section: any): number | null {
  if (section?.tableData) {
    const td = typeof section.tableData === "string"
      ? (() => { try { return JSON.parse(section.tableData); } catch { return null; } })()
      : section.tableData;
    if (Array.isArray(td)) {
      for (const row of td) {
        const keys = Object.keys(row);
        if (keys.length < 2) continue;
        const lbl = String(row[keys[0]] ?? "").toLowerCase();
        const val = String(row[keys[1]] ?? "").replace(/[^0-9.]/g, "");
        if ((lbl.includes("score") || lbl.includes("health")) && val) {
          const n = parseFloat(val);
          if (!isNaN(n)) return n;
        }
      }
    }
  }
  const cd = parseChartData(section);
  if (cd?.length) {
    const first = cd[0];
    const scoreKey = Object.keys(first).find((k) => /score|value|total/i.test(k));
    if (scoreKey) {
      const n = parseFloat(String(first[scoreKey] ?? ""));
      if (!isNaN(n)) return Math.min(100, Math.max(0, n));
    }
  }
  return null;
}

// ── Main PDF body builder ──────────────────────────────────────────────────────
async function buildPdf(
  ctx: PdfCtx,
  sections: any[],
  style: PdfStyle,
  mode: string,
  meta: {
    listingId: string;
    modeLabel: string;
    styleLabel: string;
    dateStr: string;
    location?: string | null;
    category?: string | null;
  },
  extra: PdfExtraData,
): Promise<void> {
  // Buyer mode applies when mode=buyer OR buyer_summary style is selected
  const isBuyerMode = mode === "buyer" || style === "buyer_summary";

  // ── 1. Cover page ──────────────────────────────────────────────────────────
  const coverMetrics = extractCoverMetrics(sections);
  renderCover(ctx, meta, coverMetrics, extra.heroImageBuffer);

  // ── 2. Group sections ──────────────────────────────────────────────────────
  let renderGroups: { key: string; title: string; secs: any[] }[];

  if (style === "data_room") {
    renderGroups = DATA_ROOM_SECTION_KEYS.map((k) => {
      const sec = sections.find((s) => s.sectionKey === k);
      return sec && sectionHasContent(sec) ? { key: k, title: sec.title, secs: [sec] } : null;
    }).filter(Boolean) as any[];
  } else {
    renderGroups = REPORT_GROUPS.map((g) => ({
      key:   g.key,
      title: g.title,
      secs:  g.sectionKeys
        .map((k) => sections.find((s) => s.sectionKey === k))
        .filter(Boolean)
        .filter((s) => sectionHasContent(s))
        .filter((s) => !isBuyerMode || s.visibility !== "seller_only"),
    })).filter((g) => g.secs.length > 0);
  }

  // ── 3. TOC page (compact / detailed / buyer_summary) ──────────────────────
  if (style !== "data_room") {
    const pageNums = estimateChapterStartPages(renderGroups, style);
    renderTOC(ctx, renderGroups, pageNums);
  }

  // ── 4. Content pages ───────────────────────────────────────────────────────
  for (let gi = 0; gi < renderGroups.length; gi++) {
    const group = renderGroups[gi];

    let y = whitePage(ctx);

    if (style !== "data_room") {
      y = renderChapterHeader(ctx, group, gi + 1, y);
      y = renderChapterMetricCards(ctx, group.key, group.secs, y);
    }

    // ── Chapter-level visuals injected before section content ────────────────
    if (style !== "data_room") {
      switch (group.key) {
        case "business_overview":
          y = renderBodyImage(
            ctx, extra.bodyImageBuffers.get("business_overview") ?? null,
            "Business Location", y, extra.isSellerDraft,
          );
          break;

        case "financial_performance": {
          // Revenue by Division — horizontal bars, excluded divisions greyed
          const revDivSec = group.secs.find((s) => s.sectionKey === "division_breakdown")
            ?? sections.find((s: any) => s.sectionKey === "division_breakdown");
          const revDivData = parseChartData(revDivSec);
          y = renderDivisionChart(ctx, revDivData ?? [], "revenue", "Revenue by Division", y, extra.isSellerDraft);
          break;
        }

        case "valuation": {
          // Valuation Bridge from snapshot data
          y = renderValuationBridge(ctx, extra.snapshot, y, extra.isSellerDraft);
          // Valuation by Division — same division_breakdown source, valuation key
          const valDivSec = sections.find((s: any) => s.sectionKey === "division_breakdown");
          const valDivData = parseChartData(valDivSec);
          y = renderDivisionChart(ctx, valDivData ?? [], "valuation", "Valuation by Division", y, extra.isSellerDraft);
          // Business Health Score from section data — with seller fallback when absent
          const healthSec = group.secs.find((s) => s.sectionKey === "business_health_score");
          if (healthSec) {
            const score = extractScore(healthSec);
            if (score !== null) {
              y = renderHealthScore(ctx, score, y);
            } else if (extra.isSellerDraft) {
              y = checkY(ctx, y, 28);
              ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
              ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
                .text("Business health score: Data not available.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
              y += 22 + 10;
            }
          } else if (extra.isSellerDraft) {
            y = checkY(ctx, y, 28);
            ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
            ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
              .text("Business health score: Data not available.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
            y += 22 + 10;
          }
          break;
        }

        case "assets_equipment":
          y = renderEquipmentSummary(ctx, extra.equipment, y, extra.isSellerDraft);
          y = renderBodyImage(
            ctx, extra.bodyImageBuffers.get("assets_equipment") ?? null,
            "Plant & Equipment", y, extra.isSellerDraft,
          );
          break;

        case "lease_premises": {
          const leaseRiskSec = group.secs.find((s) => s.sectionKey === "lease_risk_valuation_impact");
          y = renderLeaseRisk(ctx, parseChartData(leaseRiskSec), y, extra.isSellerDraft);
          y = renderBodyImage(
            ctx, extra.bodyImageBuffers.get("lease_premises") ?? null,
            "Business Location & Premises", y, extra.isSellerDraft,
          );
          break;
        }

        case "virtual_tour":
          y = renderBodyImage(
            ctx, extra.bodyImageBuffers.get("virtual_tour") ?? null,
            "360 Business Walkthrough", y, extra.isSellerDraft,
          );
          break;

        case "due_diligence": {
          const ddSec = group.secs.find((s) => s.sectionKey === "due_diligence_documents_available");
          const ddBullets = Array.isArray(ddSec?.bulletPoints) ? (ddSec.bulletPoints as string[]) : [];
          if (ddBullets.length > 0) {
            y = renderDueDiligenceChecklist(ctx, ddBullets, y);
          } else if (extra.isSellerDraft) {
            y = checkY(ctx, y, 28);
            ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
            ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
              .text("Due diligence checklist: Data not available.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
            y += 22 + 10;
          }
          break;
        }

        case "executive_summary":
          // Buyer engagement funnel — seller draft only
          if (extra.isSellerDraft) {
            if (extra.buyerFunnel.length > 0) {
              y = renderBuyerFunnel(ctx, extra.buyerFunnel, y);
            } else {
              y = checkY(ctx, y, 28);
              ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
              ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
                .text("Buyer engagement: No activity recorded yet.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
              y += 22 + 10;
            }
          }
          break;
      }
    }

    for (const sec of group.secs) {
      if (style === "detailed") {
        y = checkY(ctx, y, 80);
        if (y > CONTENT_TOP + 10) {
          ctx.doc.save().moveTo(MARGIN, y - 6).lineTo(PAGE_W - MARGIN, y - 6)
            .lineWidth(0.8).strokeColor(BORDER_C).stroke().restore();
        }
      }
      y = renderSection(ctx, sec, y, isBuyerMode);
    }
  }
}

// ── Section filter for seller (authenticated) endpoint ────────────────────────
function filterSections(allSections: any[], mode: string, style: PdfStyle): any[] {
  return allSections.filter((s: any) => {
    if (!s.includeInPdf) return false;
    if (s.visibility === "hidden") return false;
    if (mode === "buyer" && s.visibility === "seller_only") return false;
    if (style === "buyer_summary" && s.visibility === "seller_only") return false;
    return true;
  });
}

// ── Authenticated PDF handler (GET + POST) ────────────────────────────────────
async function handlePdf(req: any, res: any): Promise<void> {
  const userId    = req.user!.id as string;
  const listingId = req.params.listingId as string;
  const mode      = (req.query.mode as string | undefined) ?? "seller";
  const versionId = req.query.versionId as string | undefined;
  const style     = ((req.query.style as string | undefined) ?? "compact") as PdfStyle;

  try {
    const [cafe] = await db
      .select({
        id: cafesTable.id,
        name: cafesTable.name,
        businessName: cafesTable.businessName,
        title: cafesTable.title,
        tradingName: cafesTable.tradingName,
        city: cafesTable.city,
        businessType: cafesTable.businessType,
      })
      .from(cafesTable)
      .where(and(eq(cafesTable.listingId, listingId), eq(cafesTable.ownerId, userId)))
      .limit(1);

    if (!cafe) {
      res.status(403).json({ error: "Not authorised to export this listing" });
      return;
    }
    // Load sections first so extractBusinessNameFromSections can be used as a fallback
    let allSections: any[];
    if (versionId) {
      const [version] = await db
        .select()
        .from(reportVersionsTable)
        .where(and(eq(reportVersionsTable.id, versionId), eq(reportVersionsTable.ownerId, userId)))
        .limit(1);
      if (!version) { res.status(404).json({ error: "Version not found or access denied" }); return; }
      allSections = ((version.snapshotJson ?? []) as any[]).sort(
        (a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
    } else {
      allSections = await db
        .select()
        .from(reportSectionsTable)
        .where(eq(reportSectionsTable.listingId, listingId))
        .orderBy(asc(reportSectionsTable.sortOrder));
    }

    // Business-name — uses the shared resolver (business_name → name → trading_name
    // → section tableData → "My Business"); emoji stripped before PDF embedding.
    const biz = resolveBusinessName(cafe, allSections);

    const sections     = filterSections(allSections, mode, style);
    const isSellerDraft = mode === "seller";
    const modeLabel    = isSellerDraft ? "Seller Copy" : "Buyer Copy";
    const dateStr      = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const filename     = `im-report-${listingId.slice(0, 8)}-${mode}-${style}.pdf`;
    const styleLabel   = { compact: "Compact Broker IM", detailed: "Detailed Full Report", buyer_summary: "Buyer Summary", data_room: "Data Room Appendix" }[style] ?? "Compact Broker IM";

    // ── Parallel data fetch: snapshot, equipment, buyer funnel, images ─────────
    const [snapshotRows, equipmentRows, funnelLogs] = await Promise.all([
      db.select({
        adjustedEbitda: valuationSnapshotsTable.adjustedEbitda,
        valuationMidpoint: valuationSnapshotsTable.valuationMidpoint,
        totalEquipmentValue: valuationSnapshotsTable.totalEquipmentValue,
        grossRevenue: valuationSnapshotsTable.grossRevenue,
      }).from(valuationSnapshotsTable)
        .where(eq(valuationSnapshotsTable.cafeId, cafe.id))
        .orderBy(desc(valuationSnapshotsTable.createdAt))
        .limit(1),
      db.select({
        name: cafeEquipmentTable.name,
        category: cafeEquipmentTable.category,
        currentValue: cafeEquipmentTable.currentValue,
      }).from(cafeEquipmentTable)
        .where(and(
          eq(cafeEquipmentTable.cafeId, cafe.id),
          eq(cafeEquipmentTable.suspended, false),
        )),
      db.select({
        eventType: reportAccessLogsTable.eventType,
        buyerId:   reportAccessLogsTable.buyerId,
      }).from(reportAccessLogsTable)
        .where(eq(reportAccessLogsTable.listingId, listingId)),
    ]);

    const snapshot = snapshotRows[0] ?? null;
    const equipment = equipmentRows;
    const funnelMap = new Map<string, number>();
    const uniqueBuyerIds = new Set<string>();
    for (const { eventType, buyerId } of funnelLogs) {
      funnelMap.set(eventType, (funnelMap.get(eventType) ?? 0) + 1);
      if (buyerId) uniqueBuyerIds.add(buyerId);
    }
    const buyerFunnel: Array<{ eventType: string; count: number }> = [
      ...Array.from(funnelMap.entries()).map(([eventType, count]) => ({ eventType, count })),
      ...(uniqueBuyerIds.size > 0 ? [{ eventType: "unique_buyers", count: uniqueBuyerIds.size }] : []),
    ];

    // Resolve image URLs from section data (no DB column needed)
    const heroUrl = resolveImageUrl(allSections,
      "360_business_walkthrough", "business_overview", "business_location_market_context");
    const bodyUrls: Array<[string, string | null]> = [
      ["business_overview",  resolveImageUrl(allSections, "business_overview")],
      ["assets_equipment",   resolveImageUrl(allSections, "plant_equipment_summary")],
      ["lease_premises",     resolveImageUrl(allSections, "business_location_market_context", "lease_premises_summary")],
      ["virtual_tour",       resolveImageUrl(allSections, "360_business_walkthrough")],
    ];
    const [heroImageBuffer, ...bodyBuffers] = await Promise.all([
      heroUrl ? fetchImageBuffer(heroUrl) : Promise.resolve(null),
      ...bodyUrls.map(([, url]) => url ? fetchImageBuffer(url) : Promise.resolve(null)),
    ]);
    const bodyImageBuffers = new Map<string, Buffer | null>(
      bodyUrls.map(([key], i) => [key, bodyBuffers[i]]),
    );

    const extra: PdfExtraData = {
      heroImageBuffer, bodyImageBuffers, snapshot, equipment, buyerFunnel, isSellerDraft,
    };

    const doc = new PDFDocument({ size: "A4", margin: 0, info: {
      Title: `Information Memorandum — ${biz}`,
      Author: "Exit360",
      Subject: "Confidential Business Information Memorandum",
      Keywords: "information memorandum, business for sale, exit360",
    }});

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    doc.pipe(res);

    const ctx: PdfCtx = { doc, biz, pg: 1 };
    await buildPdf(ctx, sections, style, mode, {
      listingId, modeLabel, styleLabel, dateStr,
      location: cafe.city ?? null,
      category: cafe.businessType ?? null,
    }, extra);

    db.insert(reportExportsTable).values({
      listingId,
      ownerId:    userId,
      exportType: mode === "seller" ? "pdf_seller" : "pdf_buyer",
    }).catch((e) => logger.warn({ err: e }, "PDF export audit log failed"));

    doc.end();
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    logger.error({ err: e }, "PDF export failed");
    if (!res.headersSent) res.status(e.status ?? 500).json({ error: e.message ?? "Failed to generate PDF" });
  }
}

router.get("/report-exports/pdf/:listingId",  requireAuth, handlePdf);
router.post("/report-exports/pdf/:listingId", requireAuth, handlePdf);

// ── Public buyer PDF ──────────────────────────────────────────────────────────
router.get("/report-exports/pdf-public/:listingId", async (req: any, res: any): Promise<void> => {
  const listingId     = req.params.listingId as string;
  const rawToken      = req.query.accessToken as string | undefined;
  const style         = ((req.query.style as string | undefined) ?? "compact") as PdfStyle;
  let   buyerUnlocked = false;

  if (rawToken) {
    try {
      const { jwtVerify } = await import("jose");
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const { payload } = await jwtVerify(rawToken, new TextEncoder().encode(secret));
        if (payload.type === "buyer-report-access" && payload.listingId === listingId) {
          buyerUnlocked = true;
        }
      }
    } catch { /* invalid token */ }
  }

  try {
    const allSections = await db
      .select()
      .from(reportSectionsTable)
      .where(eq(reportSectionsTable.listingId, listingId))
      .orderBy(asc(reportSectionsTable.sortOrder));

    const sections = allSections.filter((s) => {
      if (!s.includeInPdf) return false;
      if (s.visibility === "public") return true;
      if (s.visibility === "approved_buyers" && buyerUnlocked) return true;
      return false;
    });

    // Look up business name, location, and category (no owner check — public endpoint)
    const [cafeMeta] = await db
      .select({
        id: cafesTable.id,
        name: cafesTable.name,
        businessName: cafesTable.businessName,
        title: cafesTable.title,
        tradingName: cafesTable.tradingName,
        city: cafesTable.city,
        businessType: cafesTable.businessType,
      })
      .from(cafesTable)
      .where(eq(cafesTable.listingId, listingId))
      .limit(1);
    // Shared resolver: business_name → name → trading_name → section data → "My Business"
    const biz = resolveBusinessName(cafeMeta, allSections);

    const dateStr  = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const filename = `im-report-${listingId.slice(0, 8)}-buyer-${style}.pdf`;
    const VALID_STYLES: PdfStyle[] = ["compact", "detailed", "buyer_summary", "data_room"];
    const effectiveStyle: PdfStyle = VALID_STYLES.includes(style as PdfStyle) ? (style as PdfStyle) : "compact";
    const styleLabel = { compact: "Compact Broker IM", detailed: "Detailed Full Report", buyer_summary: "Buyer Summary", data_room: "Data Room Appendix" }[effectiveStyle] ?? "Compact Broker IM";

    // ── Parallel data fetch: snapshot, equipment, images (public — no funnel) ──
    const pubExtra: PdfExtraData = {
      heroImageBuffer: null,
      bodyImageBuffers: new Map(),
      snapshot: null,
      equipment: [],
      buyerFunnel: [],
      isSellerDraft: false,
    };

    if (cafeMeta?.id) {
      const [pubSnapshotRows, pubEquipRows] = await Promise.all([
        db.select({
          adjustedEbitda: valuationSnapshotsTable.adjustedEbitda,
          valuationMidpoint: valuationSnapshotsTable.valuationMidpoint,
          totalEquipmentValue: valuationSnapshotsTable.totalEquipmentValue,
          grossRevenue: valuationSnapshotsTable.grossRevenue,
        }).from(valuationSnapshotsTable)
          .where(and(
            eq(valuationSnapshotsTable.cafeId, cafeMeta.id),
            eq(valuationSnapshotsTable.isPublished, true),
          ))
          .orderBy(desc(valuationSnapshotsTable.createdAt))
          .limit(1),
        db.select({
          name: cafeEquipmentTable.name,
          category: cafeEquipmentTable.category,
          currentValue: cafeEquipmentTable.currentValue,
        }).from(cafeEquipmentTable)
          .where(and(
            eq(cafeEquipmentTable.cafeId, cafeMeta.id),
            eq(cafeEquipmentTable.suspended, false),
          )),
      ]);
      pubExtra.snapshot = pubSnapshotRows[0] ?? null;
      pubExtra.equipment = pubEquipRows;
    }

    // Image resolution — same priority order as authenticated handler
    const pubHeroUrl = resolveImageUrl(allSections,
      "360_business_walkthrough", "business_overview", "business_location_market_context");
    const pubBodyUrls: Array<[string, string | null]> = [
      ["business_overview", resolveImageUrl(allSections, "business_overview")],
      ["assets_equipment",  resolveImageUrl(allSections, "plant_equipment_summary")],
      ["lease_premises",    resolveImageUrl(allSections, "business_location_market_context", "lease_premises_summary")],
      ["virtual_tour",      resolveImageUrl(allSections, "360_business_walkthrough")],
    ];
    const [pubHeroBuf, ...pubBodyBufs] = await Promise.all([
      pubHeroUrl ? fetchImageBuffer(pubHeroUrl) : Promise.resolve(null),
      ...pubBodyUrls.map(([, url]) => url ? fetchImageBuffer(url) : Promise.resolve(null)),
    ]);
    pubExtra.heroImageBuffer = pubHeroBuf;
    pubExtra.bodyImageBuffers = new Map<string, Buffer | null>(
      pubBodyUrls.map(([key], i) => [key, pubBodyBufs[i]]),
    );

    const doc = new PDFDocument({ size: "A4", margin: 0, info: {
      Title: `Information Memorandum — ${biz}`,
      Author: "Exit360",
      Subject: `${biz} Information Memorandum`,
    }});

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    doc.pipe(res);

    const ctx: PdfCtx = { doc, biz, pg: 1 };
    await buildPdf(ctx, sections, effectiveStyle, "buyer", {
      listingId,
      modeLabel:  "Buyer Copy",
      styleLabel,
      dateStr,
      location: cafeMeta?.city ?? null,
      category: cafeMeta?.businessType ?? null,
    }, pubExtra);

    db.insert(reportExportsTable).values({
      listingId, ownerId: "public", exportType: "pdf_buyer_public",
    }).catch(() => {});

    doc.end();
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    logger.error({ err: e }, "Public PDF export failed");
    if (!res.headersSent) res.status(e.status ?? 500).json({ error: e.message ?? "Failed to generate PDF" });
  }
});

export default router;
