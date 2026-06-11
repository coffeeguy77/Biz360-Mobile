import { Router } from "express";
import { asc, count, desc, eq, and } from "drizzle-orm";
import { db, leaseClausesMasterTable, leaseTemplatesTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { extractTemplateFromAnalysis } from "../../lib/template-extraction";
import { logger } from "../../lib/logger";

const router = Router();

// ─── GET /api/lease-templates ─────────────────────────────────────────────────
// List all lease templates (summary only — no full templateContent).
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

    res.json({ templates: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/lease-templates/:id ────────────────────────────────────────────
// Full template with templateContent (JSON clause array) and variableMap.
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

    res.json({ template: rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/lease-templates ────────────────────────────────────────────────
// Create a new template. Supports two modes:
//
// Mode A — from analysisData (required workflow):
//   Body: { analysisData: <full lease analysis JSON>, extractedText?: string }
//   The server runs template extraction via Claude (same as background task), upserts to
//   lease_clauses_master, and creates + returns a new lease_templates row.
//   isMaster is set if no template yet exists for the same jurisdiction+leaseType.
//
// Mode B — manual payload (admin/testing):
//   Body: { name, templateContent, variableMap?, jurisdiction?, leaseType?, premisesType?, isMaster? }
//
router.post("/lease-templates", requireAuth, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const userId = req.user!.id;

  // ── Mode A: create from analysisData ──────────────────────────────────────
  if (body.analysisData && typeof body.analysisData === "object") {
    const analysisResult = body.analysisData as Record<string, unknown>;
    const extractedText  = typeof body.extractedText === "string" ? body.extractedText : undefined;

    try {
      // Run template extraction synchronously so we can return the result immediately
      const templateData = await extractTemplateFromAnalysis(analysisResult, extractedText);
      if (!templateData) {
        res.status(500).json({ error: "Template extraction failed — Claude returned invalid output" });
        return;
      }

      const jurisdiction = (analysisResult.jurisdiction as string | null) ?? null;
      const leaseType    = (analysisResult.leaseType    as string | null) ?? null;

      const templateName = templateData.template_name
        || `${jurisdiction ?? "AU"} ${leaseType ?? "Commercial"} Lease Template`;

      const templateContent = JSON.stringify(templateData.template_clauses ?? []);

      // Determine isMaster: first template for this jurisdiction+leaseType combination
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

      // Upsert clauses into shared library
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
          logger.warn({ err: e, title }, "POST: failed to upsert master clause");
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

      res.status(201).json({ template: rows[0] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction error";
      res.status(500).json({ error: msg });
    }
    return;
  }

  // ── Mode B: manual payload ─────────────────────────────────────────────────
  const { name, jurisdiction, leaseType, premisesType, templateContent, variableMap, isMaster } = body;

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!templateContent || typeof templateContent !== "string") {
    res.status(400).json({ error: "templateContent is required (or provide analysisData for automatic extraction)" });
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

    res.status(201).json({ template: rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/lease-clauses ───────────────────────────────────────────────────
// Public shared clause library — no auth required.
// Returns all master clauses alphabetically by category then title.
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
