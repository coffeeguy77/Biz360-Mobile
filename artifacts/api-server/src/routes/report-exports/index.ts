import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import {
  db, reportSectionsTable, reportExportsTable, cafesTable, reportVersionsTable,
} from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
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
    if (metrics.length >= 4) break;
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
        if (metrics.length >= 4) break;
      }
      if (metrics.length >= 4) break;
    }
  }

  return metrics.slice(0, 4);
}

// ── Cover page (dark navy) ─────────────────────────────────────────────────────
function renderCover(
  ctx: PdfCtx,
  meta: { listingId: string; modeLabel: string; styleLabel: string; dateStr: string },
  metrics: { label: string; value: string }[],
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
  doc.font("Helvetica").fontSize(9).fillColor(SUBTITLE_C)
    .text("Prepared by Exit360 · Verified Business Profile", MARGIN, 134, { width: CONTENT_W, align: "center" });

  doc.save().moveTo(MARGIN, 160).lineTo(PAGE_W - MARGIN, 160).lineWidth(1).strokeColor("#1E3A5C").stroke().restore();

  let yPos = 172;

  if (metrics.length > 0) {
    // Key metrics header
    doc.save().rect(MARGIN, yPos, CONTENT_W, 18).fill("#0A1E3C").restore();
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#60A5FA")
      .text("KEY METRICS", MARGIN + 8, yPos + 5, { width: CONTENT_W });
    yPos += 22;

    // 2-column metric cards
    const colW = CONTENT_W / 2;
    metrics.slice(0, 4).forEach(({ label, value }, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = MARGIN + col * colW + 10;
      const cy = yPos + row * 46;
      doc.save().rect(MARGIN + col * colW + 2, cy, colW - 6, 40).fill(DARK_MID).restore();
      doc.font("Helvetica").fontSize(7).fillColor(SUBTITLE_C).text(label.slice(0, 28).toUpperCase(), cx, cy + 6);
      doc.font("Helvetica-Bold").fontSize(13).fillColor(WHITE).text(value.slice(0, 22), cx, cy + 18);
    });
    yPos += Math.ceil(Math.min(metrics.length, 4) / 2) * 46 + 14;

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
      .text(group.title, MARGIN + 26, y + 4, { width: CONTENT_W - 120 });
    // Page number — right-aligned
    const pg = pageNums[i];
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BLUE_ACC)
      .text(`~${pg}`, MARGIN, y + 4, { width: CONTENT_W, align: "right" });
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
      .text("⚠ NEEDS REVIEW", MARGIN + 14, y + 3, { width: 84 });
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

// ── Main PDF body builder ──────────────────────────────────────────────────────
async function buildPdf(
  ctx: PdfCtx,
  sections: any[],
  style: PdfStyle,
  mode: string,
  meta: { listingId: string; modeLabel: string; styleLabel: string; dateStr: string },
): Promise<void> {
  // Buyer mode applies when mode=buyer OR buyer_summary style is selected
  const isBuyerMode = mode === "buyer" || style === "buyer_summary";

  // ── 1. Cover page ──────────────────────────────────────────────────────────
  const coverMetrics = extractCoverMetrics(sections);
  renderCover(ctx, meta, coverMetrics);

  // ── 2. Group sections ──────────────────────────────────────────────────────
  let renderGroups: { key: string; title: string; secs: any[] }[];

  if (style === "data_room") {
    // Data-room: each section on its own page
    renderGroups = DATA_ROOM_SECTION_KEYS.map((k) => {
      const sec = sections.find((s) => s.sectionKey === k);
      return sec && sectionHasContent(sec) ? { key: k, title: sec.title, secs: [sec] } : null;
    }).filter(Boolean) as any[];
  } else {
    // Compact, detailed, buyer_summary: use REPORT_GROUPS
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

    // Each chapter starts on a new white page with chapter banner
    let y = whitePage(ctx);

    if (style !== "data_room") {
      y = renderChapterHeader(ctx, group, gi + 1, y);
      // Render key-metric cards on applicable chapter openers
      y = renderChapterMetricCards(ctx, group.key, group.secs, y);
    }

    for (const sec of group.secs) {
      // In detailed mode, give each section a bit more breathing room
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
    // Business name resolution: the val_cafes schema provides `name` as the
    // canonical business identifier. Future columns (businessName, tradingName, title)
    // would be added here in the fallback chain; for now `name` is the sole source.
    const [cafe] = await db
      .select({ id: cafesTable.id, name: cafesTable.name })
      .from(cafesTable)
      .where(and(eq(cafesTable.listingId, listingId), eq(cafesTable.ownerId, userId)))
      .limit(1);

    if (!cafe) {
      res.status(403).json({ error: "Not authorised to export this listing" });
      return;
    }
    const biz = cafe.name ?? "Business";

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

    const sections  = filterSections(allSections, mode, style);
    const modeLabel = mode === "seller" ? "Seller Copy" : "Buyer Copy";
    const dateStr   = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const filename  = `im-report-${listingId.slice(0, 8)}-${mode}-${style}.pdf`;
    const styleLabel = { compact: "Compact Broker IM", detailed: "Detailed Full Report", buyer_summary: "Buyer Summary", data_room: "Data Room Appendix" }[style] ?? "Compact Broker IM";

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
    await buildPdf(ctx, sections, style, mode, { listingId, modeLabel, styleLabel, dateStr });

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

    // Look up the business name (not the owner — public endpoint, listingId only)
    const [cafeMeta] = await db
      .select({ name: cafesTable.name })
      .from(cafesTable)
      .where(eq(cafesTable.listingId, listingId))
      .limit(1);
    // Same name-resolution pattern as authenticated handler — `name` is the sole
    // column available in val_cafes today; fallback chain extended here when new
    // columns (businessName, tradingName, title) are added to the schema.
    const biz = cafeMeta?.name ?? "Business";

    const dateStr  = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const filename = `im-report-${listingId.slice(0, 8)}-buyer-${style}.pdf`;
    const VALID_STYLES: PdfStyle[] = ["compact", "detailed", "buyer_summary", "data_room"];
    const effectiveStyle: PdfStyle = VALID_STYLES.includes(style as PdfStyle) ? (style as PdfStyle) : "compact";
    const styleLabel = { compact: "Compact Broker IM", detailed: "Detailed Full Report", buyer_summary: "Buyer Summary", data_room: "Data Room Appendix" }[effectiveStyle] ?? "Compact Broker IM";

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
    });

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
