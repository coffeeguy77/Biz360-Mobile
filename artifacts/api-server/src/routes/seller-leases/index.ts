import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, sellerLeasesTable, sellerLeaseClausesTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

// GET /api/seller/leases — all leases + clauses for the authenticated user
router.get("/seller/leases", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  try {
    const [leaseRows, clauseRows] = await Promise.all([
      db.select().from(sellerLeasesTable).where(eq(sellerLeasesTable.userId, userId)),
      db.select().from(sellerLeaseClausesTable).where(eq(sellerLeaseClausesTable.userId, userId)),
    ]);
    res.json({
      leases:  leaseRows.map(r => r.data),
      clauses: clauseRows.map(r => r.data),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load leases" });
  }
});

// POST /api/seller/leases — upsert a single lease (idempotent by id)
router.post("/seller/leases", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { lease } = req.body as { lease: { id: string } };
  if (!lease?.id) {
    res.status(400).json({ error: "lease.id required" });
    return;
  }
  try {
    await db
      .insert(sellerLeasesTable)
      .values({ id: lease.id, userId, data: lease })
      .onConflictDoUpdate({
        target: sellerLeasesTable.id,
        set:    { data: sql`excluded.data` },
      });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save lease" });
  }
});

// DELETE /api/seller/leases/:id — delete lease (clauses cascade via FK)
router.delete("/seller/leases/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { id }  = req.params;
  try {
    await db
      .delete(sellerLeasesTable)
      .where(and(eq(sellerLeasesTable.id, id), eq(sellerLeasesTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete lease" });
  }
});

// POST /api/seller/leases/:id/clauses — bulk upsert clauses for a lease
router.post("/seller/leases/:id/clauses", requireAuth, async (req, res): Promise<void> => {
  const userId        = req.user!.id;
  const { id: leaseId } = req.params;
  const { clauses }   = req.body as { clauses: { id: string }[] };
  if (!Array.isArray(clauses) || clauses.length === 0) {
    res.json({ ok: true });
    return;
  }
  try {
    await db
      .insert(sellerLeaseClausesTable)
      .values(clauses.map(c => ({ id: c.id, userId, leaseId, data: c })))
      .onConflictDoUpdate({
        target: sellerLeaseClausesTable.id,
        set:    { data: sql`excluded.data` },
      });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save clauses" });
  }
});

export default router;
