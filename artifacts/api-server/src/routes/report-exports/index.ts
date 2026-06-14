import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { v2 as cloudinary } from "cloudinary";
import {
  db, reportSectionsTable, reportExportsTable, cafesTable, reportVersionsTable,
  cafeEquipmentTable, valuationSnapshotsTable, reportAccessLogsTable, reportImagesTable,
  reportVisualsTable, businessUnitsTable,
} from "@workspace/db";
import { eq, asc, and, desc, isNull, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { generateChartSvg } from "../../lib/chart-svg";
import {
  REPORT_GROUPS, DATA_ROOM_SECTION_KEYS, METRIC_CARD_CHAPTER_KEYS,
  BUYER_SUMMARY_PRIORITY_SECTION_KEYS,
  COVER_METRIC_TARGETS, sectionHasContent, sectionIsPlaceholder,
  type PdfStyle,
} from "../../lib/report-groups";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

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
const HDR_H      = 26;   // was 36 — tighter header frees vertical space
const FTR_H      = 22;   // was 30 — tighter footer
const CONTENT_TOP    = HDR_H + 12;  // 38 — was 52
const CONTENT_BOTTOM = PAGE_H - FTR_H - 10;  // ~809 — was ~797

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
  ctx.doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED_HDR)
    .text(ctx.biz.slice(0, 50), MARGIN, 9, { width: CONTENT_W / 2 });
  ctx.doc.font("Helvetica").fontSize(6.5).fillColor(MUTED_HDR)
    .text("Information Memorandum", MARGIN + CONTENT_W / 2, 9, { width: CONTENT_W / 2, align: "right" });
  ctx.doc.save().rect(0, PAGE_H - FTR_H, PAGE_W, FTR_H).fill(NAVY).restore();
  ctx.doc.font("Helvetica").fontSize(6.5).fillColor(SUBTITLE_C)
    .text("Confidential · Exit360", MARGIN, PAGE_H - 14, { width: CONTENT_W / 2 });
  ctx.doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED_HDR)
    .text(`${ctx.pg}`, MARGIN, PAGE_H - 14, { width: CONTENT_W, align: "right" });
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

