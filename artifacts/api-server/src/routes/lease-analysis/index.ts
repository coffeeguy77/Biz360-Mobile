import { Router } from "express";
import multer from "multer";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../../middlewares/auth";
import { db, leaseClausesMasterTable, leaseTemplatesTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { and, count, eq } from "drizzle-orm";
import { extractTemplateFromAnalysis } from "../../lib/template-extraction";
import { setAnalysis } from "../../lib/analysis-cache";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SYSTEM_PROMPT = `You are an expert commercial lease lawyer in Australia, specialising in café and food business tenancies. 
Analyse the provided lease document and return a JSON object. 
The JSON must be valid and parseable. Return ONLY the JSON object, no markdown, no explanation.

Return this exact structure:
{
  "jurisdiction": "<ACT|NSW|VIC|QLD|SA|WA|TAS|NT or null>",
  "leaseType": "<commercial|retail|licence|mixed or null>",
  "parties": { "tenant": "<string or null>", "landlord": "<string or null>" },
  "premises": "<description or null>",
  "term": "<e.g. 5 years + 5 year option or null>",
  "rentAmount": "<e.g. $2,500/week + outgoings or null>",
  "clauses": [
    {
      "title": "<short descriptive title>",
      "category": "<one of: Rent & Outgoings|Lease Term & Options|Use & Exclusivity|Assignment & Subletting|Make-Good|Services & Infrastructure|Signage & Marketing|Rent Review|Termination & Security|Licence Areas|Incentives|Rent Commencement|Insurance|Other>",
      "rating": "<tenant-friendly|landlord-friendly|balanced>",
      "riskLevel": "<low|medium|high|critical>",
      "plainEnglish": "<1-3 sentence plain English explanation>",
      "originalText": "<verbatim clause text from document, max 400 chars>",
      "suggestedText": "<improved version favouring the tenant, max 400 chars>",
      "cafeRelevanceScore": <1-5 integer>,
      "negotiationScore": <1-5 integer>
    }
  ],
  "overallRating": "<tenant-friendly|landlord-friendly|balanced>",
  "summary": "<2-3 sentence plain English lease summary>",
  "redFlags": ["<string>"],
  "positives": ["<string>"]
}

Focus on clauses that significantly affect café operators: rent terms, options, exclusivity, assignment, make-good, outgoings, services, disruption, and exit rights. Extract 8-20 key clauses.`;

// ─── Background: upsert clauses + extract + store template ───────────────────
async function storeAnalysisInBackground(
  analysisResult: Record<string, unknown>,
  userId: string,
  analysisId: string,
  isPdf: boolean,
  base64Pdf: string | undefined,
  extractedText: string | undefined,
): Promise<void> {
  try {
    const rawClauses = (analysisResult.clauses ?? []) as Array<Record<string, unknown>>;
    const jurisdiction = (analysisResult.jurisdiction as string | null) ?? null;

    // 1. Upsert each extracted clause into the shared lease_clauses_master library
    for (const clause of rawClauses) {
      const title = clause.title as string;
      if (!title) continue;
      try {
        await db
          .insert(leaseClausesMasterTable)
          .values({
            title,
            category:           (clause.category as string) || "Other",
            rating:             (clause.rating as string) || "balanced",
            riskLevel:          (clause.riskLevel as string) || "medium",
            plainEnglish:       (clause.plainEnglish as string) || "",
            originalText:       (clause.originalText as string) || "",
            suggestedText:      (clause.suggestedText as string | undefined),
            jurisdiction,
            cafeRelevanceScore: (clause.cafeRelevanceScore as number) || 3,
            negotiationScore:   (clause.negotiationScore as number) || 3,
            isSeed:             false,
          })
          .onConflictDoNothing();
      } catch (e) {
        logger.warn({ err: e, title }, "Failed to upsert master clause");
      }
    }

    // 2. Second Claude call: produce templateClauses with {{PLACEHOLDER}} tokens.
    //    For DOC/DOCX: extractedText provides full raw document for richer entity detection.
    //    For PDF: base64Pdf is attached so Claude can reference the original document.
    const templateData = await extractTemplateFromAnalysis(
      analysisResult,
      extractedText,
      isPdf ? base64Pdf : undefined,
    );

    if (!templateData) {
      logger.warn("Template extraction returned null — skipping DB storage to prevent raw data exposure");
      return;
    }

    // Fail closed: require valid template_clauses to avoid storing raw clauses with real party names
    const templateClauses = templateData.template_clauses;
    if (!Array.isArray(templateClauses) || templateClauses.length === 0) {
      logger.warn("Template extraction returned empty/missing template_clauses — skipping DB storage");
      return;
    }

    // Validate that at least some clauses have been templatised (contain {{VAR}} tokens)
    const hasPlaceholders = templateClauses.some(
      c => /{{[A-Z_]+}}/.test(JSON.stringify(c)),
    );
    if (!hasPlaceholders) {
      logger.warn("Template clauses contain no {{PLACEHOLDER}} tokens — skipping DB storage");
      return;
    }

    const templateName = templateData.template_name
      || `${jurisdiction ?? "AU"} ${(analysisResult.leaseType as string) ?? "Commercial"} Lease Template`;

    const templateContent = JSON.stringify(templateClauses);

    // Mark as master if first template for this jurisdiction + leaseType combination
    const leaseType = (analysisResult.leaseType as string | null) ?? null;
    let isMaster = false;
    try {
      const conditions = [
        jurisdiction ? eq(leaseTemplatesTable.jurisdiction, jurisdiction) : undefined,
        leaseType    ? eq(leaseTemplatesTable.leaseType,    leaseType)    : undefined,
      ].filter(Boolean) as ReturnType<typeof eq>[];

      const existing = await db
        .select({ n: count() })
        .from(leaseTemplatesTable)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

      isMaster = Number(existing[0]?.n ?? 0) === 0;
    } catch { /* fall back to false */ }

    await db.insert(leaseTemplatesTable).values({
      name:             templateName,
      jurisdiction,
      leaseType,
      templateContent,
      variableMap:      templateData.variable_map ?? {},
      isMaster,
      sourceAnalysisId: analysisId,
      createdByUserId:  userId,
    });

    logger.info({ templateName, clauses: rawClauses.length }, "Lease template stored from analysis");
  } catch (err) {
    logger.error({ err }, "Background template extraction failed");
  }
}

router.post("/lease-analysis", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const mime = file.mimetype;
    const name = file.originalname.toLowerCase();
    const isPdf  = mime === "application/pdf" || name.endsWith(".pdf");
    const isDocx = mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx");
    const isDoc  = mime === "application/msword" || mime === "application/vnd.ms-word" || name.endsWith(".doc");

    if (!isPdf && !isDocx && !isDoc) {
      return res.status(400).json({ error: "Only PDF, DOCX, and DOC files are supported" });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let message: any;
    let base64PdfForBg: string | undefined;
    let extractedTextForBg: string | undefined;

    if (isPdf) {
      const base64Pdf = file.buffer.toString("base64");
      base64PdfForBg  = base64Pdf;

      message = await anthropic.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 8192,
        system:     SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: [
              {
                type:   "document",
                source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
              },
              { type: "text", text: "Please analyse the commercial lease document provided above." },
            ] as any,
          },
        ],
      });
    } else {
      let text = "";

      if (isDoc) {
        const tmpPath = join(tmpdir(), `lease-${Date.now()}-${Math.random().toString(36).slice(2)}.doc`);
        try {
          writeFileSync(tmpPath, file.buffer);
          text = execSync(`antiword "${tmpPath}"`, { timeout: 30000 }).toString();
        } catch {
          text = "";
        } finally {
          try { unlinkSync(tmpPath); } catch { /* ignore */ }
        }
        if (!text.trim()) {
          try {
            const parsed = await mammoth.extractRawText({ buffer: file.buffer });
            text = parsed.value ?? "";
          } catch { text = ""; }
        }
      } else {
        try {
          const parsed = await mammoth.extractRawText({ buffer: file.buffer });
          text = parsed.value ?? "";
        } catch { text = ""; }
      }

      if (!text.trim()) {
        return res.status(422).json({
          error: "Could not extract text from document. The file may be corrupted or in an unsupported format. Please try saving as PDF or DOCX and uploading again.",
        });
      }

      // Full text preserved for background extraction entity detection;
      // only first 60k chars sent to primary analysis call.
      extractedTextForBg = text;

      message = await anthropic.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 8192,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: `Please analyse the following commercial lease document:\n\n${text.slice(0, 60000)}` }],
      });
    }

    const raw = message.content[0];
    if (raw.type !== "text") {
      return res.status(500).json({ error: "Unexpected response from AI" });
    }

    let parsed: Record<string, unknown>;
    try {
      const cleaned = raw.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON", raw: raw.text.slice(0, 500) });
    }

    // Generate a unique ID for this analysis.
    // Returned to the client so it can call POST /api/lease-templates { analysedLeaseId }
    // for idempotent template retrieval/extraction.
    const analysisId = randomUUID();

    // Cache the analysis data for 2 hours (background task may still be running)
    setAnalysis(analysisId, parsed);

    // Include analysisId in the response alongside the full analysis result
    res.json({ ...parsed, analysisId });

    // Background: upsert clauses + extract and store template
    const userId = req.user!.id;
    setImmediate(() => {
      storeAnalysisInBackground(parsed, userId, analysisId, isPdf, base64PdfForBg, extractedTextForBg).catch(() => {});
    });

    return;
  } catch (err: unknown) {
    // Anthropic SDK can throw APIError objects that don't always pass instanceof Error
    // across module boundaries. Extract a useful message regardless of the shape.
    let msg: string;
    if (err instanceof Error) {
      msg = err.message;
    } else if (typeof err === "object" && err !== null) {
      const e = err as Record<string, unknown>;
      if (typeof e["message"] === "string") msg = e["message"];
      else if (typeof e["error"] === "string") msg = e["error"];
      else msg = JSON.stringify(e).slice(0, 300);
    } else {
      msg = String(err);
    }
    logger.error({ err }, "Lease analysis failed");
    return res.status(500).json({ error: msg });
  }
});

export default router;
