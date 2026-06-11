import { Router } from "express";
import multer from "multer";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../../middlewares/auth";
import { db, leaseClausesMasterTable, leaseTemplatesTable } from "@workspace/db";
import { logger } from "../../lib/logger";
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

const TEMPLATE_SYSTEM_PROMPT = `You are extracting template variables from a commercial lease analysis result.
Given the JSON analysis of a lease, identify all specific named entities to replace with template variables.
Return ONLY a valid JSON object — no markdown, no explanation.

Return this exact structure:
{
  "template_name": "<descriptive name, e.g. 'VIC Retail Café Lease 5+5 Years'>",
  "variable_map": {
    "TENANT_NAME": "<actual tenant name if found, else omit key>",
    "LANDLORD_NAME": "<actual landlord name if found, else omit key>",
    "BUSINESS_NAME": "<trading/business name if found, else omit key>",
    "PREMISES_ADDRESS": "<full premises address if found, else omit key>",
    "LEASE_DATE": "<commencement date if found, else omit key>",
    "RENT_AMOUNT": "<weekly/monthly rent if found, else omit key>",
    "LEASE_TERM": "<full term description if found, else omit key>"
  }
}

Only include keys that have actual known values from the document. Omit keys with null or unknown values.`;

// ─── Background: upsert clauses + extract template ───────────────────────────
async function storeAnalysisInBackground(
  analysisResult: Record<string, unknown>,
  userId: string,
  isPdf: boolean,
  base64Pdf: string | undefined,
  text: string | undefined,
): Promise<void> {
  try {
    // 1. Upsert extracted clauses into lease_clauses_master
    const clauses = (analysisResult.clauses ?? []) as Array<Record<string, unknown>>;
    const jurisdiction = (analysisResult.jurisdiction as string | null) ?? null;

    for (const clause of clauses) {
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

    // 2. Second Claude call: extract variable map + template name
    let templateMessage: Awaited<ReturnType<typeof anthropic.messages.create>>;

    const userContent = `Here is the commercial lease analysis JSON:\n${JSON.stringify(analysisResult)}`;

    if (isPdf && base64Pdf) {
      templateMessage = await anthropic.messages.create({
        model:      "claude-haiku-4-5",
        max_tokens: 1024,
        system:     TEMPLATE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: [
              {
                type:   "document",
                source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
              },
              { type: "text", text: userContent },
            ] as any,
          },
        ],
      });
    } else {
      templateMessage = await anthropic.messages.create({
        model:      "claude-haiku-4-5",
        max_tokens: 1024,
        system:     TEMPLATE_SYSTEM_PROMPT,
        messages:   [{ role: "user", content: userContent }],
      });
    }

    const rawTemplate = templateMessage.content[0];
    if (rawTemplate.type !== "text") return;

    let templateData: { template_name?: string; variable_map?: Record<string, string> };
    try {
      const cleaned = rawTemplate.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      templateData = JSON.parse(cleaned);
    } catch {
      logger.warn("Template extraction returned invalid JSON — skipping DB storage");
      return;
    }

    const templateName = templateData.template_name
      || `${jurisdiction ?? "AU"} ${(analysisResult.leaseType as string) ?? "Commercial"} Lease`;

    await db.insert(leaseTemplatesTable).values({
      name:            templateName,
      jurisdiction,
      leaseType:       (analysisResult.leaseType as string | null) ?? null,
      templateContent: JSON.stringify(analysisResult.clauses ?? []),
      variableMap:     templateData.variable_map ?? {},
      isMaster:        false,
      createdByUserId: userId,
    });

    logger.info({ templateName, clauses: clauses.length }, "Template stored");
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
    let textForBg: string | undefined;

    if (isPdf) {
      const base64Pdf = file.buffer.toString("base64");
      base64PdfForBg = base64Pdf;

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
          } catch {
            text = "";
          }
        }
      } else {
        try {
          const parsed = await mammoth.extractRawText({ buffer: file.buffer });
          text = parsed.value ?? "";
        } catch {
          text = "";
        }
      }

      if (!text.trim()) {
        return res.status(422).json({
          error: "Could not extract text from document. The file may be corrupted or in an unsupported format. Please try saving as PDF or DOCX and uploading again.",
        });
      }

      const truncated = text.slice(0, 60000);
      textForBg = truncated;

      message = await anthropic.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 8192,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: `Please analyse the following commercial lease document:\n\n${truncated}` }],
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

    // Send result immediately — then store clauses + template in background
    res.json(parsed);

    const userId = req.user!.id;
    setImmediate(() => {
      storeAnalysisInBackground(parsed, userId, isPdf, base64PdfForBg, textForBg).catch(() => {});
    });

    return;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