async function fetchImageBuffer(url: string, timeoutMs = 12000): Promise<Buffer | null> {
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

/**
 * Resolves the cover hero image URL using a formal priority chain.
 * Only visibility-filtered sections are passed in — safe for all export modes.
 *
 * Priority chain:
 *   1. reportImageUrl  — curated cover from report_images (isPrimary → listing_hero →
 *                        cover_secondary → exterior role order, non-panoramic, PDF-visible).
 *   2. listingHeroUrl  — listing-level hero image derived from the business_overview or
 *                        business_location_market_context section chartData; present when the
 *                        seller uploaded a cover photo before the report_images system.
 *                        Wire in cafe.heroImageUrl here once it becomes a DB column.
 *   3. First non-panoramic image URL from any remaining section chartData.
 *   4. null → caller renders branded gradient fallback.
 *
 * Note: 360_business_walkthrough is intentionally excluded — equirectangular panoramas
 * look severely distorted on a PDF cover page.
 */
function resolveHeroImageUrl(
  filteredSections: any[],
  reportImageUrl?: string | null,
  listingHeroUrl?: string | null,
): string | null {
  // Step 1 — curated report_images cover (absolute priority).
  if (reportImageUrl?.startsWith("https://")) return reportImageUrl;
  // Step 2 — listing-level hero: section-embedded image from the primary business sections.
  if (listingHeroUrl?.startsWith("https://")) return listingHeroUrl;
  // Step 3 — broad non-panoramic section fallback (skips 360_business_walkthrough).
  return resolveImageUrl(
    filteredSections.filter((s: any) => s.sectionKey !== "360_business_walkthrough"),
    "plant_equipment_summary",
    "lease_premises_summary",
  );
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
      .text(`${caption}: Image missing — add one in Report Images.`, MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
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
// Compact inline strip (28px) — renders inline above first section, no full page.
function renderChapterHeader(
  ctx: PdfCtx,
  group: { key: string; title: string },
  chapterNum: number,
  y: number,
): number {
  const { doc } = ctx;
  const STRIP_H = 26;
  doc.save().rect(0, y, PAGE_W, STRIP_H).fill(CHAPTER_BG).restore();
  doc.save().rect(0, y, 4, STRIP_H).fill(BLUE_ACC).restore();
  // Chapter number badge
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BLUE_ACC)
    .text(`CH. ${String(chapterNum).padStart(2, "0")}`, MARGIN + 6, y + 7, { width: 36 });
  // Chapter title inline on same strip
  doc.font("Helvetica-Bold").fontSize(11).fillColor(HEADING_C)
    .text(group.title, MARGIN + 48, y + 7, { width: CONTENT_W - 54, lineBreak: false });
  return y + STRIP_H + 8;  // 34px total (was 62px)
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
// colX / colW allow two-column placement (default = full-width at MARGIN).
// compact = true tightens spacing for compact / buyer_summary styles.
function renderSection(
  ctx: PdfCtx,
  section: any,
  y: number,
  isBuyerMode: boolean,
  compact = false,
  colX = MARGIN,
  colW = CONTENT_W,
): number {
  const { doc } = ctx;
  const bodyFontSize  = compact ? 9   : 9.5;
  const titleFontSize = compact ? 10  : 12;
  const afterSection  = compact ? 8   : 14;
  const gapBeforeSep  = compact ? 3   : 6;
  const gapAfterSep   = compact ? 6   : 10;
  const afterPara     = compact ? 5   : 8;
  const afterBullet   = compact ? 3   : 4;

  // In buyer mode, skip placeholder sections entirely — don't show amber "to be confirmed" notices
  const isPlaceholder = sectionIsPlaceholder(section);
  if (isBuyerMode && isPlaceholder) {
    return y;
  }

  // Section heading guard — ensure heading + at least 3 body lines fit before breaking
  const headingGuard = compact ? 80 : 100;
  y = checkY(ctx, y, headingGuard);

  // Blue left accent bar
  doc.save().rect(colX, y, 3, compact ? 26 : 32).fill(BLUE_ACC).restore();

  // Title
  doc.font("Helvetica-Bold").fontSize(titleFontSize).fillColor(HEADING_C)
    .text(section.title, colX + 10, y, { width: colW - 10 });
  y = doc.y + 2;

  // Subtitle
  if (section.subtitle) {
    doc.font("Helvetica").fontSize(7.5).fillColor(SUBTITLE_C)
      .text(section.subtitle, colX + 10, y, { width: colW - 10 });
    y = doc.y + 3;
  }

  // Placeholder badge (seller view only)
  if (!isBuyerMode && isPlaceholder) {
    doc.save().rect(colX + 10, y, 90, 14).fill("#FEF3C7").restore();
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#92400E")
      .text("! NEEDS REVIEW", colX + 14, y + 3, { width: 84 });
    y += 18;
  }

  // Separator line
  y += gapBeforeSep;
  doc.save().moveTo(colX, y).lineTo(colX + colW, y)
    .lineWidth(0.4).strokeColor(BORDER_C).stroke().restore();
  y += gapAfterSep;

  // Body paragraphs
  if (section.body && section.body.trim()) {
    const paras = section.body.split(/\n{2,}/).filter(Boolean);
    for (const para of paras) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      let est: number;
      try { est = doc.heightOfString(trimmed, { width: colW, lineGap: 1.5 }); }
      catch { est = 60; }
      y = checkY(ctx, y, est + afterPara);
      doc.font("Helvetica").fontSize(bodyFontSize).fillColor(BODY_TEXT)
        .text(trimmed, colX, y, { width: colW, lineGap: 1.5 });
      y = doc.y + afterPara;
    }
  }

  // Bullets — atomic group pagination + optional compact-table consolidation
  const bullets = Array.isArray(section.bulletPoints)
    ? (section.bulletPoints as string[]).filter(Boolean) : [];
  if (bullets.length > 0) {
    // Detect "Key: Value" bullet pattern → render as compact two-column table instead
    const kvBullets = bullets.filter((b) => /^[^:]{2,40}:\s*.{1,}/.test(b.trim()));
    const isKvTable = compact && kvBullets.length >= 2 && kvBullets.length >= Math.ceil(bullets.length * 0.6);

    if (isKvTable) {
      // Compact label/value table — merges repeated key:value bullets into a grid
      const LABEL_W = Math.floor(colW * 0.40);
      const VALUE_W = colW - LABEL_W - 8;
      const ROW_H   = 15;
      y = checkY(ctx, y, bullets.length * (ROW_H + 2) + 4);
      for (const b of bullets) {
        y = checkY(ctx, y, ROW_H + 2);
        const m   = b.trim().match(/^([^:]+):\s*(.+)$/);
        const lbl = (m ? m[1] : b).trim().slice(0, 40);
        const val = (m ? m[2] : "").trim().slice(0, 60);
        ctx.doc.save().rect(colX, y, colW, ROW_H).fill("#F8FAFC").restore();
        ctx.doc.save().rect(colX, y, 3, ROW_H).fill(BLUE_ACC + "44").restore();
        ctx.doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BODY_TEXT)
          .text(lbl, colX + 6, y + 4, { width: LABEL_W - 6, lineBreak: false });
        if (val) {
          ctx.doc.font("Helvetica").fontSize(7.5).fillColor(BODY_TEXT)
            .text(val, colX + LABEL_W + 4, y + 4, { width: VALUE_W, lineBreak: false });
        }
        y += ROW_H + 2;
      }
      y += compact ? 2 : 4;
    } else {
      // Standard bullet list — atomic group pagination:
      // Pre-measure the whole group; if it fits within the max-move cap,
      // move the entire group to the next page rather than splitting it.
      const MAX_GROUP_MOVE_H = Math.floor((CONTENT_BOTTOM - CONTENT_TOP) * 0.55);

      const bulletHeights: number[] = bullets.map((b) => {
        const trimmed = b.trim();
        if (!trimmed) return 0;
        let est = 18;
        try { est = doc.heightOfString(trimmed, { width: colW - 14, lineGap: 1.5 }); } catch {}
        return est + afterBullet;
      });
      const totalGroupH = bulletHeights.reduce((s, h) => s + h, 0);

      if (totalGroupH <= MAX_GROUP_MOVE_H) {
        // Small group: move atomically — single checkY for the whole group
        y = checkY(ctx, y, totalGroupH);
        // Render all bullets; no further page-break checks needed inside group
        for (let bi = 0; bi < bullets.length; bi++) {
          const trimmed = bullets[bi].trim();
          if (!trimmed) continue;
          doc.save().circle(colX + 5, y + 4, 2).fill(BLUE_ACC).restore();
          doc.font("Helvetica").fontSize(bodyFontSize).fillColor(BODY_TEXT)
            .text(trimmed, colX + 13, y, { width: colW - 13, lineGap: 1.5 });
          y = doc.y + afterBullet;
        }
      } else {
        // Large group: allow page breaks but require the next bullet to also fit
        y = checkY(ctx, y, Math.min(totalGroupH, 3 * 18));
        for (let bi = 0; bi < bullets.length; bi++) {
          const trimmed = bullets[bi].trim();
          if (!trimmed) continue;
          const thisH = bulletHeights[bi];
          const nextH = bi + 1 < bullets.length ? (bulletHeights[bi + 1] || 0) : 0;
          // Require this bullet + the next one (anti-orphan)
          y = checkY(ctx, y, thisH + (nextH > 0 ? nextH : 0));
          doc.save().circle(colX + 5, y + 4, 2).fill(BLUE_ACC).restore();
          doc.font("Helvetica").fontSize(bodyFontSize).fillColor(BODY_TEXT)
            .text(trimmed, colX + 13, y, { width: colW - 13, lineGap: 1.5 });
          y = doc.y + afterBullet;
        }
      }
      y += compact ? 2 : 4;
    }
  }

  // Table data
  const tableRows = (() => {
    const td = section.tableData;
    if (!td) return null;
    const parsed = typeof td === "string" ? (() => { try { return JSON.parse(td); } catch { return null; } })() : td;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed as Record<string, unknown>[] : null;
  })();
  if (tableRows) {
    y = checkY(ctx, y, 50 + Math.min(tableRows.length, 6) * 18);
    y = renderTable(ctx, tableRows.slice(0, 20), y);
  }

  // Chart — only full-width (skip in narrow column mode to avoid distortion)
  if (colW >= CONTENT_W - 10) {
    const chartRaw = (() => {
      const cd = section.chartData;
      if (!cd) return null;
      const parsed = typeof cd === "string" ? (() => { try { return JSON.parse(cd); } catch { return null; } })() : cd;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed as Array<Record<string, unknown>> : null;
    })();
    if (chartRaw) {
      const CHART_H = 110;
      y = checkY(ctx, y, CHART_H + 16);
      try {
        const svgStr = generateChartSvg(section.sectionKey as string, chartRaw, colW, CHART_H);
        SVGtoPDF(doc, svgStr, colX, y, { width: colW, height: CHART_H, preserveAspectRatio: "xMinYMin meet" });
        y += CHART_H + 10;
      } catch { /* non-fatal */ }
    }
  }

  return y + afterSection;
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
  reportVisuals: Array<{
    id: string;
    sectionKey: string | null;
    title: string;
    subtitle: string | null;
    visualType: string;
    chartData: Record<string, unknown> | null;
    sourceLabel: string | null;
    visualConfig: Record<string, unknown> | null;
  }>;
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

// ── Section height estimator (used by two-column layout planning) ─────────────
// Rough estimate only — avoids a full render pass; used for overflow guard.
function estimateSectionHeight(section: any, colW: number): number {
  let h = 48; // heading block (title + separator)
  if (section.body?.trim()) {
    const charsPerLine = Math.max(1, Math.floor(colW / 5.5));
    const lines = Math.ceil(section.body.length / charsPerLine);
    h += lines * 12 + 8;
  }
  const bulletCount = Array.isArray(section.bulletPoints)
    ? (section.bulletPoints as string[]).filter(Boolean).length : 0;
  h += bulletCount * 15;
  if (section.tableData) h += 55;
  // Cap at just under one full page so we never infinite-loop
  return Math.min(h, CONTENT_BOTTOM - CONTENT_TOP - 30);
}

// ── Two-column section pair renderer (growth_opportunities + risks_mitigations) ─
function renderTwoColumnPair(
  ctx: PdfCtx,
  secA: any,
  secB: any,
  y: number,
  isBuyerMode: boolean,
  compact: boolean,
): number {
  const GAP   = 12;
  const COL_W = Math.floor((CONTENT_W - GAP) / 2);
  const COL_A = MARGIN;
  const COL_B = MARGIN + COL_W + GAP;
  const PAGE_H_USABLE = CONTENT_BOTTOM - CONTENT_TOP;

  const estA   = estimateSectionHeight(secA, COL_W);
  const estB   = estimateSectionHeight(secB, COL_W);
  const estMax = Math.max(estA, estB);

  // Reliability guard: fall back to stacked single-column when either section's
  // estimated height exceeds 55% of a page — prevents column desync from
  // internal checkY page-breaks triggering at different points in each column.
  if (estA > PAGE_H_USABLE * 0.55 || estB > PAGE_H_USABLE * 0.55) {
    y = renderSection(ctx, secA, y, isBuyerMode, compact);
    y = renderSection(ctx, secB, y, isBuyerMode, compact);
    return y;
  }

  // Move to a new page if the pair won't fit on the current page
  if (y + estMax > CONTENT_BOTTOM) {
    y = whitePage(ctx);
  }

  const startY = y;

  // Left column
  const yA = renderSection(ctx, secA, startY, isBuyerMode, compact, COL_A, COL_W);

  // Right column — starts at same startY, uses absolute x positioning
  const yB = renderSection(ctx, secB, startY, isBuyerMode, compact, COL_B, COL_W);

  // Thin vertical divider between the two columns
  const divBottom = Math.max(yA, yB) - 10;
  if (divBottom > startY + 20) {
    ctx.doc.save()
      .moveTo(COL_B - Math.floor(GAP / 2), startY + 4)
      .lineTo(COL_B - Math.floor(GAP / 2), divBottom)
      .lineWidth(0.4).strokeColor(BORDER_C).stroke().restore();
  }

  return Math.max(yA, yB);
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
  // Compact flag: tighter spacing in compact and buyer_summary styles
  const isCompact = style === "compact" || style === "buyer_summary";

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

  } else if (style === "buyer_summary") {
    // Buyer Summary: strictly follow the BUYER_SUMMARY_PRIORITY_SECTION_KEYS order.
    // We build flat section list in priority order, then group CONSECUTIVE sections
    // that share the same chapter — so "division_breakdown" (financial ch.) can appear
    // AFTER "app_valuation_summary" (valuation ch.) as the priority list requires,
    // even though both financial sections share a chapter in REPORT_GROUPS.
    const sectionToChapter = new Map<string, { key: string; title: string }>();
    for (const g of REPORT_GROUPS) {
      for (const k of g.sectionKeys) {
        sectionToChapter.set(k, { key: g.key, title: g.title });
      }
    }

    // Build ordered section list — only those that exist and have content
    const prioritySecs = BUYER_SUMMARY_PRIORITY_SECTION_KEYS
      .map((k) => sections.find((s) => s.sectionKey === k))
      .filter((s): s is any =>
        s != null && sectionHasContent(s) && s.visibility !== "seller_only",
      );

    // Consecutive-chapter grouping: merge adjacent sections from the same chapter,
    // but split into a new group when a different chapter is encountered, preserving
    // the priority order (not the REPORT_GROUPS chapter order).
    const buyerGroups: { key: string; title: string; secs: any[] }[] = [];
    for (const sec of prioritySecs) {
      const chapter = sectionToChapter.get(sec.sectionKey);
      if (!chapter) continue;
      const last = buyerGroups[buyerGroups.length - 1];
      if (last && last.key === chapter.key) {
        last.secs.push(sec);
      } else {
        buyerGroups.push({ key: chapter.key, title: chapter.title, secs: [sec] });
      }
    }
    renderGroups = buyerGroups;

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

  // ── 4. Content pages ────────────────────────────────────────────────────────
  // In compact / buyer_summary: chapters share pages when space allows.
  // In detailed / data_room: every chapter starts a new page (existing behaviour).
  let carryY = CONTENT_TOP; // tracks y across chapters in compact mode

  // Chapter-aware minimum space required before placing a chapter inline.
  // Header strip (34px) + metric cards when applicable (88px) + first-section
  // heading guard (80px) + chart/visual estimate for heavy chapters (compact only).
  // Prevents the chapter header from landing too close to the page bottom, where
  // the very next visual or section checkY would page-break and orphan it.
  const METRIC_CHAPTER_KEYS = new Set([
    "valuation", "assets_equipment", "lease_premises", "virtual_tour",
  ]);
  // Track which chapter keys have already had their visuals rendered; prevents
  // duplicates when buyer_summary consecutive-chapter grouping repeats a key.
  const renderedVisualChapters = new Set<string>();

  function chapterMinSpace(groupKey: string): number {
    let h = 34; // chapter header strip height
    if (
      style !== "buyer_summary" && style !== "data_room" &&
      METRIC_CHAPTER_KEYS.has(groupKey)
    ) h += 88; // metric-card row estimate
    // For compact mode, add estimates for the heaviest chart-level visuals so the
    // chapter (header + chart + first section) fits together on one page.
    if (isCompact && style !== "buyer_summary" && style !== "data_room") {
      if (groupKey === "financial_performance") h += 100; // division chart
      else if (groupKey === "valuation") h += 150; // valuation bridge + div chart
    }
    h += 80; // first section heading guard
    // Cap at 60% of usable page height to avoid over-aggressive new-page placement
    return Math.min(h, Math.floor((CONTENT_BOTTOM - CONTENT_TOP) * 0.60));
  }

  for (let gi = 0; gi < renderGroups.length; gi++) {
    const group = renderGroups[gi];

    let y: number;
    if (!isCompact || gi === 0) {
      // Always start first chapter + detailed/data_room on a fresh page
      y = whitePage(ctx);
    } else if (carryY + chapterMinSpace(group.key) > CONTENT_BOTTOM) {
      // Not enough room for header + content minimum — new page
      y = whitePage(ctx);
    } else {
      // Continue on the current page with a small inter-chapter gap
      y = carryY + 14;
    }

    // Track page number so we can detect if visuals orphan the chapter header
    let pgAtHeader = ctx.pg;

    if (style !== "data_room") {
      y = renderChapterHeader(ctx, group, gi + 1, y);
      pgAtHeader = ctx.pg; // update: header always fits on single page (26px)
      // Skip metric cards in buyer_summary — sections are already tightly curated
      if (style !== "buyer_summary") {
        y = renderChapterMetricCards(ctx, group.key, group.secs, y);
      }
    }

    // ── Chapter-level visuals injected before section content ──────────────
    // buyer_summary: ALL chapter visuals suppressed — keeps the 8–12pp budget and
    // prevents duplicate renders when consecutive-chapter grouping repeats a key.
    // compact: body images suppressed (decorative only); charts/data visuals kept.
    // All styles: gate by renderedVisualChapters so each chapter visual renders once.
    if (
      style !== "data_room" &&
      style !== "buyer_summary" &&
      !renderedVisualChapters.has(group.key)
    ) {
      renderedVisualChapters.add(group.key);
      switch (group.key) {
        case "business_overview":
          if (!isCompact) {
            y = renderBodyImage(
              ctx, extra.bodyImageBuffers.get("business_overview") ?? null,
              "Business Location", y, extra.isSellerDraft,
            );
          }
          break;

        case "financial_performance": {
          // Only group-local division data — no global fallback that would render
          // the chart even when division_breakdown is absent from this group.
          const revDivSec = group.secs.find((s) => s.sectionKey === "division_breakdown");
          const revDivData = parseChartData(revDivSec);
          y = renderDivisionChart(ctx, revDivData ?? [], "revenue", "Revenue by Division", y, extra.isSellerDraft);
          break;
        }

        case "valuation": {
          y = renderValuationBridge(ctx, extra.snapshot, y, extra.isSellerDraft);
          // Group-local division data only
          const valDivSec = group.secs.find((s) => s.sectionKey === "division_breakdown");
          const valDivData = parseChartData(valDivSec);
          y = renderDivisionChart(ctx, valDivData ?? [], "valuation", "Valuation by Division", y, extra.isSellerDraft);
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
              y += 32;
            }
          } else if (extra.isSellerDraft) {
            y = checkY(ctx, y, 28);
            ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
            ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
              .text("Business health score: Data not available.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
            y += 32;
          }
          break;
        }

        case "assets_equipment":
          y = renderEquipmentSummary(ctx, extra.equipment, y, extra.isSellerDraft);
          if (!isCompact) {
            y = renderBodyImage(
              ctx, extra.bodyImageBuffers.get("assets_equipment") ?? null,
              "Plant & Equipment", y, extra.isSellerDraft,
            );
          }
          break;

        case "lease_premises": {
          const leaseRiskSec = group.secs.find((s) => s.sectionKey === "lease_risk_valuation_impact");
          y = renderLeaseRisk(ctx, parseChartData(leaseRiskSec), y, extra.isSellerDraft);
          if (!isCompact) {
            y = renderBodyImage(
              ctx, extra.bodyImageBuffers.get("lease_premises") ?? null,
              "Business Location & Premises", y, extra.isSellerDraft,
            );
          }
          break;
        }

        case "virtual_tour":
          if (!isCompact) {
            y = renderBodyImage(
              ctx, extra.bodyImageBuffers.get("virtual_tour") ?? null,
              "360 Business Walkthrough", y, extra.isSellerDraft,
            );
          }
          break;

        case "staff_operations":
          if (!isCompact) {
            y = renderBodyImage(
              ctx, extra.bodyImageBuffers.get("staff_operations") ?? null,
              "Staff & Operations", y, extra.isSellerDraft,
            );
          }
          break;

        case "brand_customers":
          if (!isCompact) {
            y = renderBodyImage(
              ctx, extra.bodyImageBuffers.get("brand_customers") ?? null,
              "Brand, Customers & Suppliers", y, extra.isSellerDraft,
            );
          }
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
            y += 32;
          }
          break;
        }

        case "executive_summary":
          if (extra.isSellerDraft) {
            if (extra.buyerFunnel.length > 0) {
              y = renderBuyerFunnel(ctx, extra.buyerFunnel, y);
            } else {
              y = checkY(ctx, y, 28);
              ctx.doc.save().rect(MARGIN, y, CONTENT_W, 22).fill(CHAPTER_BG).restore();
              ctx.doc.font("Helvetica-Oblique").fontSize(8).fillColor(SUBTITLE_C)
                .text("Buyer engagement: No activity recorded yet.", MARGIN + 8, y + 7, { width: CONTENT_W - 16 });
              y += 32;
            }
          }
          break;
      }
    }

    // ── Post-visual orphan guard ────────────────────────────────────────────
    // If any visual (metric cards, chart, equipment summary, etc.) triggered a
    // checkY page-break, the chapter header rendered on the previous page is now
    // orphaned — content starts on a different page with no chapter label.
    // Re-render the header at current y (immediately above section content) so
    // every content block begins with its chapter label.
    if (style !== "data_room" && ctx.pg > pgAtHeader) {
      y = renderChapterHeader(ctx, group, gi + 1, y);
    }

    // ── Section content ──────────────────────────────────────────────────────
    // growth_risk chapter: render growth_opportunities + risks_mitigations in two columns.
    if (group.key === "growth_risk" && style !== "data_room") {
      const growthSec  = group.secs.find((s) => s.sectionKey === "growth_opportunities");
      const riskSec    = group.secs.find((s) => s.sectionKey === "risks_mitigations");
      const otherSecs  = group.secs.filter(
        (s) => s.sectionKey !== "growth_opportunities" && s.sectionKey !== "risks_mitigations",
      );

      if (growthSec && riskSec) {
        y = renderTwoColumnPair(ctx, growthSec, riskSec, y, isBuyerMode, isCompact);
      } else {
        if (growthSec) y = renderSection(ctx, growthSec, y, isBuyerMode, isCompact);
        if (riskSec)   y = renderSection(ctx, riskSec,   y, isBuyerMode, isCompact);
      }
      for (const sec of otherSecs) {
        y = renderSection(ctx, sec, y, isBuyerMode, isCompact);
      }

    } else {
      for (const sec of group.secs) {
        if (style === "detailed") {
          y = checkY(ctx, y, 80);
          if (y > CONTENT_TOP + 10) {
            ctx.doc.save().moveTo(MARGIN, y - 6).lineTo(PAGE_W - MARGIN, y - 6)
              .lineWidth(0.8).strokeColor(BORDER_C).stroke().restore();
          }
        }
        y = renderSection(ctx, sec, y, isBuyerMode, isCompact);
      }
    }

    // ── Render seller/buyer-appropriate report_visuals for this chapter ─────
    // buyer_summary + data_room: visuals suppressed (page-budget + duplication).
    // For all other styles: render visuals whose section_key matches any section
    // in this chapter. Global visuals (sectionKey=null) are rendered at the end.
    if (style !== "data_room" && style !== "buyer_summary" && extra.reportVisuals.length > 0) {
      const chapterKeys = new Set(group.secs.map((s: any) => s.sectionKey as string));
      const chapterVisuals = extra.reportVisuals.filter(
        (v) => v.sectionKey && chapterKeys.has(v.sectionKey),
      );
      if (chapterVisuals.length > 0) {
        y = renderReportVisualsBlock(ctx, chapterVisuals, y);
      }
    }

    carryY = y;
  }

  // Render global visuals (sectionKey=null) after all chapters
  // Note: `y` is block-scoped inside the loop above — use carryY for position continuity
  if (style !== "data_room" && style !== "buyer_summary" && extra.reportVisuals.length > 0) {
    const globalVisuals = extra.reportVisuals.filter((v) => !v.sectionKey);
    if (globalVisuals.length > 0) {
      carryY = renderReportVisualsBlock(ctx, globalVisuals, carryY);
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

// ── Report-visual PDF renderers ───────────────────────────────────────────────
// Each function renders one visual_type using PDFKit primitives.
// Returns updated y position. Never renders fake data — callers must gate on
// status==="ready" before calling these.

function renderPdfVisualHeader(ctx: PdfCtx, title: string, subtitle: string | null, sourceLabel: string | null, y: number): number {
  y = checkY(ctx, y, 36);
  ctx.doc.save().moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.5).strokeColor(BORDER_C).stroke().restore();
  y += 6;
  ctx.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(HEADING_C).text(sanitizePdfText(title), MARGIN, y, { width: CONTENT_W - 100 });
  if (sourceLabel) {
    ctx.doc.font("Helvetica-Oblique").fontSize(7).fillColor(SUBTITLE_C)
      .text(sanitizePdfText(sourceLabel), MARGIN, y, { width: CONTENT_W, align: "right" });
  }
  y += 13;
  if (subtitle) {
    y = checkY(ctx, y, 14);
    ctx.doc.font("Helvetica").fontSize(7.5).fillColor(SUBTITLE_C).text(sanitizePdfText(subtitle), MARGIN, y, { width: CONTENT_W });
    y += 11;
  }
  return y;
}

function renderPdfStatCardVisual(ctx: PdfCtx, cd: Record<string, unknown>, accentColor: string, y: number): number {
  const metrics = (cd.metrics as Array<{ label: string; value: unknown }>) ?? [];
  const m = metrics[0];
  if (!m) return y;
  y = checkY(ctx, y, 48);
  ctx.doc.save().rect(MARGIN, y, CONTENT_W, 40).fill(CHAPTER_BG).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(20).fillColor(accentColor)
    .text(sanitizePdfText(String(m.value)), MARGIN + 12, y + 8, { width: CONTENT_W - 24 });
  ctx.doc.font("Helvetica").fontSize(8).fillColor(SUBTITLE_C)
    .text(sanitizePdfText(m.label), MARGIN + 12, y + 28, { width: CONTENT_W - 24 });
  return y + 48;
}

function renderPdfMetricGridVisual(ctx: PdfCtx, cd: Record<string, unknown>, accentColor: string, y: number): number {
  const metrics = (cd.metrics as Array<{ label: string; value: unknown }>) ?? [];
  if (!metrics.length) return y;
  const cols  = Math.min(metrics.length, 4);
  const cellW = (CONTENT_W - (cols - 1) * 6) / cols;
  const cellH = 38;
  y = checkY(ctx, y, cellH + 4);
  for (let i = 0; i < Math.min(metrics.length, 4); i++) {
    const m = metrics[i];
    const x = MARGIN + i * (cellW + 6);
    ctx.doc.save().rect(x, y, cellW, cellH).fill(CHAPTER_BG).restore();
    ctx.doc.font("Helvetica-Bold").fontSize(12).fillColor(accentColor)
      .text(sanitizePdfText(String(m.value)), x + 6, y + 7, { width: cellW - 12, align: "center" });
    ctx.doc.font("Helvetica").fontSize(6.5).fillColor(SUBTITLE_C)
      .text(sanitizePdfText(m.label), x + 4, y + 22, { width: cellW - 8, align: "center" });
  }
  return y + cellH + 8;
}

function renderPdfTableVisual(ctx: PdfCtx, cd: Record<string, unknown>, y: number): number {
  const rows = (cd.rows as Array<{ label: string; value: unknown }>) ?? [];
  if (!rows.length) return y;
  const ROW_H = 14;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    y = checkY(ctx, y, ROW_H);
    if (i % 2 === 0) ctx.doc.save().rect(MARGIN, y, CONTENT_W, ROW_H).fill(CHAPTER_BG).restore();
    ctx.doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
      .text(sanitizePdfText(String(rows[i].label)), MARGIN + 8, y + 3, { width: CONTENT_W * 0.55 });
    ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(HEADING_C)
      .text(sanitizePdfText(String(rows[i].value ?? "—")), MARGIN + CONTENT_W * 0.6, y + 3, { width: CONTENT_W * 0.38, align: "right" });
    y += ROW_H;
  }
  return y + 6;
}

