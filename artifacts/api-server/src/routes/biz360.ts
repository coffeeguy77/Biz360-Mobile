import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, kvStore } from "@workspace/db";

const router = Router();

router.get("/biz360/kv/:key", async (req, res): Promise<void> => {
  const { key } = req.params;
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, key));
    res.json({ value: rows[0]?.value ?? null });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.put("/biz360/kv/:key", async (req, res): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body as { value: unknown };
  if (value === undefined) {
    res.status(400).json({ error: "Missing value" });
    return;
  }
  try {
    await db
      .insert(kvStore)
      .values({ key, value })
      .onConflictDoUpdate({
        target: kvStore.key,
        set: { value, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
