import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, sql, gte, desc, count } from "drizzle-orm";
import { db, kvStore, reportViewEventsTable } from "@workspace/db";
import { verifyToken } from "../middlewares/auth";
import { getSiteSettings, saveSiteSettings, extractGscToken, type SiteSettings } from "../seo/site-settings";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const LISTINGS_KEY = "biz360_admin_pending_v2";
const ADMINS_KEY = "site_admins_v1";
const SELLER_PROFILE_PREFIX = "biz360_seller_profile_v1_";

// First super-admin, seeded so the panel is reachable before any DB roles exist.
// Overridable via env (comma-separated phones). 0414631463 → national 9 digits.
const BOOTSTRAP = (process.env.ADMIN_BOOTSTRAP ?? "0414631463")
  .split(",").map((p) => canonicalPhone(p)).filter(Boolean);

/** Normalise any id/phone (u-…, +61…, 0…) to the AU national 9-digit form. */
export function canonicalPhone(id?: string | null): string {
  return String(id ?? "").replace(/\D/g, "").slice(-9);
}

type Role = "superadmin" | "admin";
interface AdminRec { role: Role; label?: string; addedBy?: string; addedAt?: number; }
type AdminMap = Record<string, AdminRec>;

async function getAdminMap(): Promise<AdminMap> {
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, ADMINS_KEY));
    const v = rows[0]?.value;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as AdminMap) : {};
  } catch { return {}; }
}
async function saveAdminMap(map: AdminMap): Promise<void> {
  await db.insert(kvStore).values({ key: ADMINS_KEY, value: map })
    .onConflictDoUpdate({ target: kvStore.key, set: { value: map } });
}

export async function roleOf(userId?: string | null): Promise<Role | null> {
  const c = canonicalPhone(userId);
  if (!c) return null;
  if (BOOTSTRAP.includes(c)) return "superadmin";
  const map = await getAdminMap();
  return map[c]?.role ?? null;
}

async function callerId(req: Request): Promise<string | null> {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  return bearer ? await verifyToken(bearer).catch(() => null) : null;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = await callerId(req);
  const role = await roleOf(id);
  if (!role) { res.status(403).json({ error: "Admin access required" }); return; }
  (req as any).adminRole = role;
  (req as any).adminId = id;
  next();
}
async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = await callerId(req);
  const role = await roleOf(id);
  if (role !== "superadmin") { res.status(403).json({ error: "Super-admin access required" }); return; }
  (req as any).adminId = id;
  next();
}

// ─── Who am I (used by the web to show/hide "Manage site") ───────────────────
router.get("/admin/me", async (req, res) => {
  const id = await callerId(req);
  const role = await roleOf(id);
  res.json({ isAdmin: !!role, isSuperAdmin: role === "superadmin", role: role ?? null });
});

// ─── Listings moderation ─────────────────────────────────────────────────────
async function loadListings(): Promise<any[]> {
  const rows = await db.select().from(kvStore).where(eq(kvStore.key, LISTINGS_KEY));
  return Array.isArray(rows[0]?.value) ? (rows[0]!.value as any[]) : [];
}
async function saveListings(list: any[]): Promise<void> {
  await db.insert(kvStore).values({ key: LISTINGS_KEY, value: list })
    .onConflictDoUpdate({ target: kvStore.key, set: { value: list } });
}

router.get("/admin/listings", requireAdmin, async (_req, res) => {
  const all = await loadListings();
  const listings = all.map((l) => ({
    listingId: l.listingId,
    businessName: l.businessName ?? "Business",
    category: l.category ?? "",
    state: l.state ?? "",
    suburb: l.suburb ?? "",
    status: l.status ?? "pending",
    suspended: !!l.suspended,
    seoIndexable: l.seoIndexable !== false,
    confidential: !!l.confidential,
    submittedBy: l.submittedBy ?? null,
    submittedByName: l.submittedByName ?? null,
    submittedAt: l.submittedAt ?? null,
    askingPrice: Number(l.askingPrice ?? 0),
    rejectionReason: l.rejectionReason ?? null,
  }));
  // Pending first, then newest
  listings.sort((a, b) => {
    const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
    return rank(a.status) - rank(b.status) || (b.submittedAt ?? 0) - (a.submittedAt ?? 0);
  });
  res.json({ listings });
});

