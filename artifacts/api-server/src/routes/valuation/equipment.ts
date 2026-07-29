import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cafeEquipmentTable, cafesTable, businessUnitsTable } from "@workspace/db";
import { assertCafeOwner } from "./cafes";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

// ── PDF layout constants (matches IM report style) ────────────────────────────
const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 48;
const CW      = PAGE_W - MARGIN * 2;    // content width
const HDR_H   = 26;
const FTR_H   = 22;
const CT      = HDR_H + 14;             // content top y
const CB      = PAGE_H - FTR_H - 12;   // content bottom y

const NAVY    = "#0A1828";
const DARK    = "#070F1C";
const DARK_M  = "#0F2040";
const WHITE   = "#FFFFFF";
const BLUE    = "#3B82F6";
const BODY    = "#374151";
const MUTED   = "#6B7280";
const BORDER  = "#E2E8F0";
const HEADING = "#0F172A";
const CHIP_BG = "#EFF6FF";

function safe(t: string | null | undefined): string {
  return (t ?? "").replace(/[\u{1F000}-\u{1FAFF}]/gu, "").replace(/[\u{2600}-\u{27BF}]/gu, "").trim();
}
function fmtAud(n: number): string {
  if (n === 0) return "—";
  return `$${Math.round(n).toLocaleString("en-AU")}`;
}
function numOf(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return isNaN(n) ? 0 : n;
}

interface PdfCtx { doc: any; pg: number; biz: string; reportTitle: string; }

function addPage(ctx: PdfCtx): number {
  ctx.doc.addPage({ size: "A4", margin: 0 });
  ctx.pg++;
  // Background
  ctx.doc.save().rect(0, 0, PAGE_W, PAGE_H).fill(WHITE).restore();
  // Header bar
  ctx.doc.save().rect(0, 0, PAGE_W, HDR_H).fill(NAVY).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#94A3B8")
    .text(safe(ctx.biz).slice(0, 55), MARGIN, 9, { width: CW * 0.55 });
  ctx.doc.font("Helvetica").fontSize(6.5).fillColor("#94A3B8")
    .text(safe(ctx.reportTitle), MARGIN + CW * 0.55, 9, { width: CW * 0.45, align: "right" });
  // Footer bar
  ctx.doc.save().rect(0, PAGE_H - FTR_H, PAGE_W, FTR_H).fill(NAVY).restore();
  ctx.doc.font("Helvetica").fontSize(6.5).fillColor(MUTED)
    .text("Confidential · Exit360", MARGIN, PAGE_H - 14, { width: CW * 0.5 });
  ctx.doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#94A3B8")
    .text(`${ctx.pg}`, MARGIN, PAGE_H - 14, { width: CW, align: "right" });
  return CT;
}

function checkY(ctx: PdfCtx, y: number, need: number): number {
  return y + need > CB ? addPage(ctx) : y;
}