function renderPdfBarsVisual(ctx: PdfCtx, cd: Record<string, unknown>, accentColor: string, y: number): number {
  const bars = (cd.bars as Array<{ label: string; value: unknown; raw?: number }>) ?? [];
  if (!bars.length) return y;
  const maxRaw = Math.max(...bars.map((b) => Number(b.raw ?? 0)), 1);
  const BAR_H = 14;
  const LBL_W = 90;
  const VAL_W = 50;
  const BAR_W = CONTENT_W - LBL_W - VAL_W - 20;
  for (const b of bars.slice(0, 8)) {
    y = checkY(ctx, y, BAR_H + 4);
    const pct = Math.max(Math.round((Number(b.raw ?? 0) / maxRaw) * BAR_W), 2);
    ctx.doc.font("Helvetica").fontSize(7.5).fillColor(BODY_TEXT)
      .text(sanitizePdfText(String(b.label)), MARGIN, y + 3, { width: LBL_W, ellipsis: true });
    const barX = MARGIN + LBL_W + 8;
    ctx.doc.save().rect(barX, y + 4, BAR_W, 7).fill("#E2E8F0").restore();
    ctx.doc.save().rect(barX, y + 4, pct, 7).fill(accentColor).restore();
    ctx.doc.font("Helvetica-Bold").fontSize(7.5).fillColor(HEADING_C)
      .text(sanitizePdfText(String(b.value ?? "")), barX + BAR_W + 6, y + 3, { width: VAL_W });
    y += BAR_H + 3;
  }
  return y + 4;
}