router.post("/admin/listings/:listingId/moderate", requireAdmin, async (req, res) => {
  const { listingId } = req.params;
  const { action, value, reason } = req.body as { action: string; value?: boolean; reason?: string };
  const all = await loadListings();
  const idx = all.findIndex((l) => l?.listingId === listingId);
  if (idx < 0) { res.status(404).json({ error: "Listing not found" }); return; }
  const l = all[idx];
  switch (action) {
    case "approve": l.status = "approved"; l.suspended = false; l.rejectionReason = null; l.approvedAt = Date.now(); break;
    case "reject": l.status = "rejected"; l.rejectionReason = (reason ?? "").slice(0, 500) || "Not approved"; break;
    case "pending": l.status = "pending"; break;
    case "suspend": l.suspended = true; break;
    case "unsuspend": l.suspended = false; break;
    case "setIndexable": l.seoIndexable = value !== false; break;
    default: res.status(400).json({ error: "Unknown action" }); return;
  }
  all[idx] = l;
  await saveListings(all);
  res.json({ ok: true, listing: { listingId: l.listingId, status: l.status, suspended: !!l.suspended, seoIndexable: l.seoIndexable !== false, rejectionReason: l.rejectionReason ?? null } });
});

// ─── Users & roles ───────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (_req, res) => {
  const [listings, adminMap] = await Promise.all([loadListings(), getAdminMap()]);
  // Aggregate known users from listing submitters
  const byPhone: Record<string, { userId: string; name: string | null; listings: number }> = {};
  for (const l of listings) {
    const c = canonicalPhone(l.submittedBy);
    if (!c) continue;
    if (!byPhone[c]) byPhone[c] = { userId: l.submittedBy, name: l.submittedByName ?? null, listings: 0 };
    byPhone[c].listings += 1;
    if (!byPhone[c].name && l.submittedByName) byPhone[c].name = l.submittedByName;
  }
  // Ensure admins appear even with no listings
  for (const [c, rec] of Object.entries(adminMap)) {
    if (!byPhone[c]) byPhone[c] = { userId: c, name: rec.label ?? null, listings: 0 };
  }
  for (const c of BOOTSTRAP) if (!byPhone[c]) byPhone[c] = { userId: c, name: "Owner", listings: 0 };

  const users = Object.entries(byPhone).map(([c, u]) => ({
    phone: c,
    userId: u.userId,
    name: u.name,
    listings: u.listings,
    role: BOOTSTRAP.includes(c) ? "superadmin" : (adminMap[c]?.role ?? null),
    isBootstrap: BOOTSTRAP.includes(c),
  })).sort((a, b) => (b.role ? 1 : 0) - (a.role ? 1 : 0) || (b.listings - a.listings));
  res.json({ users });
});

router.post("/admin/users/role", requireSuperAdmin, async (req, res) => {
  const { phone, role } = req.body as { phone?: string; role?: string };
  const c = canonicalPhone(phone);
  if (!c) { res.status(400).json({ error: "phone required" }); return; }
  if (BOOTSTRAP.includes(c)) { res.status(400).json({ error: "The owner account can't be changed here." }); return; }
  const map = await getAdminMap();
  if (role === "admin" || role === "superadmin") {
    map[c] = { role, addedBy: (req as any).adminId ?? null, addedAt: Date.now(), label: map[c]?.label };
  } else if (role === "none" || !role) {
    delete map[c];
  } else { res.status(400).json({ error: "Invalid role" }); return; }
  await saveAdminMap(map);
  res.json({ ok: true, phone: c, role: role === "none" ? null : role });
});

// ─── Dashboard analytics ─────────────────────────────────────────────────────
router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  const listings = await loadListings();
  const counts = {
    listings: listings.length,
    pending: listings.filter((l) => (l.status ?? "pending") === "pending").length,
    approved: listings.filter((l) => l.status === "approved").length,
    rejected: listings.filter((l) => l.status === "rejected").length,
    suspended: listings.filter((l) => l.suspended).length,
  };

  // Per-listing view blobs: biz360_analytics_v1_<listingId>
  const viewByListing: Record<string, number> = {};
  let totalViews = 0;
  try {
    const rows = await db.select().from(kvStore).where(sql`${kvStore.key} LIKE 'biz360_analytics_v1_%'`);
    for (const r of rows) {
      const lid = String(r.key).replace("biz360_analytics_v1_", "");
      const v = Number((r.value as any)?.views ?? 0) || 0;
      viewByListing[lid] = v; totalViews += v;
    }
  } catch { /* ignore */ }

  const topListings = listings
    .filter((l) => l.listingId)
    .map((l) => ({ listingId: l.listingId, businessName: l.businessName ?? "Business", status: l.status ?? "pending", views: viewByListing[l.listingId] ?? 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  // 30-day report-open time series + recent activity
  const since = new Date(Date.now() - 30 * 86400000);
  let series: { date: string; opens: number }[] = [];
  let totalOpens = 0;
  let recent: { listingId: string; businessName: string; viewerPhone: string | null; openedAt: string }[] = [];
  try {
    const rows = await db.select({ day: sql<string>`to_char(${reportViewEventsTable.openedAt}, 'YYYY-MM-DD')`, n: count() })
      .from(reportViewEventsTable).where(gte(reportViewEventsTable.openedAt, since))
      .groupBy(sql`to_char(${reportViewEventsTable.openedAt}, 'YYYY-MM-DD')`).orderBy(sql`to_char(${reportViewEventsTable.openedAt}, 'YYYY-MM-DD')`);
    const map: Record<string, number> = {};
    for (const r of rows) { map[r.day] = Number(r.n) || 0; totalOpens += Number(r.n) || 0; }
    // Fill every day so the chart is continuous
    for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); series.push({ date: d, opens: map[d] ?? 0 }); }
    const nameById: Record<string, string> = {};
    for (const l of listings) if (l.listingId) nameById[l.listingId] = l.businessName ?? "Business";
    const ev = await db.select().from(reportViewEventsTable).orderBy(desc(reportViewEventsTable.openedAt)).limit(12);
    recent = ev.map((e) => ({ listingId: e.listingId, businessName: nameById[e.listingId] ?? e.listingId, viewerPhone: e.viewerPhone ? `···${String(e.viewerPhone).slice(-3)}` : null, openedAt: e.openedAt ? new Date(e.openedAt).toISOString() : "" }));
  } catch { /* ignore */ }

  // Users
  let userCount = 0;
  try {
    const seen = new Set<string>();
    for (const l of listings) { const c = canonicalPhone(l.submittedBy); if (c) seen.add(c); }
    userCount = seen.size;
  } catch { /* ignore */ }

  res.json({ counts: { ...counts, users: userCount }, totalViews, totalOpens, topListings, series, recent });
});