// ── Cover page ─────────────────────────────────────────────────────────────────
function drawCover(
  ctx: PdfCtx,
  locationName: string,
  generatedDate: string,
  totalValue: number,
  totalReplacement: number,
  itemCount: number,
) {
  const doc = ctx.doc;
  doc.addPage({ size: "A4", margin: 0 });
  ctx.pg++;

  // Dark gradient background
  doc.save().rect(0, 0, PAGE_W, PAGE_H).fill(DARK).restore();
  doc.save().rect(0, 0, PAGE_W, PAGE_H / 2).fill(DARK_M).restore();
  // Diagonal accent band
  doc.save()
    .moveTo(0, PAGE_H * 0.42).lineTo(PAGE_W, PAGE_H * 0.30)
    .lineTo(PAGE_W, PAGE_H * 0.36).lineTo(0, PAGE_H * 0.48)
    .fill("#132540");
  doc.restore();
  // Blue top accent line
  doc.save().rect(MARGIN, 48, 56, 3).fill(BLUE).restore();

  // Title block
  doc.font("Helvetica").fontSize(10).fillColor("#93C5FD")
    .text("EQUIPMENT ASSET REPORT", MARGIN, 58, { width: CW, align: "left" });
  doc.font("Helvetica-Bold").fontSize(32).fillColor(WHITE)
    .text(safe(locationName), MARGIN, 76, { width: CW, lineGap: 4 });

  // Separator
  doc.save().rect(MARGIN, 148, CW, 1).fill("#1E3A5C").restore();

  doc.font("Helvetica").fontSize(11).fillColor("#93C5FD")
    .text(safe(ctx.biz), MARGIN, 158, { width: CW });
  doc.font("Helvetica").fontSize(9).fillColor("#64748B")
    .text(`Generated ${generatedDate}`, MARGIN, 175, { width: CW });

  // Summary stat cards
  const cardY  = PAGE_H * 0.44;
  const cardW  = (CW - 20) / 3;
  const cards = [
    { label: "CURRENT VALUE",      value: fmtAud(totalValue),       color: BLUE },
    { label: "REPLACEMENT COST",   value: fmtAud(totalReplacement), color: "#A78BFA" },
    { label: "TOTAL ITEMS",        value: String(itemCount),         color: "#34D399" },
  ];
  cards.forEach(({ label, value, color }, i) => {
    const x = MARGIN + i * (cardW + 10);
    doc.save().roundedRect(x, cardY, cardW, 78, 8).fill("#0D2040").restore();
    doc.save().rect(x, cardY, 3, 78).fill(color).restore();
    doc.font("Helvetica").fontSize(7).fillColor("#64748B")
      .text(label, x + 12, cardY + 14, { width: cardW - 16 });
    doc.font("Helvetica-Bold").fontSize(18).fillColor(WHITE)
      .text(safe(value), x + 12, cardY + 28, { width: cardW - 16 });
  });

  // Footer
  doc.save().rect(0, PAGE_H - 38, PAGE_W, 38).fill("#060E1B").restore();
  doc.font("Helvetica").fontSize(7).fillColor("#334155")
    .text("Confidential · Exit360 Business Marketplace · exit360.com.au", MARGIN, PAGE_H - 22, { width: CW });
}

// ── Category divider strip ─────────────────────────────────────────────────────
function drawCategoryDivider(ctx: PdfCtx, y: number, title: string, count: number, total: number): number {
  y = checkY(ctx, y, 28);
  ctx.doc.save().roundedRect(MARGIN, y, CW, 24, 5).fill(CHIP_BG).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(9.5).fillColor(HEADING)
    .text(safe(title).toUpperCase(), MARGIN + 10, y + 7, { width: CW * 0.6 });
  ctx.doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    .text(`${count} item${count !== 1 ? "s" : ""}  ·  ${fmtAud(total)}`, MARGIN + 10, y + 7, { width: CW - 20, align: "right" });
  return y + 32;
}

// ── Table header row ──────────────────────────────────────────────────────────
function drawTableHeader(doc: any, y: number): number {
  const cols = [0, CW * 0.38, CW * 0.55, CW * 0.72, CW * 0.87];
  doc.save().rect(MARGIN, y, CW, 16).fill("#F8FAFC").restore();
  doc.save().rect(MARGIN, y + 15, CW, 0.5).fill(BORDER).restore();
  const headers = ["ITEM", "BRAND", "CONDITION", "CURRENT VALUE", "REPLACEMENT"];
  headers.forEach((h, i) => {
    const align = i >= 3 ? "right" : "left";
    const w     = i < headers.length - 1 ? cols[i + 1] - cols[i] - 4 : CW - cols[i] - 2;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#94A3B8")
      .text(h, MARGIN + cols[i] + (align === "right" ? 0 : 2), y + 5, { width: w, align });
  });
  return y + 18;
}

