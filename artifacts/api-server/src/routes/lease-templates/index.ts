import { Router } from "express";
import { asc, count, desc, eq, and } from "drizzle-orm";
import { db, leaseClausesMasterTable, leaseTemplatesTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { extractTemplateFromAnalysis } from "../../lib/template-extraction";
import { getAnalysis } from "../../lib/analysis-cache";
import { logger } from "../../lib/logger";

const router = Router();

// Helper: extract only placeholder KEYS from variableMap (never expose extracted values
// cross-user — they originate from another user's private lease document).
function toVariableKeys(variableMap: Record<string, string> | null | undefined): string[] {
  return Object.keys(variableMap ?? {});
}

// ─── GET /api/lease-templates ─────────────────────────────────────────────────
// List all lease templates. variableMap values are stripped; only keys are returned.
router.get("/lease-templates", requireAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id:           leaseTemplatesTable.id,
        name:         leaseTemplatesTable.name,
        jurisdiction: leaseTemplatesTable.jurisdiction,
        leaseType:    leaseTemplatesTable.leaseType,
        premisesType: leaseTemplatesTable.premisesType,
        isMaster:     leaseTemplatesTable.isMaster,
        variableMap:  leaseTemplatesTable.variableMap,
        createdAt:    leaseTemplatesTable.createdAt,
      })
      .from(leaseTemplatesTable)
      .orderBy(desc(leaseTemplatesTable.createdAt));

    const templates = rows.map(r => ({
      id:           r.id,
      name:         r.name,
      jurisdiction: r.jurisdiction,
      leaseType:    r.leaseType,
      premisesType: r.premisesType,
      isMaster:     r.isMaster,
      variableKeys: toVariableKeys(r.variableMap),
      createdAt:    r.createdAt,
    }));

    res.json({ templates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/lease-templates/:id ────────────────────────────────────────────
// Full template with templateContent and variableKeys (never raw values).
router.get("/lease-templates/:id", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const rows = await db
      .select()
      .from(leaseTemplatesTable)
      .where(eq(leaseTemplatesTable.id, id));

    if (!rows.length) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const row = rows[0];
    // Return variableKeys (placeholder names) but NOT the raw variableMap values,
    // which originate from another user's private lease document.
    const template = {
      id:              row.id,
      name:            row.name,
      jurisdiction:    row.jurisdiction,
      leaseType:       row.leaseType,
      premisesType:    row.premisesType,
      isMaster:        row.isMaster,
      templateContent: row.templateContent,
      variableKeys:    toVariableKeys(row.variableMap),
      createdAt:       row.createdAt,
    };

    res.json({ template });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/lease-templates ────────────────────────────────────────────────
// Create a new template. Supports three modes:
//
// Mode A — from analysedLeaseId (primary workflow):
//   Body: { analysedLeaseId: "<UUID returned by /lease-analysis>" }
//   Idempotent: if a template already exists for this analysisId, returns it immediately.
//   Otherwise, looks up the cached analysis data and runs template extraction synchronously.
//
// Mode B — from raw analysisData (admin/programmatic):
//   Body: { analysisData: <full lease analysis JSON>, extractedText?: string }
//
// Mode C — manual payload (admin/testing):
//   Body: { name, templateContent, variableMap?, jurisdiction?, leaseType?, premisesType?, isMaster? }
//
router.post("/lease-templates", requireAuth, async (req, res): Promise<void> => {
  const body   = req.body as Record<string, unknown>;
  const userId = req.user!.id;

  // ── Mode A: idempotent create from cached analysisId ─────────────────────
  if (body.analysedLeaseId && typeof body.analysedLeaseId === "string") {
    const analysedLeaseId = body.analysedLeaseId;

    // Return existing template if already generated for this analysis
    const existing = await db
      .select()
      .from(leaseTemplatesTable)
      .where(eq(leaseTemplatesTable.sourceAnalysisId, analysedLeaseId));

    if (existing.length) {
      const row = existing[0];
      res.json({
        template: {
          id:              row.id,
          name:            row.name,
          jurisdiction:    row.jurisdiction,
          leaseType:       row.leaseType,
          premisesType:    row.premisesType,
          isMaster:        row.isMaster,
          templateContent: row.templateContent,
          variableKeys:    toVariableKeys(row.variableMap),
          createdAt:       row.createdAt,
        },
        cached: true,
      });
      return;
    }

    // Look up analysis data from TTL cache
    const analysisData = getAnalysis(analysedLeaseId);
    if (!analysisData) {
      res.status(404).json({
        error: "Analysis data not found or expired. Please re-upload the lease document to regenerate.",
      });
      return;
    }

    // Run extraction synchronously
    try {
      const templateData = await extractTemplateFromAnalysis(analysisData);
      if (!templateData) {
        res.status(500).json({ error: "Template extraction failed — Claude returned invalid output" });
        return;
      }

      // Fail closed: require valid template_clauses to prevent exposing raw lease data cross-user
      const tplClauses = templateData.template_clauses;
      if (!Array.isArray(tplClauses) || tplClauses.length === 0) {
        res.status(500).json({ error: "Template extraction returned no clauses — refusing to store raw lease data" });
        return;
      }
      if (!tplClauses.some(c => /{{[A-Z_]+}}/.test(JSON.stringify(c)))) {
        res.status(500).json({ error: "Template clauses contain no {{PLACEHOLDER}} tokens — refusing to store" });
        return;
      }

      const jurisdiction = (analysisData.jurisdiction as string | null) ?? null;
      const leaseType    = (analysisData.leaseType    as string | null) ?? null;
      const templateName = templateData.template_name
        || `${jurisdiction ?? "AU"} ${leaseType ?? "Commercial"} Lease Template`;
      const templateContent = JSON.stringify(tplClauses);

      let isMaster = false;
      try {
        const conditions = [
          jurisdiction ? eq(leaseTemplatesTable.jurisdiction, jurisdiction) : undefined,
          leaseType    ? eq(leaseTemplatesTable.leaseType,    leaseType)    : undefined,
        ].filter(Boolean) as ReturnType<typeof eq>[];
        const cnt = await db
          .select({ n: count() })
          .from(leaseTemplatesTable)
          .where(conditions.length > 1 ? and(...conditions) : conditions[0]);
        isMaster = Number(cnt[0]?.n ?? 0) === 0;
      } catch { /* fall back to false */ }

      const rows = await db
        .insert(leaseTemplatesTable)
        .values({
          name:             templateName,
          jurisdiction,
          leaseType,
          templateContent,
          variableMap:      templateData.variable_map ?? {},
          isMaster,
          sourceAnalysisId: analysedLeaseId,
          createdByUserId:  userId,
        })
        .returning();

      const row = rows[0];
      res.status(201).json({
        template: {
          id:              row.id,
          name:            row.name,
          jurisdiction:    row.jurisdiction,
          leaseType:       row.leaseType,
          premisesType:    row.premisesType,
          isMaster:        row.isMaster,
          templateContent: row.templateContent,
          variableKeys:    toVariableKeys(row.variableMap),
          createdAt:       row.createdAt,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction error";
      res.status(500).json({ error: msg });
    }
    return;
  }

  // ── Mode B: create from raw analysisData ──────────────────────────────────
  if (body.analysisData && typeof body.analysisData === "object") {
    const analysisResult = body.analysisData as Record<string, unknown>;
    const extractedText  = typeof body.extractedText === "string" ? body.extractedText : undefined;

    try {
      const templateData = await extractTemplateFromAnalysis(analysisResult, extractedText);
      if (!templateData) {
        res.status(500).json({ error: "Template extraction failed — Claude returned invalid output" });
        return;
      }

      // Fail closed: require valid template_clauses to prevent exposing raw lease data cross-user
      const tplClauses2 = templateData.template_clauses;
      if (!Array.isArray(tplClauses2) || tplClauses2.length === 0) {
        res.status(500).json({ error: "Template extraction returned no clauses — refusing to store raw lease data" });
        return;
      }
      if (!tplClauses2.some(c => /{{[A-Z_]+}}/.test(JSON.stringify(c)))) {
        res.status(500).json({ error: "Template clauses contain no {{PLACEHOLDER}} tokens — refusing to store" });
        return;
      }

      const jurisdiction = (analysisResult.jurisdiction as string | null) ?? null;
      const leaseType    = (analysisResult.leaseType    as string | null) ?? null;
      const templateName = templateData.template_name
        || `${jurisdiction ?? "AU"} ${leaseType ?? "Commercial"} Lease Template`;
      const templateContent = JSON.stringify(tplClauses2);

      let isMaster = false;
      try {
        const conditions = [
          jurisdiction ? eq(leaseTemplatesTable.jurisdiction, jurisdiction) : undefined,
          leaseType    ? eq(leaseTemplatesTable.leaseType,    leaseType)    : undefined,
        ].filter(Boolean) as ReturnType<typeof eq>[];
        const cnt = await db
          .select({ n: count() })
          .from(leaseTemplatesTable)
          .where(conditions.length > 1 ? and(...conditions) : conditions[0]);
        isMaster = Number(cnt[0]?.n ?? 0) === 0;
      } catch { /* fall back to false */ }

      const rawClauses = (analysisResult.clauses ?? []) as Array<Record<string, unknown>>;
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
              suggestedText:      clause.suggestedText as string | undefined,
              jurisdiction,
              cafeRelevanceScore: (clause.cafeRelevanceScore as number) || 3,
              negotiationScore:   (clause.negotiationScore as number) || 3,
              isSeed:             false,
            })
            .onConflictDoNothing();
        } catch (e) {
          logger.warn({ err: e, title }, "POST Mode B: failed to upsert master clause");
        }
      }

      const rows = await db
        .insert(leaseTemplatesTable)
        .values({
          name:            templateName,
          jurisdiction,
          leaseType,
          templateContent,
          variableMap:     templateData.variable_map ?? {},
          isMaster,
          createdByUserId: userId,
        })
        .returning();

      const row = rows[0];
      res.status(201).json({
        template: {
          id:              row.id,
          name:            row.name,
          jurisdiction:    row.jurisdiction,
          leaseType:       row.leaseType,
          premisesType:    row.premisesType,
          isMaster:        row.isMaster,
          templateContent: row.templateContent,
          variableKeys:    toVariableKeys(row.variableMap),
          createdAt:       row.createdAt,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction error";
      res.status(500).json({ error: msg });
    }
    return;
  }

  // ── Mode C: manual payload ─────────────────────────────────────────────────
  const { name, jurisdiction, leaseType, premisesType, templateContent, variableMap, isMaster } = body;

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Provide analysedLeaseId, analysisData, or name + templateContent" });
    return;
  }
  if (!templateContent || typeof templateContent !== "string") {
    res.status(400).json({ error: "templateContent is required for manual template creation" });
    return;
  }

  try {
    const rows = await db
      .insert(leaseTemplatesTable)
      .values({
        name,
        jurisdiction: (jurisdiction as string | null) ?? null,
        leaseType:    (leaseType    as string | null) ?? null,
        premisesType: (premisesType as string | null) ?? null,
        templateContent,
        variableMap:  (variableMap  as Record<string, string>) ?? {},
        isMaster:     isMaster === true,
        createdByUserId: userId,
      })
      .returning();

    const row = rows[0];
    res.status(201).json({
      template: {
        id:              row.id,
        name:            row.name,
        jurisdiction:    row.jurisdiction,
        leaseType:       row.leaseType,
        premisesType:    row.premisesType,
        isMaster:        row.isMaster,
        templateContent: row.templateContent,
        variableKeys:    toVariableKeys(row.variableMap),
        createdAt:       row.createdAt,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/lease-clauses ───────────────────────────────────────────────────
// Public shared clause library — no auth required.
router.get("/lease-clauses", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(leaseClausesMasterTable)
      .orderBy(asc(leaseClausesMasterTable.category), asc(leaseClausesMasterTable.title));

    res.json({ clauses: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    res.status(500).json({ error: msg });
  }
});

export default router;