// ─── AI SEO assistant ────────────────────────────────────────────────────────
router.post("/admin/seo/ai-suggest", requireAdmin, async (req, res) => {
  const { path, label, currentTitle, copy } = req.body as { path?: string; label?: string; currentTitle?: string; copy?: Record<string, string> };
  const context = Object.entries(copy ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n").slice(0, 4000);
  const system = `You are a senior technical SEO strategist optimising an Australian 360°-virtual-tour business-for-sale marketplace called EXIT360 (exit360.com.au). Produce best-practice, high-CTR, non-spammy on-page SEO for the given page. Return ONLY a valid JSON object, no markdown, matching exactly:
{
  "title": "<50-60 char SEO title, primary keyword front-loaded, brand suffix optional>",
  "description": "<140-160 char meta description, active voice, includes a call to action and primary keyword>",
  "keywords": ["<8-12 relevant, high-intent keywords/phrases, Australian English>"],
  "h1": "<a strong, unique H1 for the page>",
  "ogImageAlt": "<descriptive, keyword-aware alt text for the share image>",
  "notes": "<one short sentence on the ranking angle>"
}
Australian English spelling. Do not keyword-stuff. Titles must read naturally.`;
  const user = `Page path: ${path}\nPage name: ${label ?? path}\nCurrent title: ${currentTitle ?? "(none)"}\nPage content:\n${context || "(no content provided)"}`;
  try {
    const msg: any = await anthropic.messages.create({
      model: "claude-haiku-4-5", max_tokens: 1024, system,
      messages: [{ role: "user", content: user }],
    });
    const raw = msg.content?.[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch { return res.status(502).json({ error: "AI returned invalid JSON" }); }
    return res.json({ suggestion: parsed });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "AI SEO suggest failed");
    return res.status(500).json({ error: err?.message || "AI request failed" });
  }
});

// ─── Support inbox ───────────────────────────────────────────────────────────
const SUPPORT_KEY = "support_requests_v1";
router.get("/admin/support", requireAdmin, async (_req, res) => {
  const [row] = await db.select().from(kvStore).where(eq(kvStore.key, SUPPORT_KEY));
  const list = Array.isArray(row?.value) ? (row!.value as any[]) : [];
  res.json({ requests: list });
});
router.post("/admin/support/:id/resolve", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { resolved = true } = req.body as { resolved?: boolean };
  const [row] = await db.select().from(kvStore).where(eq(kvStore.key, SUPPORT_KEY));
  const list = Array.isArray(row?.value) ? (row!.value as any[]) : [];
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  list[idx].resolved = !!resolved;
  await db.insert(kvStore).values({ key: SUPPORT_KEY, value: list }).onConflictDoUpdate({ target: kvStore.key, set: { value: list } });
  res.json({ ok: true });
});

// ─── Site SEO settings ───────────────────────────────────────────────────────
router.get("/admin/seo", requireAdmin, async (_req, res) => {
  res.json(await getSiteSettings(true));
});
router.put("/admin/seo", requireAdmin, async (req, res) => {
  const body = req.body as Partial<SiteSettings>;
  // Accept the whole <meta> tag or just the token — store only the token.
  const gsc = body.gsc ? { ...body.gsc, metaToken: extractGscToken(body.gsc.metaToken) } : undefined;
  const saved = await saveSiteSettings({
    gsc,
    defaults: body.defaults,
    pages: body.pages,
    menus: (body as any).menus,
    mesh: (body as any).mesh,
  });
  res.json(saved);
});

export default router;