// ── Equipment row ─────────────────────────────────────────────────────────────
function drawEquipmentRow(ctx: PdfCtx, y: number, item: any, shade: boolean): number {
  const rowH = 20;
  y = checkY(ctx, y, rowH + 2);
  if (shade) ctx.doc.save().rect(MARGIN, y, CW, rowH).fill("#FAFBFC").restore();
  ctx.doc.save().rect(MARGIN, y + rowH, CW, 0.5).fill(BORDER).restore();

  const cols = [0, CW * 0.38, CW * 0.55, CW * 0.72, CW * 0.87];

  // Item name
  ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(HEADING)
    .text(safe(item.name).slice(0, 42), MARGIN + cols[0] + 2, y + 5, { width: cols[1] - cols[0] - 6, ellipsis: true });

  // Brand
  ctx.doc.font("Helvetica").fontSize(8).fillColor(BODY)
    .text(safe(item.brand ?? "—"), MARGIN + cols[1] + 2, y + 5, { width: cols[2] - cols[1] - 4, ellipsis: true });

  // Condition pill
  const cond = (item.condition ?? "").toLowerCase();
  const condColor = cond === "excellent" ? "#059669" : cond === "good" ? "#2563EB" : cond === "fair" ? "#D97706" : cond === "poor" ? "#DC2626" : MUTED;
  const condLabel = item.condition ? safe(item.condition) : "—";
  const condX = MARGIN + cols[2] + 2;
  if (item.condition) {
    ctx.doc.save().roundedRect(condX - 1, y + 4, 44, 12, 4).fill(`${condColor}18`).restore();
  }
  ctx.doc.font("Helvetica").fontSize(7.5).fillColor(condColor)
    .text(condLabel, condX + 2, y + 6, { width: 40, align: "left" });

  // Current value
  const cv = numOf(item.currentValue);
  ctx.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(cv > 0 ? HEADING : MUTED)
    .text(fmtAud(cv), MARGIN + cols[3], y + 5, { width: cols[4] - cols[3] - 4, align: "right" });

  // Replacement cost
  const rc = numOf(item.replacementCost);
  ctx.doc.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text(fmtAud(rc), MARGIN + cols[4], y + 5, { width: CW - cols[4] - 2, align: "right" });

  // Leased badge
  if (item.ownership === "leased" || item.isLeased) {
    ctx.doc.save().roundedRect(MARGIN + cols[1] + 2, y + 12, 28, 6, 2).fill("#FEF3C7").restore();
    ctx.doc.font("Helvetica").fontSize(5.5).fillColor("#92400E").text("LEASED", MARGIN + cols[1] + 3, y + 13, { width: 26 });
  }

  return y + rowH + 1;
}

// ── Summary totals block ───────────────────────────────────────────────────────
function drawTotals(ctx: PdfCtx, y: number, totalVal: number, totalRepl: number, itemCount: number): number {
  y = checkY(ctx, y, 44);
  ctx.doc.save().rect(MARGIN, y, CW, 1).fill(NAVY).restore();
  y += 6;
  ctx.doc.save().roundedRect(MARGIN, y, CW, 36, 6).fill(CHIP_BG).restore();
  ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(HEADING)
    .text("REPORT TOTALS", MARGIN + 12, y + 7, { width: CW / 3 });
  ctx.doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE)
    .text(fmtAud(totalVal), MARGIN + 12, y + 18, { width: CW / 3 });
  ctx.doc.font("Helvetica").fontSize(7).fillColor(MUTED)
    .text("Current Value", MARGIN + 12, y + 32, { width: CW / 3 });

  ctx.doc.font("Helvetica-Bold").fontSize(11).fillColor("#8B5CF6")
    .text(fmtAud(totalRepl), MARGIN + CW / 2, y + 18, { width: CW / 3 });
  ctx.doc.font("Helvetica").fontSize(7).fillColor(MUTED)
    .text("Replacement Cost", MARGIN + CW / 2, y + 32, { width: CW / 3 });

  ctx.doc.font("Helvetica-Bold").fontSize(11).fillColor("#059669")
    .text(String(itemCount), MARGIN + (CW * 5) / 6, y + 18, { width: CW / 6 });
  ctx.doc.font("Helvetica").fontSize(7).fillColor(MUTED)
    .text("Items", MARGIN + (CW * 5) / 6, y + 32, { width: CW / 6 });

  return y + 48;
}

