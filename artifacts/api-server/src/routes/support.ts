import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, kvStore } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";
import { KB } from "../support/knowledge";

const router: IRouter = Router();
const REQUESTS_KEY = "support_requests_v1";

// ─── AI help assistant ───────────────────────────────────────────────────────
router.post("/support/chat", async (req, res) => {
  const { messages } = req.body as { messages?: { role: string; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "messages required" });
  // Sanitise: keep last 16 turns, valid roles, cap content length.
  const clean = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-16)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }));
  if (clean.length === 0 || clean[clean.length - 1].role !== "user") return res.status(400).json({ error: "last message must be from the user" });
  try {
    const msg: any = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 900,
      system: KB,
      messages: clean,
    });
    const reply = msg.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim() || "Sorry, I couldn't generate a reply. You can reach our team at /help#contact.";
    return res.json({ reply });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Support chat failed");
    return res.status(500).json({ error: "The assistant is unavailable right now. Please try again, or contact our team at /help#contact." });
  }
});

// ─── Contact / support request ───────────────────────────────────────────────
router.post("/support/contact", async (req, res) => {
  const { name, email, message, topic, path } = req.body as { name?: string; email?: string; message?: string; topic?: string; path?: string };
  if (!message || message.trim().length < 5) return res.status(400).json({ error: "Please add a short message." });
  const entry = {
    id: `sr-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    name: (name ?? "").slice(0, 120),
    email: (email ?? "").slice(0, 160),
    topic: (topic ?? "General").slice(0, 80),
    message: message.slice(0, 4000),
    path: (path ?? "").slice(0, 200),
    createdAt: Date.now(),
    resolved: false,
  };
  try {
    const [row] = await db.select().from(kvStore).where(eq(kvStore.key, REQUESTS_KEY));
    const list = Array.isArray(row?.value) ? (row!.value as any[]) : [];
    list.unshift(entry);
    await db.insert(kvStore).values({ key: REQUESTS_KEY, value: list.slice(0, 1000) })
      .onConflictDoUpdate({ target: kvStore.key, set: { value: list.slice(0, 1000) } });
    return res.json({ ok: true });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Support contact save failed");
    return res.status(500).json({ error: "Couldn't send your message. Please try again." });
  }
});

export default router;