function renderPdfBridgeVisual(ctx: PdfCtx, cd: Record<string, unknown>, y: number): number {
  const rows = [
    { label: "Adjusted EBITDA",   value: String(cd.adjustedEbitda ?? "—"), accent: BLUE_ACC },
    { label: "Equipment Value",   value: String(cd.equipmentValue ?? "—"),  accent: "#10B981" },
  ];
  const ROW_H = 18;
  for (const r of rows) {
    y = checkY(ctx, y, ROW_H);
    ctx.doc.save().rect(MARGIN, y, CONTENT_W, ROW_H - 2).fill(CHAPTER_BG).restore();
    ctx.doc.font("Helvetica").fontSize(8.5).fillColor(BODY_TEXT)
      .text(r.label, MARGIN + 8, y + 4, { width: CONTENT_W * 0.55 });
    ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(r.accent)
      .text(r.value, MARGIN, y + 4, { width: CONTENT_W - 8, align: "right" });
    y += ROW_H;
  }
  // Total row
  y = checkY(ctx, y, 22);
  ctx.doc.save().rect(MARGIN, y, CONTENT_W, 20).fill(DARK_MID).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#93C5FD")
    .text("Estimated Value Range", MARGIN + 8, y + 6, { width: CONTENT_W * 0.5 });
  ctx.doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#BFDBFE")
    .text(`${String(cd.valuationLow ?? "—")} – ${String(cd.valuationHigh ?? "—")}`, MARGIN, y + 5, { width: CONTENT_W - 8, align: "right" });
  return y + 28;
}