// ── Category bar chart (overview page) ────────────────────────────────────────
function drawCategoryChart(ctx: PdfCtx, y: number, categories: { name: string; value: number; count: number }[], totalVal: number): number {
  const barMaxW = CW - 120;
  const rowH    = 20;
  y = checkY(ctx, y, 14 + categories.length * rowH + 8);

  ctx.doc.font("Helvetica-Bold").fontSize(9).fillColor(HEADING)
    .text("VALUE BY CATEGORY", MARGIN, y);
  y += 14;

  categories.forEach((cat, i) => {
    y = checkY(ctx, y, rowH);
    const pct  = totalVal > 0 ? cat.value / totalVal : 0;
    const barW = Math.max(2, Math.round(pct * barMaxW));
    if (i % 2 === 0) ctx.doc.save().rect(MARGIN, y, CW, rowH).fill("#F8FAFC").restore();

    ctx.doc.font("Helvetica").fontSize(8).fillColor(BODY)
      .text(safe(cat.name).slice(0, 30), MARGIN + 4, y + 5, { width: 110 });

    // Bar
    const barX = MARGIN + 118;
    ctx.doc.save().roundedRect(barX, y + 7, barMaxW, 6, 3).fill(BORDER).restore();
    ctx.doc.save().roundedRect(barX, y + 7, barW, 6, 3).fill(BLUE).restore();

    // Count + value
    ctx.doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(`${cat.count}`, barX + barMaxW + 6, y + 5, { width: 22, align: "right" });
    ctx.doc.font("Helvetica-Bold").fontSize(8).fillColor(HEADING)
      .text(fmtAud(cat.value), barX + barMaxW + 30, y + 5, { width: CW - 118 - barMaxW - 30, align: "right" });
    y += rowH;
  });
  return y + 8;
}

const router: IRouter = Router({ mergeParams: true });

function resolveCurrentValue(item: {
  valuationMode?: string;
  secondhandValue?: number | string | null;
  replacementCost?: number | string | null;
  manualValue?: number | string | null;
  purchasePrice?: number | string | null;
}): string | null {
  const mode = item.valuationMode ?? "secondhand";
  if (mode === "secondhand" && item.secondhandValue != null) return String(item.secondhandValue);
  if (mode === "replacement" && item.replacementCost != null) return String(item.replacementCost);
  if (mode === "manual" && item.manualValue != null) return String(item.manualValue);
  if (item.secondhandValue != null) return String(item.secondhandValue);
  if (item.purchasePrice != null) return String(item.purchasePrice);
  return null;
}

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const { unit_id } = req.query as { unit_id?: string };
  const conditions = [eq(cafeEquipmentTable.cafeId, cafeId), eq(cafeEquipmentTable.suspended, false)];
  if (unit_id) conditions.push(eq(cafeEquipmentTable.unitId, unit_id) as any);
  const items = await db.select().from(cafeEquipmentTable).where(and(...conditions));
  return res.json(items);
});

router.post("/", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const {
    name, category, brand, purchaseDate, condition, depreciationYears,
    purchasePrice, secondhandValue, replacementCost, currentValue, manualValue,
    valuationMode, ownership, notes, isLeased, unit_id,
  } = req.body as {
    name?: string; category?: string; brand?: string; purchaseDate?: string;
    condition?: string; depreciationYears?: number;
    purchasePrice?: number; secondhandValue?: number; replacementCost?: number;
    currentValue?: number; manualValue?: number; valuationMode?: string;
    ownership?: string; notes?: string; isLeased?: boolean; unit_id?: string;
  };
  if (!name) return res.status(400).json({ error: "name is required" });
  const resolvedVal = currentValue != null
    ? String(currentValue)
    : resolveCurrentValue({ valuationMode, secondhandValue, replacementCost, manualValue, purchasePrice });
  const [item] = await db.insert(cafeEquipmentTable).values({
    cafeId,
    ownerId: userId,
    unitId: unit_id || null,
    name,
    category: category || null,
    brand: brand || null,
    purchaseDate: purchaseDate || null,
    condition: condition || null,
    depreciationYears: depreciationYears != null ? depreciationYears : null,
    purchasePrice: purchasePrice != null ? String(purchasePrice) : null,
    secondhandValue: secondhandValue != null ? String(secondhandValue) : null,
    replacementCost: replacementCost != null ? String(replacementCost) : null,
    currentValue: resolvedVal,
    valuationMode: valuationMode || "secondhand",
    ownership: ownership || null,
    notes: notes || null,
    isLeased: isLeased ?? false,
    suspended: false,
  }).returning();
  return res.status(201).json(item);
});

// ─── Bulk CSV import ──────────────────────────────────────────────────────────

