import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, kvStore } from "@workspace/db";
import { verifyToken } from "../middlewares/auth";
import { getSiteSettings, saveSiteSettings, extractGscToken, type SiteSettings } from "../seo/site-settings";

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
  });
  res.json(saved);
});

export default router;