function renderPdfChecklistVisual(ctx: PdfCtx, cd: Record<string, unknown>, y: number): number {
  const items = (cd.items as Array<{ label: string; status: string }>) ?? [];
  if (!items.length) return y;
  const ITEM_H = 13;
  const colorOf = (s: string) => s === "available" ? "#16A34A" : s === "pending" ? "#D97706" : "#EF4444";
  const dotOf   = (s: string) => s === "available" ? "●" : s === "pending" ? "◑" : "○";
  for (const item of items.slice(0, 10)) {
    y = checkY(ctx, y, ITEM_H);
    ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(colorOf(item.status)).text(dotOf(item.status), MARGIN, y + 2, { width: 12 });
    ctx.doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
      .text(sanitizePdfText(item.label), MARGIN + 14, y + 2, { width: CONTENT_W - 14 });
    y += ITEM_H;
  }
  return y + 4;
}

function renderPdfFunnelVisual(ctx: PdfCtx, cd: Record<string, unknown>, accentColor: string, y: number): number {
  const funnel = (cd.funnel as Array<{ label: string; value: number; pct: number }>) ?? [];
  if (!funnel.length) return y;
  return renderPdfBarsVisual(ctx, { bars: funnel.filter((f) => f.value > 0).map((f) => ({ label: f.label, value: String(f.value), raw: f.pct })) }, accentColor, y);
}