router.post("/import", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;

  const { items, unit_id } = req.body as {
    items: Array<{
      name: string; category?: string; brand?: string; purchaseDate?: string;
      condition?: string; depreciationYears?: number;
      purchasePrice?: number; secondhandValue?: number; replacementCost?: number;
      manualValue?: number; valuationMode?: string; ownership?: string; notes?: string;
    }>;
    unit_id?: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }

  const rows = items
    .filter((item) => item.name && String(item.name).trim())
    .map((item) => ({
      cafeId,
      ownerId: userId,
      unitId: unit_id || null,
      name: String(item.name).trim(),
      category: item.category || null,
      brand: item.brand || null,
      purchaseDate: item.purchaseDate || null,
      condition: item.condition || null,
      depreciationYears: item.depreciationYears != null ? Number(item.depreciationYears) : null,
      purchasePrice: item.purchasePrice != null ? String(item.purchasePrice) : null,
      secondhandValue: item.secondhandValue != null ? String(item.secondhandValue) : null,
      replacementCost: item.replacementCost != null ? String(item.replacementCost) : null,
      currentValue: resolveCurrentValue(item),
      valuationMode: item.valuationMode || "secondhand",
      ownership: item.ownership || null,
      notes: item.notes || null,
      isLeased: item.ownership === "leased",
      suspended: false,
    }));

  if (rows.length === 0) {
    return res.status(400).json({ error: "No valid rows to import" });
  }

  const inserted = await db.insert(cafeEquipmentTable).values(rows).returning();
  return res.status(201).json({ imported: inserted.length, items: inserted });
});

router.patch("/:equipmentId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, equipmentId } = req.params as { cafeId: string; equipmentId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const {
    name, category, brand, purchaseDate, condition, depreciationYears,
    purchasePrice, secondhandValue, replacementCost, currentValue, manualValue,
    valuationMode, ownership, notes, isLeased, unit_id,
  } = req.body as {
    name?: string; category?: string; brand?: string; purchaseDate?: string;
    condition?: string; depreciationYears?: number;
    purchasePrice?: number; secondhandValue?: number; replacementCost?: number;
    currentValue?: number; manualValue?: number; valuationMode?: string;
    ownership?: string; notes?: string; isLeased?: boolean; unit_id?: string | null;
  };
  const resolvedVal = currentValue != null
    ? String(currentValue)
    : resolveCurrentValue({ valuationMode, secondhandValue, replacementCost, manualValue, purchasePrice });
  const [updated] = await db.update(cafeEquipmentTable).set({
    ...(name !== undefined && { name }),
    ...(category !== undefined && { category }),
    ...(brand !== undefined && { brand }),
    ...(purchaseDate !== undefined && { purchaseDate }),
    ...(condition !== undefined && { condition }),
    ...(depreciationYears !== undefined && { depreciationYears }),
    ...(purchasePrice !== undefined && { purchasePrice: String(purchasePrice) }),
    ...(secondhandValue !== undefined && { secondhandValue: String(secondhandValue) }),
    ...(replacementCost !== undefined && { replacementCost: String(replacementCost) }),
    ...(resolvedVal !== null && { currentValue: resolvedVal }),
    ...(valuationMode !== undefined && { valuationMode }),
    ...(ownership !== undefined && { ownership }),
    ...(notes !== undefined && { notes }),
    ...(isLeased !== undefined && { isLeased }),
    ...(unit_id !== undefined && { unitId: unit_id }),
  }).where(and(eq(cafeEquipmentTable.id, equipmentId), eq(cafeEquipmentTable.cafeId, cafeId))).returning();
  if (!updated) return res.status(404).json({ error: "Equipment not found" });
  return res.json(updated);
});

router.delete("/:equipmentId", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, equipmentId } = req.params as { cafeId: string; equipmentId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  await db.delete(cafeEquipmentTable).where(and(eq(cafeEquipmentTable.id, equipmentId), eq(cafeEquipmentTable.cafeId, cafeId)));
  return res.json({ ok: true });
});

