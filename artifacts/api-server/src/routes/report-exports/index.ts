import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import {
  db, reportSectionsTable, reportExportsTable, cafesTable,
} from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { logger } from "../../lib/logger";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const router = Router();

const BLUE_ACC = "#3B82F6";
const WHITE    = "#FFFFFF";
const LIGHT    = "#CBD5E1";
const MUTED    = "#8B9CB8";

// ─── PDF generation handler ───────────────────────────────────────────────────
// Shared by GET and POST /api/report-exports/pdf/:listingId
// Query: mode=seller|buyer, versionId=<uuid> (optional)
async function handlePdf(req: any, res: any): Promise<void> {
  const userId    = req.user!.id as string;
  const listingId = req.params.listingId as string;
  const mode      = (req.query.mode as string | undefined) ?? "seller";

  try {
    const [cafe] = await db
      .select({ id: cafesTable.id, name: cafesTable.name })
      .from(cafesTable)
      .where(and(eq(cafesTable.listingId, listingId), eq(cafesTable.ownerId, userId)))
      .limit(1);

    if (!cafe) {
      res.status(403).json({ error: "Not authorised to export this listing" });
      return;
    }

    const allSections = await db
      .select()
      .from(reportSectionsTable)
      .where(eq(reportSectionsTable.listingId, listingId))
      .orderBy(asc(reportSectionsTable.sortOrder));

    const sections = allSections.filter((s) => {
      if (!s.includeInPdf) return false;
      if (s.visibility === "hidden") return false;
      if (mode === "buyer" && s.visibility === "seller_only") return false;
      return true;
    });

    const businessName = cafe.name ?? "Business";
    const modeLabel    = mode === "seller" ? "Seller Copy" : "Buyer Copy";
    const dateStr      = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const filename     = `im-report-${listingId.slice(0, 8)}-${mode}.pdf`;

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title:    `Information Memorandum — ${businessName}`,
        Author:   "Exit360",
        Subject:  "Confidential Business Information Memorandum",
        Keywords: "information memorandum, business for sale, exit360",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    doc.pipe(res);

    const PAGE_W   = 595.28;
    const PAGE_H   = 841.89;
    const MARGIN   = 56;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const DARK     = "#070F1C";
    const DARK_MID = "#0F2040";
    const BORDER   = "#1E3A5C";

    // ── Helper: header / footer ───────────────────────────────────────────────
    function addHeaderFooter(pageNum: number) {
      doc.save().rect(0, 0, PAGE_W, 36).fill("#0A1828").restore();
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
        .text(businessName.toUpperCase(), MARGIN, 14, { width: CONTENT_W / 2 });
      doc.font("Helvetica").fontSize(7).fillColor(MUTED)
        .text("INFORMATION MEMORANDUM · CONFIDENTIAL", MARGIN + CONTENT_W / 2, 14, {
          width: CONTENT_W / 2, align: "right",
        });
      doc.save().rect(0, PAGE_H - 36, PAGE_W, 36).fill("#0A1828").restore();
      doc.font("Helvetica").fontSize(7).fillColor(MUTED)
        .text("Prepared by Exit360 · exit360.com.au", MARGIN, PAGE_H - 22, {
          width: CONTENT_W - 60,
        })
        .text(`Page ${pageNum}`, MARGIN, PAGE_H - 22, { width: CONTENT_W, align: "right" });
    }

    // ── Cover Page ────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(DARK);
    doc.save().rect(0, 0, PAGE_W, 6).fill(BLUE_ACC).restore();

    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE_ACC)
      .text("CONFIDENTIAL", MARGIN, 60, { width: CONTENT_W, align: "center" });

    doc.font("Helvetica-Bold").fontSize(26).fillColor(WHITE)
      .text("Information Memorandum", MARGIN, 86, { width: CONTENT_W, align: "center" });

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#60A5FA")
      .text(businessName, MARGIN, 126, { width: CONTENT_W, align: "center" });

    doc.font("Helvetica").fontSize(10).fillColor(MUTED)
      .text("Prepared by Exit360 · Verified Business Profile", MARGIN, 162, {
        width: CONTENT_W, align: "center",
      });

    doc.save().moveTo(MARGIN, 192).lineTo(PAGE_W - MARGIN, 192)
      .lineWidth(1).strokeColor(BORDER).stroke().restore();

    doc.rect(MARGIN, 210, CONTENT_W, 120).fill(DARK_MID);

    const metaItems = [
      ["Listing Reference", listingId.slice(0, 8).toUpperCase()],
      ["Report Mode", modeLabel],
      ["Date Prepared", dateStr],
      ["Sections", `${sections.length} sections`],
    ];
    metaItems.forEach(([label, value], i) => {
      const col = i < 2 ? 0 : 1;
      const row = i % 2;
      const x = MARGIN + 16 + col * (CONTENT_W / 2);
      const y = 226 + row * 42;
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, y);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(WHITE).text(value, x, y + 12);
    });

    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(
        "This document is confidential and intended solely for the named recipient. Unauthorised disclosure is strictly prohibited.",
        MARGIN, 370, { width: CONTENT_W, align: "center", lineGap: 3 },
      );

    doc.font("Helvetica-Bold").fontSize(16).fillColor(BLUE_ACC)
      .text("Exit360", MARGIN, PAGE_H - 120, { width: CONTENT_W, align: "center" });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text("exit360.com.au", MARGIN, PAGE_H - 100, { width: CONTENT_W, align: "center" });

    // ── Table of Contents ─────────────────────────────────────────────────────
    doc.addPage({ size: "A4", margin: 0 });
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(DARK);
    addHeaderFooter(2);

    doc.font("Helvetica-Bold").fontSize(16).fillColor(WHITE)
      .text("Table of Contents", MARGIN, 56);
    doc.save().moveTo(MARGIN, 80).lineTo(PAGE_W - MARGIN, 80)
      .lineWidth(0.5).strokeColor(BORDER).stroke().restore();

    let tocY = 94;
    sections.forEach((s, idx) => {
      if (tocY > PAGE_H - 80) return;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED)
        .text(`${String(idx + 1).padStart(2, "0")}`, MARGIN, tocY, { width: 24 });
      doc.font("Helvetica").fontSize(10).fillColor(LIGHT)
        .text(s.title, MARGIN + 28, tocY, { width: CONTENT_W - 50 });
      doc.font("Helvetica").fontSize(8).fillColor(MUTED)
        .text(`${idx + 3}`, MARGIN, tocY, { width: CONTENT_W, align: "right" });
      tocY += 18;
    });

    // ── Section Pages ─────────────────────────────────────────────────────────
    sections.forEach((section, idx) => {
      doc.addPage({ size: "A4", margin: 0 });
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(DARK);
      addHeaderFooter(idx + 3);

      const sY = 50;

      doc.save().rect(MARGIN, sY, 4, 26).fill(BLUE_ACC).restore();

      doc.font("Helvetica-Bold").fontSize(7).fillColor(BLUE_ACC)
        .text(`${String(idx + 1).padStart(2, "0")}`, MARGIN + 10, sY + 2);

      doc.font("Helvetica-Bold").fontSize(15).fillColor(WHITE)
        .text(section.title, MARGIN + 30, sY, { width: CONTENT_W - 30 });

      if (section.subtitle) {
        doc.font("Helvetica").fontSize(9).fillColor(MUTED)
          .text(section.subtitle, MARGIN + 30, sY + 22, { width: CONTENT_W - 30 });
      }

      doc.save().moveTo(MARGIN, sY + 42).lineTo(PAGE_W - MARGIN, sY + 42)
        .lineWidth(0.5).strokeColor(BORDER).stroke().restore();

      let bodyY = sY + 56;

      if (section.body) {
        const paras = section.body.split(/\n{2,}/).filter(Boolean);
        for (const para of paras) {
          if (bodyY > PAGE_H - 80) break;
          doc.font("Helvetica").fontSize(10).fillColor(LIGHT)
            .text(para.trim(), MARGIN, bodyY, { width: CONTENT_W, lineGap: 3 });
          bodyY = doc.y + 10;
        }
      }

      const bullets = Array.isArray(section.bulletPoints) ? (section.bulletPoints as string[]) : [];
      if (bullets.length > 0 && bodyY < PAGE_H - 80) {
        bodyY += 6;
        for (const b of bullets) {
          if (!b.trim() || bodyY > PAGE_H - 80) continue;
          doc.save().circle(MARGIN + 5, bodyY + 4.5, 2.5).fill(BLUE_ACC).restore();
          doc.font("Helvetica").fontSize(10).fillColor(LIGHT)
            .text(b.trim(), MARGIN + 16, bodyY, { width: CONTENT_W - 16, lineGap: 2 });
          bodyY = doc.y + 4;
        }
      }

      if (!section.body && !bullets.length) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED)
          .text("This section has not yet been completed.", MARGIN, bodyY, { width: CONTENT_W });
      }
    });

    // ── Audit log ─────────────────────────────────────────────────────────────
    db.insert(reportExportsTable).values({
      listingId,
      ownerId:    userId,
      exportType: mode === "seller" ? "pdf_seller" : "pdf_buyer",
    }).catch((e) => logger.warn({ err: e }, "PDF export audit log failed"));

    doc.end();
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    logger.error({ err: e }, "PDF export failed");
    if (!res.headersSent) {
      res.status(e.status ?? 500).json({ error: e.message ?? "Failed to generate PDF" });
    }
  }
}

router.get("/report-exports/pdf/:listingId",  requireAuth, handlePdf);
router.post("/report-exports/pdf/:listingId", requireAuth, handlePdf);

export default router;