function renderPdfDonutLegendVisual(ctx: PdfCtx, cd: Record<string, unknown>, y: number): number {
  const slices = (cd.slices as Array<{ label: string; value: unknown }>) ?? [];
  if (!slices.length) return y;
  const COLORS = [BLUE_ACC, "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6B7280"];

  // ── Draw donut chart ─────────────────────────────────────────────────────────
  const OUTER_R = 44;
  const INNER_R = 24;
  const CHART_H = OUTER_R * 2 + 8;
  y = checkY(ctx, y, CHART_H + 6);

  const cx = MARGIN + CONTENT_W / 2;
  const cy = y + OUTER_R + 4;
  const total = slices.reduce((s, sl) => s + Math.max(0, Number(sl.value ?? 0)), 0) || 1;

  let startAngle = -Math.PI / 2; // start at 12 o'clock
  for (let i = 0; i < Math.min(slices.length, 8); i++) {
    const pct = Math.max(0, Number(slices[i].value ?? 0)) / total;
    const sweep = pct * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const large = sweep > Math.PI ? 1 : 0;

    const ox1 = cx + OUTER_R * Math.cos(startAngle);
    const oy1 = cy + OUTER_R * Math.sin(startAngle);
    const ox2 = cx + OUTER_R * Math.cos(endAngle);
    const oy2 = cy + OUTER_R * Math.sin(endAngle);
    const ix1 = cx + INNER_R * Math.cos(startAngle);
    const iy1 = cy + INNER_R * Math.sin(startAngle);
    const ix2 = cx + INNER_R * Math.cos(endAngle);
    const iy2 = cy + INNER_R * Math.sin(endAngle);

    const path = `M ${ox1.toFixed(2)} ${oy1.toFixed(2)} ` +
      `A ${OUTER_R} ${OUTER_R} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} ` +
      `L ${ix2.toFixed(2)} ${iy2.toFixed(2)} ` +
      `A ${INNER_R} ${INNER_R} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;

    ctx.doc.save().path(path).fill(COLORS[i % COLORS.length]).restore();
    startAngle = endAngle;
  }

  y += CHART_H + 10;

  // ── Legend rows with % values ────────────────────────────────────────────────
  const ITEM_H = 13;
  for (let i = 0; i < Math.min(slices.length, 8); i++) {
    y = checkY(ctx, y, ITEM_H);
    const pct = Math.round(Math.max(0, Number(slices[i].value ?? 0)) / total * 100);
    ctx.doc.save().circle(MARGIN + 5, y + 7, 4).fill(COLORS[i % COLORS.length]).restore();
    ctx.doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
      .text(sanitizePdfText(String(slices[i].label)), MARGIN + 14, y + 3, { width: CONTENT_W - 60 });
    ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(HEADING_C)
      .text(`${pct}%`, MARGIN, y + 3, { width: CONTENT_W - 8, align: "right" });
    y += ITEM_H;
  }
  return y + 4;
}

function renderPdfScoreCardVisual(ctx: PdfCtx, cd: Record<string, unknown>, accentColor: string, y: number): number {
  const score = Number(cd.score ?? 0);
  const label = sanitizePdfText(String(cd.label ?? "Score"));
  y = checkY(ctx, y, 48);
  ctx.doc.save().rect(MARGIN, y, CONTENT_W, 40).fill(CHAPTER_BG).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(24).fillColor(accentColor)
    .text(String(score), MARGIN + 12, y + 7, { width: 60 });
  ctx.doc.font("Helvetica").fontSize(8).fillColor(SUBTITLE_C)
    .text(`/ 100 — ${label}`, MARGIN + 72, y + 15, { width: CONTENT_W - 84 });
  return y + 48;
}

function renderOneReportVisual(
  ctx: PdfCtx,
  v: PdfExtraData["reportVisuals"][0],
  y: number,
): number {
  const cd = v.chartData;
  if (!cd) return y;
  const accentColor = (v.visualConfig?.accentColor as string | undefined) ?? BLUE_ACC;
  y = renderPdfVisualHeader(ctx, v.title, v.subtitle, v.sourceLabel, y);
  switch (v.visualType) {
    case "stat_card":           y = renderPdfStatCardVisual(ctx, cd, accentColor, y);  break;
    case "metric_grid":         y = renderPdfMetricGridVisual(ctx, cd, accentColor, y); break;
    case "table":               y = renderPdfTableVisual(ctx, cd, y);                  break;
    case "bar_chart":
    case "horizontal_bar_chart":y = renderPdfBarsVisual(ctx, cd, accentColor, y);     break;
    case "valuation_bridge":    y = renderPdfBridgeVisual(ctx, cd, y);                 break;
    case "checklist":           y = renderPdfChecklistVisual(ctx, cd, y);              break;
    case "funnel":              y = renderPdfFunnelVisual(ctx, cd, accentColor, y);    break;
    case "donut_chart":         y = renderPdfDonutLegendVisual(ctx, cd, y);            break;
    case "score_card":          y = renderPdfScoreCardVisual(ctx, cd, accentColor, y); break;
    default: break;
  }
  return y + 8;
}

function renderReportVisualsBlock(
  ctx: PdfCtx,
  visuals: PdfExtraData["reportVisuals"],
  y: number,
): number {
  for (const v of visuals) {
    y = renderOneReportVisual(ctx, v, y);
  }
  return y;
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

    // ── Dynamically override division_breakdown section with live included-only data ──
    // This prevents excluded units (not part of the sale) from appearing in the PDF,
    // regardless of what stale chartData/tableData is stored in the DB.
    try {
      const includedUnits = await db.select().from(businessUnitsTable).where(
        and(eq(businessUnitsTable.cafeId, cafe.id), eq(businessUnitsTable.isIncludedInSale, true)),
      );
      // Always override (even when includedUnits is empty) so excluded unit names
      // never leak from stale stored chartData/tableData/bulletPoints.
      const fmtDiv = (n: string | null | undefined) =>
        n && Number(n) > 0 ? `$${Number(n).toLocaleString("en-AU", { maximumFractionDigits: 0 })}` : "—";
      const snapByUnit = new Map<string, typeof valuationSnapshotsTable.$inferSelect>();
      await Promise.all(includedUnits.map(async (u) => {
        const [uSnap] = await db.select().from(valuationSnapshotsTable).where(
          and(eq(valuationSnapshotsTable.cafeId, cafe.id), eq(valuationSnapshotsTable.unitId, u.id)),
        ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
        if (uSnap) snapByUnit.set(u.id, uSnap);
      }));
      const totalRevenue = includedUnits.reduce((sum, u) => sum + Number(snapByUnit.get(u.id)?.grossRevenue ?? 0), 0);
      const divChartRows = includedUnits.map((u) => {
        const uSnap = snapByUnit.get(u.id);
        const rawRevenue = Number(uSnap?.grossRevenue ?? 0);
        const revenueSharePct = uSnap != null && totalRevenue > 0
          ? Math.round((rawRevenue / totalRevenue) * 1000) / 10
          : Number(u.revenueSharePct ?? 0);
        return {
          name: u.name,
          included: true,
          revenue: rawRevenue,
          valuation: Number(uSnap?.valuationMidpoint ?? 0),
          revenueSharePct,
        };
      });
      const divTableRows = includedUnits.map((u) => {
        const uSnap = snapByUnit.get(u.id);
        return {
          Division: u.name,
          Revenue: fmtDiv(uSnap?.grossRevenue?.toString()),
          EBITDA: fmtDiv(uSnap?.ebitda?.toString()),
          Value: fmtDiv(uSnap?.valuationMidpoint?.toString()),
        };
      });
      const divBullets = includedUnits.map((u) => {
        const uSnap = snapByUnit.get(u.id);
        const rev = fmtDiv(uSnap?.grossRevenue?.toString());
        return `${u.name}${rev !== "—" ? ` — Revenue: ${rev}` : ""}`;
      });
      allSections = allSections.map((s: any) =>
        s.sectionKey === "division_breakdown"
          ? { ...s, chartData: divChartRows, tableData: divTableRows, bulletPoints: divBullets }
          : s,
      );
    } catch (_err) {
      // Division enrichment failure is non-fatal — continue with stored data
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

    // ── Parallel data fetch: snapshot, equipment, buyer funnel, report images ──
    const [snapshotRows, equipmentRows, funnelLogs, reportImageRows, reportVisualsRows] = await Promise.all([
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
      // Primary cover: role-priority chain — isPrimary first, then listing_hero →
      // cover_secondary → exterior → first non-panoramic.
      db.select({ url: reportImagesTable.cloudinarySecureUrl, publicId: reportImagesTable.cloudinaryPublicId })
        .from(reportImagesTable)
        .where(and(
          eq(reportImagesTable.listingId, listingId),
          eq(reportImagesTable.isPanoramic, false),
          eq(reportImagesTable.includeInPdf, true),
          isNull(reportImagesTable.deletedAt),
          // Seller copy: respect includeInSellerReport; buyer/public: respect includeInBuyerReport
          isSellerDraft
            ? eq(reportImagesTable.includeInSellerReport, true)
            : eq(reportImagesTable.includeInBuyerReport, true),
        ))
        .orderBy(
          desc(reportImagesTable.isPrimary),
          sql`CASE ${reportImagesTable.imageRole}
            WHEN 'listing_hero'    THEN 0
            WHEN 'cover_secondary' THEN 1
            WHEN 'exterior'        THEN 2
            ELSE 3
          END`,
          asc(reportImagesTable.sortOrder),
        )
        .limit(1),
      // Report visuals (status=ready, include_in_pdf=true, appropriate visibility)
      db.select({
        id:          reportVisualsTable.id,
        sectionKey:  reportVisualsTable.sectionKey,
        title:       reportVisualsTable.title,
        subtitle:    reportVisualsTable.subtitle,
        visualType:  reportVisualsTable.visualType,
        chartData:   reportVisualsTable.chartData,
        sourceLabel: reportVisualsTable.sourceLabel,
        visualConfig:reportVisualsTable.visualConfig,
      }).from(reportVisualsTable)
        .where(and(
          eq(reportVisualsTable.listingId, listingId),
          eq(reportVisualsTable.status, "ready"),
          eq(reportVisualsTable.includeInPdf, true),
          isNull(reportVisualsTable.deletedAt),
          isSellerDraft
            ? eq(reportVisualsTable.includeInSellerReport, true)
            : eq(reportVisualsTable.includeInBuyerReport, true),
        ))
        .orderBy(asc(reportVisualsTable.sortOrder), asc(reportVisualsTable.createdAt)),
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

    // report_images cover takes priority over any section-embedded or panoramic image.
    // Use Cloudinary 1600w crop/fill transformation for PDF cover quality.
    const reportImgRaw = reportImageRows[0];
    const reportImgUrl = reportImgRaw
      ? cloudinary.url(reportImgRaw.publicId, { width: 1600, crop: "fill", quality: "auto", fetch_format: "auto", secure: true })
      : null;
    // ── report_images section resolver ────────────────────────────────────────
    // Fetch all non-deleted, PDF-included report_images for the listing so we can
    // resolve per-chapter section images. Panoramic allowed for virtual_tour only.
    // Visibility: seller copy respects includeInSellerReport; buyer/public respects includeInBuyerReport.
    const allReportImages = await db
      .select({
        publicId:   reportImagesTable.cloudinaryPublicId,
        imageRole:  reportImagesTable.imageRole,
        sectionKey: reportImagesTable.sectionKey,
        isPanoramic: reportImagesTable.isPanoramic,
        sortOrder:  reportImagesTable.sortOrder,
        isPrimary:  reportImagesTable.isPrimary,
      })
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.listingId, listingId),
        eq(reportImagesTable.includeInPdf, true),
        isNull(reportImagesTable.deletedAt),
        isSellerDraft
          ? eq(reportImagesTable.includeInSellerReport, true)
          : eq(reportImagesTable.includeInBuyerReport, true),
      ))
      .orderBy(desc(reportImagesTable.isPrimary), asc(reportImagesTable.sortOrder));

    /**
     * Pick the best report_image public_id for a PDF chapter.
     * Priority: matching sectionKey → matching imageRole(s) → null.
     * Falls back to cloudinary 1000w section transform if found.
     */
    function resolveReportSectionImageUrl(
      chapterSectionKeys: string[],
      roles: string[],
      allowPanoramic = false,
    ): string | null {
      const pool = allowPanoramic ? allReportImages : allReportImages.filter((i) => !i.isPanoramic);
      // 1. Exact sectionKey match
      for (const sk of chapterSectionKeys) {
        const match = pool.find((i) => i.sectionKey === sk);
        if (match) {
          return cloudinary.url(match.publicId, {
            width: 1000, quality: "auto", fetch_format: "auto", secure: true,
          });
        }
      }
      // 2. imageRole match
      for (const role of roles) {
        const match = pool.find((i) => i.imageRole === role);
        if (match) {
          return cloudinary.url(match.publicId, {
            width: 1000, quality: "auto", fetch_format: "auto", secure: true,
          });
        }
      }
      return null;
    }

    // Resolve image URLs — use visibility-filtered `sections` only; allSections is NOT
    // used here to prevent seller-only section content leaking into buyer/public exports.
    // listingHeroUrl = step-2 fallback: section-embedded cover from the primary business sections.
    const listingHeroUrl = resolveImageUrl(sections, "business_overview", "business_location_market_context");
    const heroUrl = resolveHeroImageUrl(sections, reportImgUrl, listingHeroUrl);
    const bodyUrls: Array<[string, string | null]> = [
      ["business_overview", resolveReportSectionImageUrl(["business_overview"], ["interior", "exterior"])
        ?? resolveImageUrl(sections, "business_overview")],
      ["assets_equipment",  resolveReportSectionImageUrl(["plant_equipment_summary"], ["equipment"])
        ?? resolveImageUrl(sections, "plant_equipment_summary")],
      ["lease_premises",    resolveReportSectionImageUrl(["business_location_market_context", "lease_premises_summary"], ["exterior"])
        ?? resolveImageUrl(sections, "business_location_market_context", "lease_premises_summary")],
      // virtual_tour: only use an explicitly-confirmed report_image (360_preview role).
      // Never fall back to raw section/tour imagery — raw panoramics look distorted in PDF.
      ["virtual_tour",      resolveReportSectionImageUrl(["360_business_walkthrough"], ["360_preview"], true)],
      ["staff_operations",  resolveReportSectionImageUrl(["staff_owner_involvement"], ["team"])],
      ["brand_customers",   resolveReportSectionImageUrl(["brand_digital_assets"], ["product"])],
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
      reportVisuals: reportVisualsRows as PdfExtraData["reportVisuals"],
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

    let sections = allSections.filter((s) => {
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

    // ── Parallel data fetch: snapshot, equipment, report images (public — no funnel) ──
    const pubExtra: PdfExtraData = {
      heroImageBuffer: null,
      bodyImageBuffers: new Map(),
      snapshot: null,
      equipment: [],
      buyerFunnel: [],
      isSellerDraft: false,
      reportVisuals: [],
    };

    // Fetch report_images cover (non-panoramic) for the public PDF.
    // Role-priority chain: isPrimary → listing_hero → cover_secondary → exterior → others.
    const pubCoverImgRows = await db
      .select({ url: reportImagesTable.cloudinarySecureUrl, publicId: reportImagesTable.cloudinaryPublicId })
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.listingId, listingId),
        eq(reportImagesTable.isPanoramic, false),
        eq(reportImagesTable.includeInPdf, true),
        eq(reportImagesTable.includeInBuyerReport, true),
        isNull(reportImagesTable.deletedAt),
      ))
      .orderBy(
        desc(reportImagesTable.isPrimary),
        sql`CASE ${reportImagesTable.imageRole}
          WHEN 'listing_hero'    THEN 0
          WHEN 'cover_secondary' THEN 1
          WHEN 'exterior'        THEN 2
          ELSE 3
        END`,
        asc(reportImagesTable.sortOrder),
      )
      .limit(1);
    const pubReportImgRaw = pubCoverImgRows[0];
    const pubReportImgUrl = pubReportImgRaw
      ? cloudinary.url(pubReportImgRaw.publicId, { width: 1600, crop: "fill", quality: "auto", fetch_format: "auto", secure: true })
      : null;

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

    // ── Division breakdown enrichment for public PDF ───────────────────────────
    // Override division_breakdown section data with live included-only units,
    // preventing excluded units from appearing in the buyer PDF.
    if (cafeMeta?.id) {
      try {
        const pubIncludedUnits = await db.select().from(businessUnitsTable).where(
          and(eq(businessUnitsTable.cafeId, cafeMeta.id), eq(businessUnitsTable.isIncludedInSale, true)),
        );
        // Always override (even when pubIncludedUnits is empty) — excluded unit
        // names must never leak from stale stored section data in the buyer PDF.
        const fmtDiv = (n: string | null | undefined) =>
          n && Number(n) > 0 ? `$${Number(n).toLocaleString("en-AU", { maximumFractionDigits: 0 })}` : "—";
        const pubSnapByUnit = new Map<string, typeof valuationSnapshotsTable.$inferSelect>();
        await Promise.all(pubIncludedUnits.map(async (u) => {
          const [uSnap] = await db.select().from(valuationSnapshotsTable).where(
            and(eq(valuationSnapshotsTable.cafeId, cafeMeta!.id), eq(valuationSnapshotsTable.unitId, u.id)),
          ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
          if (uSnap) pubSnapByUnit.set(u.id, uSnap);
        }));
        const pubTotalRevenue = pubIncludedUnits.reduce(
          (sum, u) => sum + Number(pubSnapByUnit.get(u.id)?.grossRevenue ?? 0), 0,
        );
        const pubDivChartRows = pubIncludedUnits.map((u) => {
          const uSnap = pubSnapByUnit.get(u.id);
          const rawRevenue = Number(uSnap?.grossRevenue ?? 0);
          const revenueSharePct = uSnap != null && pubTotalRevenue > 0
            ? Math.round((rawRevenue / pubTotalRevenue) * 1000) / 10
            : Number(u.revenueSharePct ?? 0);
          return { name: u.name, included: true, revenue: rawRevenue, valuation: Number(uSnap?.valuationMidpoint ?? 0), revenueSharePct };
        });
        const pubDivTableRows = pubIncludedUnits.map((u) => {
          const uSnap = pubSnapByUnit.get(u.id);
          return {
            Division: u.name,
            Revenue: fmtDiv(uSnap?.grossRevenue?.toString()),
            EBITDA: fmtDiv(uSnap?.ebitda?.toString()),
            Value: fmtDiv(uSnap?.valuationMidpoint?.toString()),
          };
        });
        const pubDivBullets = pubIncludedUnits.map((u) => {
          const uSnap = pubSnapByUnit.get(u.id);
          const rev = fmtDiv(uSnap?.grossRevenue?.toString());
          const val = fmtDiv(uSnap?.valuationMidpoint?.toString());
          return `${u.name}${rev !== "—" ? ` — Revenue: ${rev}` : ""}${val !== "—" ? `, Value: ${val}` : ""}`;
        });
        sections = sections.map((s: any) => {
          if (s.sectionKey === "division_breakdown") {
            return { ...s, chartData: pubDivChartRows, tableData: pubDivTableRows, bulletPoints: pubDivBullets };
          }
          return s;
        });
      } catch (e) {
        logger.warn({ err: e }, "Public PDF: division enrichment failed (non-fatal)");
      }
    }

    // ── report_images section resolver for public PDF ──────────────────────────
    // Fetch all non-deleted, PDF-included report images visible to buyers so we
    // can resolve per-chapter section images using the same priority chain as
    // the seller PDF path (sectionKey match → imageRole match → null).
    const allPubReportImages = await db
      .select({
        publicId:    reportImagesTable.cloudinaryPublicId,
        imageRole:   reportImagesTable.imageRole,
        sectionKey:  reportImagesTable.sectionKey,
        isPanoramic: reportImagesTable.isPanoramic,
        sortOrder:   reportImagesTable.sortOrder,
        isPrimary:   reportImagesTable.isPrimary,
      })
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.listingId, listingId),
        eq(reportImagesTable.includeInPdf, true),
        eq(reportImagesTable.includeInBuyerReport, true),
        isNull(reportImagesTable.deletedAt),
      ))
      .orderBy(desc(reportImagesTable.isPrimary), asc(reportImagesTable.sortOrder));

    function resolvePubSectionImageUrl(
      chapterSectionKeys: string[],
      roles: string[],
      allowPanoramic = false,
    ): string | null {
      const pool = allowPanoramic ? allPubReportImages : allPubReportImages.filter((i) => !i.isPanoramic);
      for (const sk of chapterSectionKeys) {
        const match = pool.find((i) => i.sectionKey === sk);
        if (match) return cloudinary.url(match.publicId, { width: 1000, quality: "auto", fetch_format: "auto", secure: true });
      }
      for (const role of roles) {
        const match = pool.find((i) => i.imageRole === role);
        if (match) return cloudinary.url(match.publicId, { width: 1000, quality: "auto", fetch_format: "auto", secure: true });
      }
      return null;
    }

    // Image resolution — report_images (non-panoramic) takes priority for public PDF.
    // visibility-filtered `sections` only; allSections NOT used to avoid leaking seller content.
    // listingHeroUrl = step-2 fallback: section-embedded cover from the primary business sections.
    const pubListingHeroUrl = resolveImageUrl(sections, "business_overview", "business_location_market_context");
    const pubHeroUrl = resolveHeroImageUrl(sections, pubReportImgUrl, pubListingHeroUrl);
    const pubBodyUrls: Array<[string, string | null]> = [
      ["business_overview", resolvePubSectionImageUrl(["business_overview"], ["interior", "exterior"])
        ?? resolveImageUrl(sections, "business_overview")],
      ["assets_equipment",  resolvePubSectionImageUrl(["plant_equipment_summary"], ["equipment"])
        ?? resolveImageUrl(sections, "plant_equipment_summary")],
      ["lease_premises",    resolvePubSectionImageUrl(["business_location_market_context", "lease_premises_summary"], ["exterior"])
        ?? resolveImageUrl(sections, "business_location_market_context", "lease_premises_summary")],
      // virtual_tour: only explicitly-curated report_images with 360_preview role.
      // Raw section fallback intentionally omitted — panoramics look distorted in PDF.
      ["virtual_tour",      resolvePubSectionImageUrl(["360_business_walkthrough"], ["360_preview"], true)],
      ["staff_operations",  resolvePubSectionImageUrl(["staff_owner_involvement"], ["team"])],
      ["brand_customers",   resolvePubSectionImageUrl(["brand_digital_assets"], ["product"])],
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