// ── Equipment Asset Report PDF ─────────────────────────────────────────────────
// GET /valuation/cafes/:cafeId/equipment/pdf?unit_id=<id>
// Returns a professional A4 PDF report for the specified location (or all).
router.get("/pdf", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId } = req.params as { cafeId: string };
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;

  const { unit_id } = req.query as { unit_id?: string };

  // Load cafe name, units, and equipment in parallel
  const [cafeRows, unitRows] = await Promise.all([
    db.select().from(cafesTable).where(eq(cafesTable.id, cafeId)).limit(1),
    db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafeId)),
  ]);

  const cafe = cafeRows[0];
  const bizName = safe((cafe as any)?.businessName ?? (cafe as any)?.name ?? "My Business");

  const conditions = [eq(cafeEquipmentTable.cafeId, cafeId), eq(cafeEquipmentTable.suspended, false)];
  if (unit_id) conditions.push(eq(cafeEquipmentTable.unitId, unit_id) as any);
  const equipment = await db.select().from(cafeEquipmentTable).where(and(...conditions));

  // Resolve location name
  let locationName = "All Locations";
  if (unit_id) {
    const unit = unitRows.find((u) => u.id === unit_id);
    locationName = unit ? safe(unit.name) : "Selected Location";
  }

  // Build category map
  const categoryMap = new Map<string, typeof equipment>();
  for (const item of equipment) {
    const cat = (item.category?.trim()) || "Uncategorised";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(item);
  }
  // Sort items within each category by current value descending
  for (const [, items] of categoryMap) {
    items.sort((a, b) => numOf(b.currentValue) - numOf(a.currentValue));
  }
  // Sort categories by total value descending
  const sortedCategories = [...categoryMap.entries()].sort((a, b) => {
    const aT = a[1].reduce((s, i) => s + numOf(i.currentValue), 0);
    const bT = b[1].reduce((s, i) => s + numOf(i.currentValue), 0);
    return bT - aT;
  });

  const totalValue   = equipment.reduce((s, i) => s + numOf(i.currentValue), 0);
  const totalRepl    = equipment.reduce((s, i) => s + numOf(i.replacementCost), 0);
  const generatedDate = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const reportTitle  = `Equipment Report · ${locationName}`;
  const filename     = `equipment-report-${locationName.toLowerCase().replace(/\s+/g, "-")}.pdf`;

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, info: { Title: reportTitle, Author: "Exit360" } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const ctx: PdfCtx = { doc, pg: 0, biz: bizName, reportTitle };

  // Cover
  drawCover(ctx, locationName, generatedDate, totalValue, totalRepl, equipment.length);

  // Overview page: category chart
  let y = addPage(ctx);
  y += 10;
  doc.font("Helvetica-Bold").fontSize(16).fillColor(HEADING)
    .text("Overview", MARGIN, y, { width: CW });
  y += 24;

  const catChartData = sortedCategories.map(([name, items]) => ({
    name,
    value: items.reduce((s, i) => s + numOf(i.currentValue), 0),
    count: items.length,
  }));
  y = drawCategoryChart(ctx, y, catChartData, totalValue);
  y += 8;
  y = drawTotals(ctx, y, totalValue, totalRepl, equipment.length);

  // Per-category detail pages
  for (const [cat, items] of sortedCategories) {
    const catTotal = items.reduce((s, i) => s + numOf(i.currentValue), 0);

    // New page for each category (keeps things clean)
    y = addPage(ctx);
    y += 8;

    // Category heading
    doc.font("Helvetica-Bold").fontSize(15).fillColor(HEADING)
      .text(safe(cat), MARGIN, y, { width: CW });
    y += 18;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(`${items.length} item${items.length !== 1 ? "s" : ""}  ·  Total current value: ${fmtAud(catTotal)}`, MARGIN, y, { width: CW });
    y += 20;

    // Table header
    y = drawTableHeader(doc, y);

    // Equipment rows
    items.forEach((item, idx) => {
      y = drawEquipmentRow(ctx, y, item, idx % 2 === 0);
    });

    // Category subtotal
    y = checkY(ctx, y, 24);
    y += 4;
    doc.save().rect(MARGIN, y, CW, 0.5).fill(BORDER).restore();
    y += 5;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED)
      .text(`Subtotal — ${safe(cat)}`, MARGIN + 2, y + 3, { width: CW * 0.6 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE)
      .text(fmtAud(catTotal), MARGIN, y + 3, { width: CW - 2, align: "right" });
    y += 20;
  }

  doc.end();
});

export default router;
