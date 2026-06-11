import { Router } from "express";
import { and, eq } from "drizzle-orm";
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
  } catch {
    res.status(500).json({ error: "Failed to load leases" });
  }
});

// GET /api/seller/leases/:id/clauses — clauses for a specific lease
router.get("/seller/leases/:id/clauses", requireAuth, async (req, res): Promise<void> => {
  const userId        = req.user!.id;
  const { id: leaseId } = req.params;
  try {
    const rows = await db
      .select()
      .from(sellerLeaseClausesTable)
      .where(
        and(
          eq(sellerLeaseClausesTable.leaseId, leaseId),
          eq(sellerLeaseClausesTable.userId, userId),
        ),
      );
    res.json({ clauses: rows.map(r => r.data) });
  } catch {
    res.status(500).json({ error: "Failed to load clauses" });
  }
});

// POST /api/seller/leases — ownership-safe upsert of a single lease
// Pattern: INSERT … ON CONFLICT DO NOTHING, then UPDATE WHERE userId matches.
// This prevents a malicious actor from overwriting another user's row by submitting
// a known lease id — the UPDATE only fires when the row is owned by the caller.
router.post("/seller/leases", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { lease } = req.body as { lease: { id: string } };
  if (!lease?.id) {
    res.status(400).json({ error: "lease.id required" });
    return;
  }
  try {
    const inserted = await db
      .insert(sellerLeasesTable)
      .values({ id: lease.id, userId, data: lease })
      .onConflictDoNothing()
      .returning({ id: sellerLeasesTable.id });

    if (!inserted.length) {
      // Row already exists — only update if this user owns it
      await db
        .update(sellerLeasesTable)
        .set({ data: lease })
        .where(and(eq(sellerLeasesTable.id, lease.id), eq(sellerLeasesTable.userId, userId)));
    }
    res.json({ ok: true });
  } catch {
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
  } catch {
    res.status(500).json({ error: "Failed to delete lease" });
  }
});

// POST /api/seller/leases/:id/clauses — ownership-safe bulk upsert of clauses
router.post("/seller/leases/:id/clauses", requireAuth, async (req, res): Promise<void> => {
  const userId          = req.user!.id;
  const { id: leaseId } = req.params;
  const { clauses }     = req.body as { clauses: { id: string }[] };
  if (!Array.isArray(clauses) || clauses.length === 0) {
    res.json({ ok: true });
    return;
  }
  try {
    // Verify the caller owns the parent lease before writing any clauses
    const lease = await db
      .select({ id: sellerLeasesTable.id })
      .from(sellerLeasesTable)
      .where(and(eq(sellerLeasesTable.id, leaseId), eq(sellerLeasesTable.userId, userId)))
      .limit(1);

    if (!lease.length) {
      // Either the lease doesn't exist yet or it belongs to someone else — skip silently
      res.json({ ok: true });
      return;
    }

    // Ownership-safe upsert for each clause
    for (const c of clauses) {
      const inserted = await db
        .insert(sellerLeaseClausesTable)
        .values({ id: c.id, userId, leaseId, data: c })
        .onConflictDoNothing()
        .returning({ id: sellerLeaseClausesTable.id });

      if (!inserted.length) {
        await db
          .update(sellerLeaseClausesTable)
          .set({ data: c })
          .where(
            and(
              eq(sellerLeaseClausesTable.id, c.id),
              eq(sellerLeaseClausesTable.userId, userId),
            ),
          );
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save clauses" });
  }
});

export default router;
