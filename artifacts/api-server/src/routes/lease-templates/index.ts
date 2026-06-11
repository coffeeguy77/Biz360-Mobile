import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db, leaseTemplatesTable, leaseClausesMasterTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

// ─── GET /api/lease-templates ─────────────────────────────────────────────────
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
