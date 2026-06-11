import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db, leaseTemplatesTable, leaseClausesMasterTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";

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
// Create a new template manually.
// Body: { name, jurisdiction?, leaseType?, premisesType?, templateContent, variableMap?, isMaster? }
router.post("/lease-templates", requireAuth, async (req, res): Promise<void> => {
  const {
    name,
    jurisdiction,
    leaseType,
    premisesType,
    templateContent,
    variableMap,
    isMaster,
  } = req.body as Record<string, unknown>;

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!templateContent || typeof templateContent !== "string") {
    res.status(400).json({ error: "templateContent is required" });
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
        createdByUserId: req.user!.id,
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
