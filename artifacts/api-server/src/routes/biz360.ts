import { Router } from "express";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import {
  db, kvStore, cafesTable, valuationSnapshotsTable, cafeEquipmentTable,
  reportAccessSettingsTable, reportAccessGrantsTable, reportViewEventsTable,
  ndaSettingsTable, ndaSignaturesTable, buyersTable, businessUnitsTable,
  reportAccessLogsTable,
} from "@workspace/db";
import { sendEmail, emailShell, isValidEmail, PUBLIC_WEB_URL } from "../lib/email";
import twilio from "twilio";
import { v2 as cloudinary } from "cloudinary";
import {
  signReportAccessToken, verifyReportAccessToken, checkPwd,
} from "./valuation/report-access";
import { verifyToken } from "../middlewares/auth";

cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
  secure:      true,
});

const router = Router();

// ─── Test sign-in bypass ──────────────────────────────────────────────────────
// These AU mobile numbers skip real SMS OTP for QA/testing: no SMS is sent, and
// any code is accepted at the verify step. Matched on the trailing 9 digits so
// any format works (0414 631 463, +61414631463, 61414631463, …).
const TEST_OTP_NUMBERS = ["414631463"];
export function isTestOtpPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return TEST_OTP_NUMBERS.some((n) => digits.endsWith(n));
}

// ─── NDA token helpers ────────────────────────────────────────────────────────

function getNdaSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(s);
}

async function signNdaToken(listingId: string, phone: string): Promise<string> {
  return new SignJWT({ listingId, phone, type: "nda-signed" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getNdaSecret());
}

async function verifyNdaToken(token: string, listingId: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getNdaSecret());
    return (payload as any).listingId === listingId && (payload as any).type === "nda-signed";
  } catch {
    return false;
  }
}

// ─── KV store ─────────────────────────────────────────────────────────────────

const THREADS_KEY = "biz360_threads_v3";

/** Stable identity for a message, so we can union without duplicates. */
function msgKey(m: any): string {
  return String(m?.id ?? `${m?.from ?? ""}|${m?.timestamp ?? ""}|${m?.text ?? ""}`);
}
/**
 * Merge two message-thread maps WITHOUT ever losing threads or messages. Used
 * whenever a client writes the whole threads object, so a stale or empty write
 * can never wipe history (root cause of two prior message-loss incidents):
 *  - every thread present in EITHER side is kept
 *  - each thread's messages = union by id (never shrinks)
 *  - metadata (name/updatedAt/unread) takes the incoming value when provided
 */
function mergeThreads(existing: Record<string, any>, incoming: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...(existing || {}) };
  for (const [tid, inc] of Object.entries(incoming || {})) {
    const cur = out[tid];
    if (!cur) { out[tid] = inc; continue; }
    const byKey = new Map<string, any>();
    for (const m of (cur.messages ?? [])) byKey.set(msgKey(m), m);
    for (const m of ((inc as any).messages ?? [])) if (!byKey.has(msgKey(m))) byKey.set(msgKey(m), m);
    const messages = [...byKey.values()].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    out[tid] = {
      ...cur, ...(inc as any),
      messages,
      updatedAt: Math.max(cur.updatedAt ?? 0, (inc as any).updatedAt ?? 0),
    };
  }
  return out;
}

router.get("/biz360/kv/:key", async (req, res): Promise<void> => {
  const { key } = req.params;
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, key));
    res.json({ value: rows[0]?.value ?? null });
  } catch {
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
    let toWrite: unknown = value;
    // Message threads are append-only: merge with what's already stored so a
    // stale/empty write from any client (app, web, portal) can't delete history.
    if (key === THREADS_KEY && value && typeof value === "object" && !Array.isArray(value)) {
      const [cur] = await db.select().from(kvStore).where(eq(kvStore.key, key));
      const existing = (cur?.value && typeof cur.value === "object" && !Array.isArray(cur.value)) ? (cur.value as Record<string, any>) : {};
      toWrite = mergeThreads(existing, value as Record<string, any>);
    }
    await db
      .insert(kvStore)
      .values({ key, value: toWrite })
      .onConflictDoUpdate({
        target: kvStore.key,
        set: { value: toWrite, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// ─── Messaging: atomic, append-only (never rewrites the whole store) ──────────

/** Append one message to a thread. Creates the thread if needed. Atomic jsonb
 *  operations so concurrent sends from app/web/portal can't clobber each other. */
router.post("/biz360/threads/append", async (req, res): Promise<void> => {
  const b = req.body as { threadId?: string; listingId?: string; listingName?: string; buyerId?: string; buyerName?: string; sellerName?: string; from?: string; text?: string };
  const from = b.from === "seller" ? "seller" : "buyer";
  if (!b.threadId || !b.text || !b.listingId) { res.status(400).json({ error: "threadId, listingId and text are required" }); return; }
  const threadId = b.threadId;
  const msg = { id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, from, text: String(b.text).slice(0, 5000), timestamp: Date.now() };
  const newThread = {
    id: threadId, listingId: b.listingId, listingName: b.listingName ?? "", buyerId: b.buyerId ?? "",
    buyerName: b.buyerName ?? "", sellerName: b.sellerName ?? "Seller",
    messages: [msg], updatedAt: msg.timestamp, unreadSeller: 0, unreadBuyer: 0,
  };
  const unreadField = from === "buyer" ? "unreadSeller" : "unreadBuyer";
  try {
    // Ensure the row exists, then append (or create the thread) atomically.
    await db.execute(sql`
      INSERT INTO kv_store (key, value) VALUES (${THREADS_KEY}, ${JSON.stringify({ [threadId]: newThread })}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = CASE
        WHEN jsonb_exists(kv_store.value, ${threadId})
          THEN jsonb_set(
                 jsonb_set(kv_store.value, ARRAY[${threadId}, 'messages'],
                   COALESCE(kv_store.value->${threadId}->'messages', '[]'::jsonb) || ${JSON.stringify([msg])}::jsonb),
                 ARRAY[${threadId}, 'updatedAt'], ${String(msg.timestamp)}::jsonb)
          ELSE jsonb_set(COALESCE(kv_store.value, '{}'::jsonb), ARRAY[${threadId}], ${JSON.stringify(newThread)}::jsonb)
        END,
        updated_at = now()`);
    // Bump the recipient's unread counter atomically.
    await db.execute(sql`
      UPDATE kv_store SET value = jsonb_set(value, ARRAY[${threadId}, ${unreadField}],
        ((COALESCE((value->${threadId}->>${unreadField})::int, 0) + 1))::text::jsonb),
        updated_at = now()
      WHERE key = ${THREADS_KEY} AND jsonb_exists(value, ${threadId})`);
    // Reset the sender's own unread.
    const senderField = from === "buyer" ? "unreadBuyer" : "unreadSeller";
    await db.execute(sql`
      UPDATE kv_store SET value = jsonb_set(value, ARRAY[${threadId}, ${senderField}], '0'::jsonb)
      WHERE key = ${THREADS_KEY} AND jsonb_exists(value, ${threadId})`);
    res.json({ ok: true, message: msg });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not send message" });
  }
});

/** Zero a thread's unread counter for one side, atomically. */
router.post("/biz360/threads/mark-read", async (req, res): Promise<void> => {
  const { threadId, side } = req.body as { threadId?: string; side?: string };
  if (!threadId) { res.status(400).json({ error: "threadId required" }); return; }
  const field = side === "buyer" ? "unreadBuyer" : "unreadSeller";
  try {
    await db.execute(sql`
      UPDATE kv_store SET value = jsonb_set(value, ARRAY[${threadId}, ${field}], '0'::jsonb)
      WHERE key = ${THREADS_KEY} AND jsonb_exists(value, ${threadId})`);
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// ─── Public listing data (no auth required) ───────────────────────────────────
// Returns live asking price + published valuation snapshot for a listing ID.

// ─── Shared access check helper ──────────────────────────────────────────────
async function hasListingAccess(
  listingId: string,
  authHeader: string | undefined,
  reportToken: string | undefined,
): Promise<boolean> {
  const [settings] = await db.select().from(reportAccessSettingsTable)
    .where(eq(reportAccessSettingsTable.listingId, listingId));

  if (!settings || settings.accessMode === "public") return true;

  let viewerPhone: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    const userId = await verifyToken(authHeader.slice(7)).catch(() => null);
    if (userId) viewerPhone = userId.replace(/^u-/, "").replace(/^(\d+)$/, "+$1");
  }

  if (
    (settings.accessMode === "password" || settings.accessMode === "users_and_password") &&
    reportToken
  ) {
    if (await verifyReportAccessToken(reportToken, listingId)) return true;
  }

  if (settings.accessMode === "users" || settings.accessMode === "users_and_password") {
    if (viewerPhone) {
      const normalised = viewerPhone.replace(/\s/g, "");
      const [grant] = await db.select().from(reportAccessGrantsTable).where(
        and(
          eq(reportAccessGrantsTable.listingId, listingId),
          eq(reportAccessGrantsTable.phone, normalised),
        )
      );
      if (grant) return true;
    }
  }

  return false;
}

// ─── Live equipment value ─────────────────────────────────────────────────────
// Sum of each listing's cafe equipment, updated live as items are added in the
// valuation module. Uses each item's Current Value (falling back to secondhand →
// replacement → purchase), and excludes suspended (removed/excluded) items.
// Returns a map of listingId → total equipment value.
async function getEquipmentValueByListing(listingIds?: string[]): Promise<Record<string, number>> {
  try {
    const rows = await db
      .select({
        listingId: cafesTable.listingId,
        total: sql<string>`COALESCE(SUM(COALESCE(${cafeEquipmentTable.currentValue}, ${cafeEquipmentTable.secondhandValue}, ${cafeEquipmentTable.replacementCost}, ${cafeEquipmentTable.purchasePrice}, 0)), 0)`,
      })
      .from(cafeEquipmentTable)
      .innerJoin(cafesTable, eq(cafeEquipmentTable.cafeId, cafesTable.id))
      .where(sql`${cafeEquipmentTable.suspended} IS NOT TRUE`)
      .groupBy(cafesTable.listingId);
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (!r.listingId) continue;
      if (listingIds && !listingIds.includes(r.listingId)) continue;
      map[r.listingId] = Number(r.total ?? 0);
    }
    return map;
  } catch {
    return {};
  }
}

// ─── Public listings index ────────────────────────────────────────────────────
// GET /public/listings → every approved (non-suspended) listing, public-safe fields.
// This is what makes the website data-driven: any approved listing shows up here
// automatically, with no hardcoding.
router.get("/public/listings", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const all = Array.isArray(rows[0]?.value) ? (rows[0]!.value as any[]) : [];
    const equipMap = await getEquipmentValueByListing();
    const listings = all
      .filter((l) => l && l.status === "approved" && !l.suspended && l.listingId)
      .map((l) => ({
        id:             l.listingId,
        listingId:      l.listingId,
        businessName:   l.businessName ?? "Business for Sale",
        category:       l.category ?? "",
        subcategory:    l.subcategory ?? "",
        state:          l.state ?? "",
        suburb:         l.suburb ?? "",
        askingPrice:    Number(l.askingPrice ?? 0),
        askingPriceMin: l.askingPriceMin != null ? Number(l.askingPriceMin) : null,
        askingPriceMax: l.askingPriceMax != null ? Number(l.askingPriceMax) : null,
        weeklyRevenue:  Number(l.weeklyRevenue ?? 0),
        adjustedProfit: Number(l.adjustedProfit ?? 0),
        equipmentValue: equipMap[l.listingId] ?? 0,
        rent:           Number(l.rent ?? 0),
        staffCount:     Number(l.staffCount ?? 0),
        ownerHours:     Number(l.ownerHours ?? 0),
        leaseExpiry:    l.leaseExpiry ?? "",
        priceDisplay:   l.priceDisplay ?? "askingPrice",
        stat2Display:   l.stat2Display ?? null,
        stat3Display:   l.stat3Display ?? null,
        badges:         Array.isArray(l.badges) ? l.badges : [],
        hasTour:        Array.isArray(l.badges) ? l.badges.includes("tour") : false,
        verified:       Array.isArray(l.badges) ? (l.badges.includes("identity") || l.badges.includes("abn")) : false,
        confidential:   !!l.confidential,
        heroColor:      l.heroColor ?? "#2563EB",
        description:    l.description ?? "",
        // only expose web-loadable image URLs (skip local file:// refs from the app)
        imageUrl:       (Array.isArray(l.photos) ? l.photos.find((p: string) => typeof p === "string" && /^https?:\/\//.test(p)) : undefined) ?? null,
        submittedByName: l.submittedByName ?? null,
      }));
    res.json({ listings });
  } catch {
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

router.get("/public/listing/:listingId", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const kvValue = rows[0]?.value;
    const allListings = Array.isArray(kvValue) ? kvValue : [];
    const rawListing = allListings.find((l: any) => l.listingId === listingId) ?? null;
    const equipMap = await getEquipmentValueByListing([listingId]);
    const liveListing = rawListing
      ? { ...rawListing, equipmentValue: equipMap[listingId] ?? 0 }
      : rawListing;

    const [ndaRow] = await db.select().from(ndaSettingsTable)
      .where(eq(ndaSettingsTable.listingId, listingId));
    const ndaMode = ndaRow?.ndaMode ?? "none";
    const ndaThirdPartyUrl = ndaRow?.thirdPartyUrl ?? null;

    // NDA gate: required mode must present a valid server-issued NDA JWT before any snapshot is returned
    let ndaSigned = false;
    if (ndaMode === "required") {
      const ndaToken = req.headers["x-nda-token"] as string | undefined;
      if (ndaToken) ndaSigned = await verifyNdaToken(ndaToken, listingId);
      if (!ndaSigned) {
        res.json({ listing: liveListing, snapshot: null, snapshotGated: false, ndaMode, ndaThirdPartyUrl, ndaSigned: false });
        return;
      }
    }

    let snapshot = null;
    let snapshotGated = false;
    const cafes = await db.select().from(cafesTable).where(eq(cafesTable.listingId, listingId));
    if (cafes.length > 0) {
      const [snap] = await db
        .select()
        .from(valuationSnapshotsTable)
        .where(
          and(
            eq(valuationSnapshotsTable.cafeId, cafes[0].id),
            eq(valuationSnapshotsTable.isPublished, true),
            isNull(valuationSnapshotsTable.unitId),
          ),
        )
        .orderBy(desc(valuationSnapshotsTable.createdAt))
        .limit(1);

      if (snap) {
        const canAccess = await hasListingAccess(
          listingId,
          req.headers.authorization,
          req.headers["x-report-token"] as string | undefined,
        );
        if (canAccess) {
          snapshot = snap;
        } else {
          snapshotGated = true;
        }
      }
    }

    res.json({ listing: liveListing, snapshot, snapshotGated, ndaMode, ndaThirdPartyUrl, ndaSigned });
  } catch {
    res.status(500).json({ error: "Failed to fetch listing data" });
  }
});

// ─── Public equipment register ────────────────────────────────────────────────
// GET /public/listing/:listingId/equipment → included (non-suspended) equipment
// items for the listing, each with its second-hand value (what we price on) and
// its replacement cost (what a buyer would pay to buy it all new). Excludes
// suspended items (those turned off / kept by the seller, e.g. a division that
// isn't part of the sale).
router.get("/public/listing/:listingId/equipment", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  try {
    const cafes = await db.select().from(cafesTable).where(eq(cafesTable.listingId, listingId));
    if (!cafes.length) {
      res.json({ items: [], totals: { secondhand: 0, replacement: 0 }, count: 0 });
      return;
    }
    const cafeIds = cafes.map((c) => c.id);
    // Business units = divisions (e.g. Espresso Bar, Coffee Roastery, Coffee
    // Carts). A unit with is_included_in_sale = false (e.g. "Keeping") is NOT
    // part of the sale, so its equipment must be excluded from the register.
    const units = await db.select().from(businessUnitsTable)
      .where(inArray(businessUnitsTable.cafeId, cafeIds));
    const unitById = new Map(units.map((u) => [u.id, u]));
    const rows = await db
      .select()
      .from(cafeEquipmentTable)
      .where(and(inArray(cafeEquipmentTable.cafeId, cafeIds), sql`${cafeEquipmentTable.suspended} IS NOT TRUE`));
    const items = rows
      .filter((r) => {
        // Drop equipment belonging to a division that isn't included in the sale.
        if (!r.unitId) return true;
        const unit = unitById.get(r.unitId);
        return !unit || unit.isIncludedInSale !== false;
      })
      .map((r) => {
        const secondhand = Number(r.currentValue ?? r.secondhandValue ?? 0) || 0;
        const replacement = Number(r.replacementCost ?? r.purchasePrice ?? 0) || 0;
        const unit = r.unitId ? unitById.get(r.unitId) : null;
        return {
          id: r.id,
          name: r.name,
          category: (r.category ?? "General").trim() || "General",
          // The division this item belongs to — drives the register's filter tabs.
          division: (unit?.name ?? "General").trim() || "General",
          brand: r.brand ?? null,
          condition: r.condition ?? null,
          secondhandValue: secondhand,
          // Never show a replacement below the second-hand figure (a missing/low
          // replacement would otherwise understate what it costs to buy new).
          replacementCost: replacement > 0 ? Math.max(replacement, secondhand) : 0,
        };
      })
      .sort((a, b) => a.division.localeCompare(b.division) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const totals = items.reduce(
      (acc, it) => {
        acc.secondhand += it.secondhandValue;
        acc.replacement += it.replacementCost;
        return acc;
      },
      { secondhand: 0, replacement: 0 },
    );
    res.json({ items, totals, count: items.length });
  } catch {
    res.status(500).json({ error: "Failed to fetch equipment" });
  }
});

// ─── Listing analytics (seller + broker-shared client view) ───────────────────
// Aggregate stats for one listing. Visible to the listing owner OR any phone the
// owner has authorised (analyticsViewers) — this powers the seller dashboard and
// the shareable broker→client analytics page. Auth is a phone-verified biz360
// token; identity/authorisation are derived server-side, never trusted from body.
router.get("/public/listing/:listingId/analytics", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const callerId = bearer ? await verifyToken(bearer).catch(() => null) : null;
  if (!callerId) { res.status(401).json({ error: "Sign in to view analytics" }); return; }
  try {
    const [lrow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings = Array.isArray(lrow?.value) ? (lrow!.value as any[]) : [];
    const listing = listings.find((l) => l?.listingId === listingId);
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }

    const callerBase = ownerBase(callerId);
    const isOwner = ownerBase(listing.submittedBy) === callerBase;
    const viewers = Array.isArray(listing.analyticsViewers) ? listing.analyticsViewers.map((v: string) => ownerBase(v)) : [];
    if (!isOwner && !viewers.includes(callerBase)) {
      res.status(403).json({ error: "You're not authorised to view these analytics" });
      return;
    }

    const logs = await db.select().from(reportAccessLogsTable).where(eq(reportAccessLogsTable.listingId, listingId));
    const c = (type: string) => logs.filter((l) => l.eventType === type).length;
    const uniqueBuyers = new Set(logs.map((l) => l.buyerPhone || l.buyerId).filter(Boolean)).size;
    let ndaSigned = 0;
    try {
      const sigs = await db.select().from(ndaSignaturesTable).where(eq(ndaSignaturesTable.listingId, listingId));
      ndaSigned = sigs.length;
    } catch { /* table may be empty */ }

    // Unify "views" with the app + public listing: use the shared analytics
    // counter (biz360_analytics_v1_<id>.views) so every surface shows the same
    // number; fall back to the report_viewed log count if the blob is absent.
    let analyticsViews: number | null = null;
    let analyticsTourStarts: number | null = null;
    try {
      const [arow] = await db.select().from(kvStore).where(eq(kvStore.key, `biz360_analytics_v1_${listingId}`));
      const av = (arow?.value ?? {}) as any;
      if (typeof av?.views === "number") analyticsViews = av.views;
      if (typeof av?.tourStarts === "number") analyticsTourStarts = av.tourStarts;
    } catch { /* blob optional */ }

    const stats = {
      views:        analyticsViews ?? c("report_viewed"),
      reportViews:  c("report_viewed"),
      tourStarts:   analyticsTourStarts ?? (c("tour_clicked") + c("tour_start")),
      tourClicks:   c("tour_clicked") + c("tour_start"),
      pdfDownloads: c("pdf_downloaded"),
      requestInfo:  c("request_info") + c("access_requested"),
      requestCall:  c("request_call"),
      requestVisit: c("request_visit") + c("inspection_booked"),
      showPhone:    c("show_phone") + c("contact_clicked"),
      ndaSigned,
      uniqueBuyers,
      totalEvents:  logs.length,
    };
    // Last 14 days activity sparkline (report views + requests per day).
    const dayMs = 86400000;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const timeline = Array.from({ length: 14 }, (_, i) => {
      const start = today.getTime() - (13 - i) * dayMs;
      const end = start + dayMs;
      const n = logs.filter((l) => { const t = l.createdAt ? new Date(l.createdAt).getTime() : 0; return t >= start && t < end; }).length;
      return { date: new Date(start).toISOString().slice(0, 10), count: n };
    });

    res.json({
      listingId,
      businessName: listing.businessName ?? listing.sellerName ?? "Your listing",
      city: listing.city ?? null,
      role: isOwner ? "owner" : "viewer",
      stats,
      timeline,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

// POST /public/listing/:listingId/analytics-viewers  (owner only)
// Body: { phone, action?: "add" | "remove" } — authorise a client's phone to see
// this listing's analytics via the shareable broker page.
router.post("/public/listing/:listingId/analytics-viewers", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const callerId = bearer ? await verifyToken(bearer).catch(() => null) : null;
  if (!callerId) { res.status(401).json({ error: "Sign in required" }); return; }
  const { phone, action } = req.body as { phone?: string; action?: string };
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) { res.status(400).json({ error: "A valid phone number is required" }); return; }
  const normalised = `+${digits.startsWith("61") ? digits : digits.replace(/^0/, "61")}`;
  try {
    const [lrow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings = Array.isArray(lrow?.value) ? (lrow!.value as any[]) : [];
    const idx = listings.findIndex((l) => l?.listingId === listingId);
    if (idx < 0) { res.status(404).json({ error: "Listing not found" }); return; }
    if (ownerBase(listings[idx].submittedBy) !== ownerBase(callerId)) {
      res.status(403).json({ error: "Only the listing owner can manage viewers" });
      return;
    }
    const current: string[] = Array.isArray(listings[idx].analyticsViewers) ? listings[idx].analyticsViewers : [];
    let next: string[];
    if (action === "remove") {
      next = current.filter((v) => ownerBase(v) !== ownerBase(normalised));
    } else {
      next = current.some((v) => ownerBase(v) === ownerBase(normalised)) ? current : [...current, normalised];
    }
    listings[idx] = { ...listings[idx], analyticsViewers: next };
    await db.insert(kvStore).values({ key: "biz360_admin_pending_v2", value: listings })
      .onConflictDoUpdate({ target: kvStore.key, set: { value: listings } });
    res.json({ ok: true, analyticsViewers: next });
  } catch {
    res.status(500).json({ error: "Failed to update viewers" });
  }
});

// ─── Walkthrough photographer partner program ─────────────────────────────────
// Photographers apply to become EXIT360 walkthrough partners (own an Insta360,
// complete sample listings as training, then get approved for referral). Apps
// are stored in KV; the approved directory is served publicly for the "find a
// local partner" lookup.
const PARTNER_APPS_KEY = "biz360_partner_apps_v1";
const PARTNERS_KEY = "biz360_partners_v1";

// POST /public/partners/apply — a photographer applies to join.
router.post("/public/partners/apply", async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const phone = String(b.phone ?? "").trim();
  if (name.length < 2 || phone.replace(/\D/g, "").length < 8) {
    res.status(400).json({ error: "Name and a valid mobile number are required" });
    return;
  }
  try {
    const [row] = await db.select().from(kvStore).where(eq(kvStore.key, PARTNER_APPS_KEY));
    const apps = Array.isArray(row?.value) ? (row!.value as any[]) : [];
    apps.push({
      id: `pa-${Date.now()}`,
      name,
      phone,
      email: String(b.email ?? "").trim().slice(0, 160),
      city: String(b.city ?? "").trim().slice(0, 80),
      region: String(b.region ?? b.state ?? "").trim().slice(0, 40),
      ownsCamera: b.ownsCamera === true || b.ownsCamera === "yes",
      experience: String(b.experience ?? "").trim().slice(0, 2000),
      notes: String(b.notes ?? "").trim().slice(0, 2000),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    await db.insert(kvStore).values({ key: PARTNER_APPS_KEY, value: apps })
      .onConflictDoUpdate({ target: kvStore.key, set: { value: apps } });
    // Best-effort notify EXIT360.
    try {
      await sendEmail({
        to: "info@beanculture.com.au",
        subject: `New EXIT360 walkthrough partner application — ${name}`,
        html: emailShell("New partner application",
          `<p><strong>${name}</strong> (${phone}${b.email ? `, ${b.email}` : ""}) applied to become a walkthrough partner${b.city ? ` in ${b.city}` : ""}.</p><p>Owns an Insta360: ${b.ownsCamera ? "Yes" : "Not stated"}.</p>`),
      });
    } catch { /* non-fatal */ }
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not submit application" });
  }
});

// GET /public/partners?region= — approved partner directory for the lookup.
router.get("/public/partners", async (req, res): Promise<void> => {
  const { region } = req.query as { region?: string };
  try {
    const [row] = await db.select().from(kvStore).where(eq(kvStore.key, PARTNERS_KEY));
    let partners = Array.isArray(row?.value) ? (row!.value as any[]) : [];
    partners = partners.filter((p) => p?.approved !== false);
    if (region && region.trim()) {
      const q = region.trim().toLowerCase();
      partners = partners.filter((p) =>
        String(p?.region ?? "").toLowerCase().includes(q) ||
        String(p?.city ?? "").toLowerCase().includes(q) ||
        String(p?.serviceAreas ?? "").toLowerCase().includes(q));
    }
    res.json({ partners: partners.map((p) => ({
      name: p?.name ?? "", city: p?.city ?? "", region: p?.region ?? "",
      serviceAreas: p?.serviceAreas ?? "", phone: p?.phone ?? null, email: p?.email ?? null,
      bio: p?.bio ?? "", avatarUrl: p?.avatarUrl ?? null,
    })) });
  } catch {
    res.json({ partners: [] });
  }
});

// POST /biz360/seller/listings  (create a listing from the web)
// Lets a phone-verified seller start a listing on the website. Photos, the 360°
// tour and the financial report are enriched in the app, but the core record is
// created here and is immediately owned by (and synced to) the seller's account.
// Full listing field set — kept in sync with the app's create-listing form so a
// listing built on web carries the same information as one built in the app.
const LISTING_CATEGORIES = ["Food & Beverage", "Health & Beauty", "Services", "Health & Fitness", "Retail", "Professional Services", "Manufacturing", "Hospitality", "Technology", "Transport"];
const LISTING_STATES = ["VIC", "NSW", "QLD", "WA", "SA", "ACT", "TAS", "NT"];
const FRANCHISE_OPTIONS = ["Independent", "Franchise", "License Agreement", "Cooperative"];
const STAT_OPTS = ["sde", "staffCount", "weeklyRevenue", "rent", "equipmentValue", "ownerHours", "leaseExpiry", "none"];
const BADGES = ["identity", "abn", "financials", "lease", "equipment", "tour", "broker", "accountant", "seller_supplied"];
function applyListingFields(cur: any, b: Record<string, unknown>): void {
  const num = (v: unknown) => parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10) || 0;
  const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  const setStr = (k: string, max = 500) => { const v = str(b[k], max); if (v !== undefined) cur[k] = v; };
  const setNum = (k: string) => { if (b[k] !== undefined) cur[k] = num(b[k]); };
  if (typeof b.businessName === "string" && b.businessName.trim().length >= 2) cur.businessName = b.businessName.trim();
  setStr("suburb"); setStr("description", 4000); setStr("leaseExpiry"); setStr("leaseOptions");
  setStr("trainingPeriod"); setStr("reasonForSale", 4000); setStr("growthOpportunities", 4000); setStr("risks", 4000);
  setStr("sellerPhone", 40); setStr("subcategory");
  if (typeof b.category === "string" && b.category.trim()) cur.category = b.category.trim();
  if (typeof b.state === "string" && LISTING_STATES.includes(b.state)) cur.state = b.state;
  const SALE_STATUS = ["available", "new", "hot", "under_offer", "under_contract", "sold", "price_reduced", "leased", "coming_soon"];
  if (typeof b.saleStatus === "string" && SALE_STATUS.includes(b.saleStatus)) cur.saleStatus = b.saleStatus;
  if (typeof b.tenure === "string") cur.tenure = b.tenure.trim().slice(0, 40); // leasehold / freehold / franchise
  if (typeof b.franchiseStatus === "string" && FRANCHISE_OPTIONS.includes(b.franchiseStatus)) cur.franchiseStatus = b.franchiseStatus;
  if (typeof b.stat2Display === "string" && STAT_OPTS.includes(b.stat2Display)) cur.stat2Display = b.stat2Display;
  if (typeof b.stat3Display === "string" && STAT_OPTS.includes(b.stat3Display)) cur.stat3Display = b.stat3Display;
  if (b.priceDisplay === "askingPrice" || b.priceDisplay === "poa" || b.priceDisplay === "weeklyRevenue") cur.priceDisplay = b.priceDisplay;
  if (b.contactPreference === "message" || b.contactPreference === "call" || b.contactPreference === "broker_only") cur.contactPreference = b.contactPreference;
  setNum("askingPrice"); setNum("askingPriceMin"); setNum("askingPriceMax"); setNum("weeklyRevenue");
  setNum("adjustedProfit"); setNum("rent"); setNum("staffCount"); setNum("ownerHours"); setNum("equipmentValue");
  if (b.confidential !== undefined) cur.confidential = !!b.confidential;
  // SEO: whether search engines may index this listing's public page (default true)
  if (b.seoIndexable !== undefined) cur.seoIndexable = !!b.seoIndexable;
  if (Array.isArray(b.photos)) cur.photos = (b.photos as unknown[]).filter((p) => typeof p === "string").slice(0, 12);
  if (Array.isArray(b.badges)) cur.badges = (b.badges as unknown[]).filter((x) => typeof x === "string" && BADGES.includes(x));
  if (typeof b.heroColor === "string") cur.heroColor = b.heroColor;
}

/** Edit an existing listing's core fields (owner only, canonical-phone match). */
router.put("/biz360/seller/listings/:listingId", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const ownerId = bearer ? await verifyToken(bearer).catch(() => null) : null;
  if (!ownerId) { res.status(401).json({ error: "Sign in required" }); return; }
  const { listingId } = req.params;
  const b = req.body as Record<string, unknown>;
  const num = (v: unknown) => parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10) || 0;
  try {
    const [lrow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings = Array.isArray(lrow?.value) ? (lrow!.value as any[]) : [];
    const idx = listings.findIndex((l) => l?.listingId === listingId);
    if (idx < 0) { res.status(404).json({ error: "Listing not found" }); return; }
    if (ownerBase(listings[idx].submittedBy) !== ownerBase(ownerId)) { res.status(403).json({ error: "Not your listing" }); return; }
    const cur = listings[idx];
    applyListingFields(cur, b);
    listings[idx] = cur;
    await db.insert(kvStore).values({ key: "biz360_admin_pending_v2", value: listings })
      .onConflictDoUpdate({ target: kvStore.key, set: { value: listings } });
    res.json({ ok: true, listing: cur });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not update listing" });
  }
});

router.post("/biz360/seller/listings", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const ownerId = bearer ? await verifyToken(bearer).catch(() => null) : null;
  if (!ownerId) { res.status(401).json({ error: "Sign in required" }); return; }
  const b = req.body as Record<string, unknown>;
  const businessName = String(b.businessName ?? "").trim();
  if (businessName.length < 2) { res.status(400).json({ error: "Business name is required" }); return; }
  const PALETTE = ["#2563EB", "#7C3AED", "#0891B2", "#059669", "#D97706", "#DC2626", "#0F766E", "#9333EA"];
  try {
    const profile = await loadSellerProfile(ownerId).catch(() => ({} as any));
    const now = Date.now();
    const listingId = `user-listing-${now}`;
    const item: any = {
      id: `p-${now}`,
      listingId,
      submittedAt: now,
      status: "pending",
      submittedBy: ownerId,
      submittedByName: profile?.displayName || "Seller",
      submittedByRole: "seller",
      businessName,
      suburb: "Unknown",
      state: "VIC",
      category: "Other",
      priceDisplay: "askingPrice",
      contactPreference: "message",
      heroColor: PALETTE[now % PALETTE.length],
      photos: [] as string[],
      badges: [] as string[],
    };
    applyListingFields(item, b);
    if (!item.suburb) item.suburb = "Unknown";
    const [lrow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings = Array.isArray(lrow?.value) ? (lrow!.value as any[]) : [];
    listings.push(item);
    await db.insert(kvStore).values({ key: "biz360_admin_pending_v2", value: listings })
      .onConflictDoUpdate({ target: kvStore.key, set: { value: listings } });
    res.json({ ok: true, listing: item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not create listing";
    res.status(500).json({ error: msg });
  }
});

// ─── Seller profile + phone-reveal gating ─────────────────────────────────────
// The seller controls what's shown on their listing and whether their phone is
// revealed. Profile is stored per-owner in KV; the phone is hidden until a buyer
// has verified their own phone (and only if the seller allows it).
const SELLER_PROFILE_PREFIX = "biz360_seller_profile_v1_";
function ownerBase(id?: string | null): string {
  if (!id) return "";
  const m = id.match(/^u-\d+/);
  return m ? m[0] : id;
}
async function loadListing(listingId: string): Promise<any | null> {
  const [row] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
  const all = Array.isArray(row?.value) ? (row!.value as any[]) : [];
  return all.find((l) => l?.listingId === listingId) ?? null;
}
async function loadSellerProfile(ownerId: string): Promise<any> {
  const key = SELLER_PROFILE_PREFIX + ownerBase(ownerId);
  const [row] = await db.select().from(kvStore).where(eq(kvStore.key, key));
  return (row?.value ?? {}) as any;
}
async function saveSellerProfile(ownerId: string, value: any): Promise<void> {
  const key = SELLER_PROFILE_PREFIX + ownerBase(ownerId);
  await db.insert(kvStore).values({ key, value })
    .onConflictDoUpdate({ target: kvStore.key, set: { value } });
}
// Seller email verification token (self-contained JWT so verify needs no lookup).
async function signSellerEmailToken(owner: string, email: string): Promise<string> {
  return new SignJWT({ owner: ownerBase(owner), email, kind: "seller_email" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getNdaSecret());
}
async function verifySellerEmailToken(token: string): Promise<{ owner: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getNdaSecret());
    const p = payload as { owner?: string; email?: string; kind?: string };
    if (p.kind !== "seller_email" || !p.owner || !p.email) return null;
    return { owner: p.owner, email: p.email };
  } catch { return null; }
}
async function sendSellerVerifyEmail(owner: string, email: string): Promise<void> {
  const token = await signSellerEmailToken(owner, email);
  const link = `${PUBLIC_WEB_URL}/api/biz360/seller/email/verify?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Verify your email for EXIT360 lead alerts",
    html: emailShell(
      "Confirm your email",
      "<p>Confirm this address to receive an email whenever a buyer messages you on EXIT360 — building your buyer CRM.</p>",
      { label: "Verify my email", url: link },
    ),
  });
}
// Merge stored profile with sensible defaults from the listing.
function resolveSellerCard(listing: any, profile: any) {
  const anonymous = profile?.anonymous === true;
  const showPhone = profile?.showPhone !== false; // default: reveal to verified buyers
  const phone = (profile?.phone && String(profile.phone).trim()) || listing?.sellerPhone || null;
  const displayName = anonymous
    ? "Private Seller"
    : (profile?.displayName || listing?.sellerName || listing?.submittedByName || "The Seller");
  return {
    displayName,
    company: anonymous ? null : (profile?.company || null),
    bio: anonymous ? null : (profile?.bio || null),
    anonymous,
    phone,
    phoneAvailable: !!phone && showPhone && !anonymous,
  };
}

// Public seller card — never includes the phone number.
router.get("/public/listing/:listingId/seller", async (req, res): Promise<void> => {
  try {
    const listing = await loadListing(req.params.listingId);
    if (!listing) { res.json({ displayName: "The Seller", anonymous: false, phoneAvailable: false }); return; }
    const profile = await loadSellerProfile(listing.submittedBy);
    const card = resolveSellerCard(listing, profile);
    res.json({
      displayName: card.displayName,
      company: card.company,
      bio: card.bio,
      anonymous: card.anonymous,
      phoneAvailable: card.phoneAvailable,
    });
  } catch {
    res.status(500).json({ error: "Failed to load seller" });
  }
});

// Accept either a biz360 auth token (sub=u-<phone>) or a buyer-portal token
// (role=buyer_portal, phone) — both prove the buyer verified their own phone.
async function verifyAnyBuyerToken(bearer?: string): Promise<string | null> {
  if (!bearer) return null;
  const sub = await verifyToken(bearer).catch(() => null);
  if (sub) return sub;
  try {
    const { payload } = await jwtVerify(bearer, getNdaSecret());
    const p = payload as { role?: string; phone?: string };
    if (p.role === "buyer_portal" && p.phone) return "u-" + p.phone.replace(/\D/g, "");
  } catch { /* ignore */ }
  return null;
}

// Reveal the seller's phone — only to a buyer who has verified their own phone,
// and only if the seller allows it. Logs show_phone for analytics.
router.post("/public/listing/:listingId/seller/reveal-phone", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const buyerId = await verifyAnyBuyerToken(bearer);
  if (!buyerId) { res.status(401).json({ error: "verify_phone", message: "Verify your phone number to see the seller's number." }); return; }
  try {
    const listing = await loadListing(req.params.listingId);
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
    const profile = await loadSellerProfile(listing.submittedBy);
    const card = resolveSellerCard(listing, profile);
    if (!card.phoneAvailable) { res.status(403).json({ error: "unavailable", message: "This seller prefers to be contacted via messages." }); return; }
    // Record the reveal for the seller's dashboard.
    try {
      await db.insert(reportAccessLogsTable).values({
        listingId: req.params.listingId,
        eventType: "show_phone",
        buyerId,
        buyerPhone: null,
        buyerIp: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null,
        userAgent: req.headers["user-agent"] ?? null,
        metadata: null,
      });
    } catch { /* non-fatal */ }
    res.json({ phone: card.phone });
  } catch {
    res.status(500).json({ error: "Failed to reveal phone" });
  }
});

// Seller: read own profile (for the app backend editor).
router.get("/biz360/seller/profile", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const ownerId = bearer ? await verifyToken(bearer).catch(() => null) : null;
  if (!ownerId) { res.status(401).json({ error: "Auth required" }); return; }
  try {
    const profile = await loadSellerProfile(ownerId);
    // Seed a phone default from any of the seller's listings.
    const [lrow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings = Array.isArray(lrow?.value) ? (lrow!.value as any[]) : [];
    const mine = listings.find((l) => ownerBase(l?.submittedBy) === ownerBase(ownerId));
    res.json({
      displayName: profile.displayName ?? mine?.sellerName ?? mine?.submittedByName ?? "",
      company: profile.company ?? "",
      bio: profile.bio ?? "",
      phone: profile.phone ?? mine?.sellerPhone ?? "",
      email: profile.email ?? "",
      emailVerified: profile.emailVerified === true,
      showPhone: profile.showPhone !== false,
      anonymous: profile.anonymous === true,
    });
  } catch {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// Seller: save own profile. Changing the email (re)triggers verification.
router.put("/biz360/seller/profile", async (req, res): Promise<void> => {
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const ownerId = bearer ? await verifyToken(bearer).catch(() => null) : null;
  if (!ownerId) { res.status(401).json({ error: "Auth required" }); return; }
  const body = req.body as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
  try {
    const existing = await loadSellerProfile(ownerId);
    // Preserve verification only if the email is unchanged and was already verified.
    const emailUnchanged = email && existing?.email === email;
    let emailVerified = emailUnchanged ? existing?.emailVerified === true : false;
    const clean = {
      displayName: String(body.displayName ?? "").slice(0, 120),
      company: String(body.company ?? "").slice(0, 120),
      bio: String(body.bio ?? "").slice(0, 1000),
      phone: String(body.phone ?? "").slice(0, 32),
      email,
      emailVerified,
      showPhone: body.showPhone !== false,
      anonymous: body.anonymous === true,
    };
    await saveSellerProfile(ownerId, clean);
    // Send a verification email when a (new) unverified email is set.
    let verificationSent = false;
    if (email && !emailVerified && isValidEmail(email)) {
      await sendSellerVerifyEmail(ownerId, email);
      verificationSent = true;
    }
    res.json({ ok: true, profile: clean, verificationSent });
  } catch {
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// Seller email verification link target.
router.get("/biz360/seller/email/verify", async (req, res): Promise<void> => {
  const token = String(req.query.token ?? "");
  const decoded = token ? await verifySellerEmailToken(token) : null;
  if (!decoded) { res.status(400).send("This verification link is invalid or has expired."); return; }
  try {
    const profile = await loadSellerProfile(decoded.owner);
    if (profile?.email === decoded.email) {
      await saveSellerProfile(decoded.owner, { ...profile, emailVerified: true });
    }
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#0a1120;color:#fff;text-align:center;padding:60px 20px;"><h2 style="color:#3b82f6;">EXIT360</h2><p style="font-size:18px;">✅ Your email is verified.</p><p style="color:#8b9cb8;">You'll now get an alert whenever a buyer messages you. You can close this tab.</p></body></html>`);
  } catch {
    res.status(500).send("Something went wrong verifying your email.");
  }
});

// ─── New-message email alerts ─────────────────────────────────────────────────
// POST /biz360/notify-message  { threadId, from }
// Best-effort email to the OTHER party when a message is sent. The seller is
// notified at their account email; the buyer at their verified email (if set).
// Always resolves 200 — notification failure must never block messaging.
router.post("/biz360/notify-message", async (req, res): Promise<void> => {
  const { threadId, from } = req.body as { threadId?: string; from?: string };
  if (!threadId || !from) { res.status(400).json({ error: "threadId and from required" }); return; }
  try {
    const [trow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_threads_v3"));
    const threads = (trow?.value ?? {}) as Record<string, any>;
    const thread = threads[threadId];
    if (!thread) { res.json({ ok: false, reason: "no_thread" }); return; }
    const listingName = thread.listingName || "your listing";

    if (from === "buyer") {
      // Notify the seller (listing owner) at their account email.
      const [lrow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
      const listings = Array.isArray(lrow?.value) ? (lrow!.value as any[]) : [];
      const listing = listings.find((l) => l?.listingId === thread.listingId);
      const ownerId = listing?.submittedBy ?? null;
      // Prefer the seller's verified notification email (CRM), else account email.
      const sellerProfile = ownerId ? await loadSellerProfile(ownerId) : {};
      let email: string | null = (sellerProfile?.emailVerified && sellerProfile?.email) ? sellerProfile.email : null;
      if (!email) {
        const [urow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_users"));
        const users = Array.isArray(urow?.value) ? (urow!.value as any[]) : [];
        const owner = users.find((u) => u?.id === ownerId || u?.email === ownerId);
        email = owner?.email ?? null;
      }
      const buyerName = thread.buyerName && !/^u-\d/.test(thread.buyerName) ? thread.buyerName : "A buyer";
      if (email && /@/.test(email)) {
        await sendEmail({
          to: email,
          subject: `New message about ${listingName}`,
          html: emailShell(
            "You have a new buyer message",
            `<p><strong>${buyerName}</strong> sent you a message about <strong>${listingName}</strong>.</p><p>Open the EXIT360 app to read and reply.</p>`,
          ),
        });
        res.json({ ok: true });
        return;
      }
      res.json({ ok: false, reason: "no_owner_email" });
      return;
    }

    // Seller → notify the buyer at their verified email.
    const digits = String(thread.buyerId ?? "").replace(/\D/g, "");
    if (!digits) { res.json({ ok: false, reason: "no_buyer" }); return; }
    const [buyer] = await db.select().from(buyersTable).where(eq(buyersTable.phone, `+${digits}`));
    if (buyer?.email && buyer.emailVerified) {
      await sendEmail({
        to: buyer.email,
        subject: `Reply from the seller about ${listingName}`,
        html: emailShell(
          "The seller replied",
          `<p>The seller sent you a reply about <strong>${listingName}</strong>.</p>`,
          { label: "View in your portal", url: `${PUBLIC_WEB_URL}/buyers/portal` },
        ),
      });
      res.json({ ok: true });
      return;
    }
    res.json({ ok: false, reason: "no_buyer_email" });
  } catch {
    res.json({ ok: false });
  }
});

// ─── Tour image upload via Cloudinary ─────────────────────────────────────────
// POST /biz360/img  { key, data (base64), mimeType }  → uploads to Cloudinary biz360 folder
//                                                       → returns { url: <cloudinary https url> }

router.post("/biz360/img", async (req, res): Promise<void> => {
  const { key, data, mimeType, userId, listingId } = req.body as {
    key?: string; data?: string; mimeType?: string; userId?: string; listingId?: string;
  };
  if (!key || !data) { res.status(400).json({ error: "key and data required" }); return; }
  try {
    const mime      = mimeType ?? "image/jpeg";
    const dataUri   = `data:${mime};base64,${data}`;
    const safeKey   = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeUser  = (userId  ?? "anon").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeLid   = (listingId ?? "misc").replace(/[^a-zA-Z0-9_-]/g, "_");
    const folder    = `biz360/${safeUser}/${safeLid}`;
    const result    = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id:     safeKey,
      overwrite:     true,
      resource_type: "image",
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    // Cloudinary rejects with a plain object (not an Error), so extract the
    // real message/http_code rather than masking it as a generic failure.
    const anyErr = err as any;
    const detail =
      anyErr?.message ??
      anyErr?.error?.message ??
      (anyErr?.error && typeof anyErr.error === "string" ? anyErr.error : null) ??
      (anyErr && typeof anyErr === "object" ? JSON.stringify(anyErr) : String(anyErr));
    const httpCode = anyErr?.http_code ?? anyErr?.error?.http_code;
    console.error("[biz360/img] Cloudinary error:", httpCode ?? "", detail);
    res.status(500).json({ error: `Cloudinary: ${detail}${httpCode ? ` (http ${httpCode})` : ""}` });
  }
});

// ─── Audio upload via Cloudinary (resource_type: video handles MP3/audio) ─────
// POST /biz360/audio  { key, data (base64) }  → uploads to Cloudinary audio folder
//                                              → returns { url: <cloudinary https url> }

router.post("/biz360/audio", async (req, res): Promise<void> => {
  const { key, data, userId, listingId } = req.body as {
    key?: string; data?: string; userId?: string; listingId?: string;
  };
  if (!key || !data) { res.status(400).json({ error: "key and data required" }); return; }
  try {
    const dataUri  = `data:audio/mpeg;base64,${data}`;
    const safeKey  = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeUser = (userId    ?? "anon").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeLid  = (listingId ?? "misc").replace(/[^a-zA-Z0-9_-]/g, "_");
    const folder   = `biz360/${safeUser}/${safeLid}/audio`;
    const result   = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id:     safeKey,
      overwrite:     true,
      resource_type: "video",
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    res.status(500).json({ error: msg });
  }
});

// ─── Folder delete (used when listing sold or user purged) ────────────────────
// DELETE /biz360/img/folder   body: { prefix: "biz360/userId/listingId" }

router.delete("/biz360/img/folder", async (req, res): Promise<void> => {
  const { prefix } = req.body as { prefix?: string };
  if (!prefix?.startsWith("biz360/")) { res.status(400).json({ error: "Invalid prefix" }); return; }
  try {
    await cloudinary.api.delete_resources_by_prefix(prefix);
    try { await cloudinary.api.delete_folder(prefix); } catch { /* folder may already be gone */ }
    res.json({ ok: true, prefix });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    res.status(500).json({ error: msg });
  }
});

// ─── Cleanup settings ─────────────────────────────────────────────────────────

interface CleanupSettings {
  soldRetentionDays: number;
  inactivityDays:    number;
  whitelist:         string[];
}
const CLEANUP_DEFAULTS: CleanupSettings = { soldRetentionDays: 90, inactivityDays: 60, whitelist: [] };

async function loadCleanupSettings(): Promise<CleanupSettings> {
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_cleanup_settings"));
    const val  = rows[0]?.value as Partial<CleanupSettings> | null | undefined;
    return val ? { ...CLEANUP_DEFAULTS, ...val } : { ...CLEANUP_DEFAULTS };
  } catch { return { ...CLEANUP_DEFAULTS }; }
}

router.get("/biz360/cleanup-settings", async (_req, res): Promise<void> => {
  res.json(await loadCleanupSettings());
});

router.put("/biz360/cleanup-settings", async (req, res): Promise<void> => {
  const body = req.body as Partial<CleanupSettings>;
  const current = await loadCleanupSettings();
  const updated: CleanupSettings = {
    soldRetentionDays: Number(body.soldRetentionDays ?? current.soldRetentionDays),
    inactivityDays:    Number(body.inactivityDays    ?? current.inactivityDays),
    whitelist:         Array.isArray(body.whitelist) ? body.whitelist : current.whitelist,
  };
  try {
    await db
      .insert(kvStore).values({ key: "biz360_cleanup_settings", value: updated })
      .onConflictDoUpdate({ target: kvStore.key, set: { value: updated, updatedAt: new Date() } });
    res.json({ ok: true, settings: updated });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// ─── Cleanup engine ───────────────────────────────────────────────────────────
// POST /biz360/cleanup  — scans users + listings, purges stale Cloudinary assets
// Also called on server startup and every 24 h via app.ts scheduler.

async function deleteFolder(prefix: string) {
  await cloudinary.api.delete_resources_by_prefix(prefix);
  try { await cloudinary.api.delete_folder(prefix); } catch { /* ok if already gone */ }
}

async function runCleanup(): Promise<{ purgedUsers: string[]; purgedListings: string[] }> {
  const purgedUsers:    string[] = [];
  const purgedListings: string[] = [];

  try {
    const settings  = await loadCleanupSettings();
    const whitelist = new Set(settings.whitelist);
    const inactMs   = settings.inactivityDays    * 86_400_000;
    const soldMs    = settings.soldRetentionDays  * 86_400_000;
    const now       = Date.now();

    // ── 1. Inactive-user purge (skip whitelisted) ───────────────────────────
    const users    = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_users"));
    const userList = (users[0]?.value ?? []) as { id: string }[];

    for (const u of userList) {
      if (!u.id || whitelist.has(u.id)) continue;
      const loginRows = await db.select().from(kvStore)
        .where(eq(kvStore.key, `biz360_last_login_${u.id}`));
      const lastLogin = loginRows[0]?.value as number | null | undefined;
      if (lastLogin && now - lastLogin > inactMs) {
        const prefix = `biz360/${u.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        try { await deleteFolder(prefix); purgedUsers.push(u.id); } catch { /* no assets */ }
      }
    }

    // ── 2. Sold-listing purge (after retention period, skip whitelisted) ────
    const listingRows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings    = (listingRows[0]?.value ?? []) as {
      status: string; submittedBy: string; listingId: string; soldAt?: number;
    }[];

    for (const l of listings) {
      if (l.status !== "sold") continue;
      if (whitelist.has(l.submittedBy)) continue;
      const soldAt = l.soldAt ?? 0;
      if (!soldAt || now - soldAt < soldMs) continue; // still within grace period
      const safeUser = l.submittedBy.replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeLid  = l.listingId.replace(/[^a-zA-Z0-9_-]/g, "_");
      try { await deleteFolder(`biz360/${safeUser}/${safeLid}`); purgedListings.push(l.listingId); } catch { /* no assets */ }
    }
  } catch { /* non-critical */ }

  return { purgedUsers, purgedListings };
}

router.post("/biz360/cleanup", async (_req, res): Promise<void> => {
  const result = await runCleanup();
  res.json({ ok: true, ...result });
});

export { runCleanup };

// ─── Twilio Verify — phone OTP ─────────────────────────────────────────────────

// ─── Public report access endpoints ──────────────────────────────────────────

router.get("/public/listing/:listingId/access-check", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  try {
    const [settings] = await db.select().from(reportAccessSettingsTable)
      .where(eq(reportAccessSettingsTable.listingId, listingId));

    if (!settings || settings.accessMode === "public") {
      res.json({ mode: "public", hasAccess: true });
      return;
    }

    let viewerPhone: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const userId = await verifyToken(authHeader.slice(7)).catch(() => null);
      if (userId) viewerPhone = userId.replace(/^u-/, "").replace(/^(\d+)$/, "+$1");
    }

    const reportToken = req.headers["x-report-token"] as string | undefined;

    if (settings.accessMode === "password") {
      const tokenOk = reportToken ? await verifyReportAccessToken(reportToken, listingId) : false;
      res.json({
        mode: "password",
        hasAccess: tokenOk,
        smsUnlockEnabled: settings.smsUnlockEnabled,
      });
      return;
    }

    if (settings.accessMode === "users") {
      let granted = false;
      if (viewerPhone) {
        const normalised = viewerPhone.replace(/\s/g, "");
        const [grant] = await db.select().from(reportAccessGrantsTable).where(
          and(
            eq(reportAccessGrantsTable.listingId, listingId),
            eq(reportAccessGrantsTable.phone, normalised),
          )
        );
        granted = !!grant;
      }
      res.json({ mode: "users", hasAccess: granted });
      return;
    }

    if (settings.accessMode === "users_and_password") {
      let granted = false;
      if (viewerPhone) {
        const normalised = viewerPhone.replace(/\s/g, "");
        const [grant] = await db.select().from(reportAccessGrantsTable).where(
          and(
            eq(reportAccessGrantsTable.listingId, listingId),
            eq(reportAccessGrantsTable.phone, normalised),
          )
        );
        granted = !!grant;
      }
      if (!granted && reportToken) {
        granted = await verifyReportAccessToken(reportToken, listingId);
      }
      res.json({
        mode: "users_and_password",
        hasAccess: granted,
        smsUnlockEnabled: settings.smsUnlockEnabled,
      });
      return;
    }

    res.json({ mode: settings.accessMode, hasAccess: false });
  } catch {
    res.status(500).json({ error: "Access check failed" });
  }
});

router.post("/public/listing/:listingId/verify-password", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const { password } = req.body as { password?: string };
  if (!password) { res.status(400).json({ error: "password required" }); return; }
  try {
    const [settings] = await db.select().from(reportAccessSettingsTable)
      .where(eq(reportAccessSettingsTable.listingId, listingId));
    if (!settings?.passwordHash) { res.status(403).json({ error: "No password set" }); return; }
    const ok = await checkPwd(password, settings.passwordHash);
    if (!ok) { res.status(403).json({ error: "Incorrect password" }); return; }
    const token = await signReportAccessToken(listingId);
    res.json({ ok: true, token });
  } catch {
    res.status(500).json({ error: "Verification failed" });
  }
});

// Step 1 of SMS unlock: send a Twilio Verify OTP to the buyer's phone
router.post("/public/listing/:listingId/sms-unlock/send", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const { phone } = req.body as { phone?: string };
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  try {
    const [settings] = await db.select().from(reportAccessSettingsTable)
      .where(eq(reportAccessSettingsTable.listingId, listingId));
    if (!settings?.smsUnlockEnabled) {
      res.status(403).json({ error: "SMS unlock not enabled for this listing" }); return;
    }
    if (isTestOtpPhone(phone)) { res.json({ ok: true, test: true }); return; }
    const client = getTwilioClient();
    await client.verify.v2
      .services(getVerifyServiceSid())
      .verifications.create({ to: phone, channel: "sms" });
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send code";
    res.status(500).json({ error: msg });
  }
});

// Step 2 of SMS unlock: verify the OTP and issue a 24h report access token
router.post("/public/listing/:listingId/sms-unlock/verify", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) { res.status(400).json({ error: "phone and code required" }); return; }
  try {
    const [settings] = await db.select().from(reportAccessSettingsTable)
      .where(eq(reportAccessSettingsTable.listingId, listingId));
    if (!settings?.smsUnlockEnabled) {
      res.status(403).json({ error: "SMS unlock not enabled" }); return;
    }
    if (!isTestOtpPhone(phone)) {
      const client = getTwilioClient();
      const check = await client.verify.v2
        .services(getVerifyServiceSid())
        .verificationChecks.create({ to: phone, code });
      if (check.status !== "approved") {
        res.status(400).json({ error: "Incorrect or expired code" }); return;
      }
    }
    const token = await signReportAccessToken(listingId);
    res.json({ ok: true, token });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: msg });
  }
});

// ─── NDA status ───────────────────────────────────────────────────────────────

router.get("/public/listing/:listingId/nda", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  try {
    const [ndaRow] = await db.select().from(ndaSettingsTable)
      .where(eq(ndaSettingsTable.listingId, listingId));
    const mode = ndaRow?.ndaMode ?? "none";
    let hasSigned = false;
    if (mode === "required") {
      const ndaToken = req.headers["x-nda-token"] as string | undefined;
      if (ndaToken) hasSigned = await verifyNdaToken(ndaToken, listingId);
    }
    res.json({ mode, hasSigned });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// ─── NDA signing — public buyer endpoints ─────────────────────────────────────

router.post("/public/listing/:listingId/nda/send-otp", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const { phone } = req.body as { phone?: string };
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  try {
    const [ndaSettings] = await db.select().from(ndaSettingsTable)
      .where(eq(ndaSettingsTable.listingId, listingId));
    if (!ndaSettings || ndaSettings.ndaMode !== "required") {
      res.status(403).json({ error: "NDA signing not required for this listing" }); return;
    }
    if (isTestOtpPhone(phone)) { res.json({ ok: true, test: true }); return; }
    const client = getTwilioClient();
    await client.verify.v2
      .services(getVerifyServiceSid())
      .verifications.create({ to: phone, channel: "sms" });
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send code";
    res.status(500).json({ error: msg });
  }
});

router.post("/public/listing/:listingId/nda/sign", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const { phone, code, name } = req.body as { phone?: string; code?: string; name?: string };
  if (!phone || !code) { res.status(400).json({ error: "phone and code required" }); return; }
  if (!name || name.trim().length < 2) { res.status(400).json({ error: "Your full name is required to sign" }); return; }
  try {
    const [ndaSettings] = await db.select().from(ndaSettingsTable)
      .where(eq(ndaSettingsTable.listingId, listingId));
    if (!ndaSettings || ndaSettings.ndaMode !== "required") {
      res.status(403).json({ error: "NDA signing not required for this listing" }); return;
    }
    if (!isTestOtpPhone(phone)) {
      const client = getTwilioClient();
      const check = await client.verify.v2
        .services(getVerifyServiceSid())
        .verificationChecks.create({ to: phone, code });
      if (check.status !== "approved") {
        res.status(400).json({ error: "Incorrect or expired code" }); return;
      }
    }
    const [signature] = await db.insert(ndaSignaturesTable).values({
      listingId,
      buyerName: name.trim(),
      buyerPhone: phone.replace(/\s/g, ""),
      buyerIp: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      ndaVersion: "v1",
      otpVerified: true,
    }).returning();
    const ndaToken = await signNdaToken(listingId, phone.replace(/\s/g, ""));
    res.json({ ok: true, signedAt: signature.signedAt, ndaToken });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify";
    res.status(400).json({ error: msg });
  }
});

router.post("/public/listing/:listingId/log-view", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const { phone, documentType, token } = req.body as { phone?: string; documentType?: string; token?: string };
  try {
    let viewerPhone = phone ?? null;
    const authHeader = req.headers.authorization;
    if (!viewerPhone && authHeader?.startsWith("Bearer ")) {
      const userId = await verifyToken(authHeader.slice(7)).catch(() => null);
      if (userId) viewerPhone = userId.replace(/^u-/, "").replace(/^(\d+)$/, "+$1");
    }
    // Resolve the viewer's phone from a buyer-portal or report-access token
    // (both carry a `phone` claim) so we know WHO opened the report.
    if (!viewerPhone && token && process.env.JWT_SECRET) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        if (typeof (payload as any).phone === "string") viewerPhone = (payload as any).phone;
      } catch { /* invalid token — log anonymously */ }
    }
    await db.insert(reportViewEventsTable).values({
      listingId,
      viewerPhone,
      viewerIp: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      documentType: documentType ?? "financials",
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// GET /public/listing/:listingId/visitors  (owner only)
// Seller activity feed: who has opened this report, when, and how many times.
router.get("/public/listing/:listingId/visitors", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const bearer = req.headers.authorization?.replace("Bearer ", "").trim();
  const callerId = bearer ? await verifyToken(bearer).catch(() => null) : null;
  if (!callerId) { res.status(401).json({ error: "Sign in required" }); return; }
  try {
    const [lrow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const listings = Array.isArray(lrow?.value) ? (lrow!.value as any[]) : [];
    const listing = listings.find((l) => l?.listingId === listingId);
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
    if (ownerBase(listing.submittedBy) !== ownerBase(callerId)) { res.status(403).json({ error: "Not your listing" }); return; }

    const events = await db.select().from(reportViewEventsTable)
      .where(eq(reportViewEventsTable.listingId, listingId))
      .orderBy(desc(reportViewEventsTable.openedAt)).limit(3000);

    const tail = (p?: string | null) => { const d = String(p ?? "").replace(/\D/g, ""); return d.length >= 9 ? d.slice(-9) : ""; };
    type Agg = { phone: string | null; anonymous: boolean; visits: number; firstSeen: number; lastSeen: number; docs: Record<string, number> };
    const byKey = new Map<string, Agg>();
    for (const e of events) {
      const t9 = tail(e.viewerPhone);
      const key = t9 ? `p:${t9}` : `ip:${e.viewerIp ?? "unknown"}`;
      const ts = e.openedAt ? new Date(e.openedAt as any).getTime() : 0;
      const g = byKey.get(key) ?? { phone: t9 ? (e.viewerPhone ?? null) : null, anonymous: !t9, visits: 0, firstSeen: ts || Date.now(), lastSeen: 0, docs: {} };
      g.visits++;
      if (ts) { g.lastSeen = Math.max(g.lastSeen, ts); g.firstSeen = Math.min(g.firstSeen, ts); }
      const dt = String((e as any).documentType ?? "report"); g.docs[dt] = (g.docs[dt] ?? 0) + 1;
      byKey.set(key, g);
    }

    // Resolve names for identified visitors.
    const nameByTail = new Map<string, string>();
    try {
      const buyers = await db.select().from(buyersTable);
      for (const b of buyers) { const t9 = tail(b.phone); if (t9 && b.name) nameByTail.set(t9, b.name); }
    } catch { /* names are best-effort */ }

    const visitors = [...byKey.values()].map((g) => ({
      phone: g.phone,
      name: g.phone ? (nameByTail.get(tail(g.phone)) ?? null) : null,
      anonymous: g.anonymous,
      visits: g.visits,
      firstSeen: g.firstSeen,
      lastSeen: g.lastSeen,
      docs: g.docs,
    })).sort((a, b) => b.lastSeen - a.lastSeen);

    res.json({ visitors, totalViews: events.length, uniqueVisitors: visitors.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load visitors" });
  }
});

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error("Twilio credentials not configured");
  return twilio(accountSid, authToken);
}

function getVerifyServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SERVICE_SID not configured");
  return sid;
}

router.post("/biz360/auth/send-otp", async (req, res): Promise<void> => {
  const { phone } = req.body as { phone?: string };
  if (!phone) {
    res.status(400).json({ error: "Phone number required" });
    return;
  }
  try {
    if (isTestOtpPhone(phone)) { res.json({ ok: true, test: true }); return; }
    const client = getTwilioClient();
    await client.verify.v2
      .services(getVerifyServiceSid())
      .verifications.create({ to: phone, channel: "sms" });
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send code";
    res.status(500).json({ error: msg });
  }
});

router.post("/biz360/auth/verify-otp", async (req, res): Promise<void> => {
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) {
    res.status(400).json({ error: "Phone and code are required" });
    return;
  }
  try {
    const approved = isTestOtpPhone(phone)
      ? true
      : (await getTwilioClient().verify.v2
          .services(getVerifyServiceSid())
          .verificationChecks.create({ to: phone, code })).status === "approved";
    if (approved) {
      const userId = `u-${phone.replace(/\D/g, "")}`;
      let token: string | null = null;
      let buyerToken: string | null = null;
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        const { SignJWT } = await import("jose");
        const secret = new TextEncoder().encode(jwtSecret);
        token = await new SignJWT({ sub: userId })
          .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("90d").sign(secret);
        // Also mint a buyer-portal token so ONE sign-in unlocks both the seller
        // dashboard and the buyer portal (unified phone identity).
        const e164 = `+${phone.replace(/\D/g, "")}`;
        buyerToken = await new SignJWT({ phone: e164, role: "buyer_portal" })
          .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("90d").sign(secret);
      }
      res.json({ ok: true, token, buyerToken, userId });
    } else {
      res.status(400).json({ error: "Incorrect or expired code" });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: msg });
  }
});

// ─── Buyer report access token issuance ───────────────────────────────────────
// POST /biz360/report-access-tokens/issue
// Body: { listingId, phone, otpCode }
// 1. Verifies the OTP via Twilio Verify
// 2. Checks the phone is in reportAccessGrantsTable for this listing
// 3. Issues a short-lived signed JWT { listingId, phone, type:"buyer-report-access" }
// The token is then passed as ?accessToken= to the HTML report endpoint to
// unlock approved_buyers sections without requiring a server-side user account.
router.post("/biz360/report-access-tokens/issue", async (req, res): Promise<void> => {
  const { listingId, phone, otpCode } = req.body as {
    listingId?: string;
    phone?: string;
    otpCode?: string;
  };

  if (!listingId || !phone || !otpCode) {
    res.status(400).json({ error: "listingId, phone, and otpCode are required" });
    return;
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const jwtSecret  = process.env.JWT_SECRET;

    const testPhone = isTestOtpPhone(phone);
    if (!jwtSecret || (!testPhone && (!accountSid || !authToken || !serviceSid))) {
      res.status(503).json({ error: "OTP service not configured" });
      return;
    }

    if (!testPhone) {
      const twilioClient = twilio(accountSid!, authToken!);
      const check = await twilioClient.verify.v2
        .services(serviceSid!)
        .verificationChecks.create({ to: phone, code: otpCode });

      if (check.status !== "approved") {
        res.status(400).json({ error: "Incorrect or expired OTP" });
        return;
      }
    }

    // Verify the phone has been explicitly granted access for this listing
    const normalised = phone.replace(/\s/g, "");
    const [grant] = await db
      .select({ id: reportAccessGrantsTable.id })
      .from(reportAccessGrantsTable)
      .where(
        and(
          eq(reportAccessGrantsTable.listingId, listingId),
          eq(reportAccessGrantsTable.phone, normalised),
        ),
      )
      .limit(1);

    if (!grant) {
      res.status(403).json({ error: "Phone number is not approved for this listing" });
      return;
    }

    const accessToken = await new SignJWT({
      listingId,
      phone: normalised,
      type: "buyer-report-access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("4h")
      .sign(new TextEncoder().encode(jwtSecret));

    res.json({ accessToken });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Token issuance failed";
    res.status(400).json({ error: msg });
  }
});

// ─── Seller preview — one-time code exchange ──────────────────────────────────
// Mobile "Preview Report" uses a short-lived code (never a raw JWT in the URL).
// Step 1: POST /api/report-preview-tokens  (requires seller JWT)
//   → issues a 90-second single-use code stored in KV.
// Step 2: POST /api/report-preview-tokens/exchange  (public)
//   → swaps code for a 4-hour report-view JWT; code deleted immediately.
// This keeps the long-lived seller JWT out of browser history/referrer headers.
router.post("/report-preview-tokens", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = await verifyToken(authHeader.slice(7)).catch(() => null);
  if (!userId) { res.status(401).json({ error: "Invalid token" }); return; }

  const { listingId } = req.body as { listingId?: string };
  if (!listingId) { res.status(400).json({ error: "listingId required" }); return; }

  // Verify the authenticated user owns this listing before issuing a preview code.
  // Without this check any authenticated user could obtain a seller-preview token for
  // any arbitrary listing and use it to unlock approved-buyer PDF content.
  const [owned] = await db
    .select({ id: cafesTable.id })
    .from(cafesTable)
    .where(and(eq(cafesTable.listingId, listingId), eq(cafesTable.ownerId, userId)))
    .limit(1);
  if (!owned) { res.status(403).json({ error: "Listing not found or access denied" }); return; }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("crypto") as typeof import("crypto");
  const code = randomBytes(20).toString("hex");       // 40 hex chars
  const exp  = Date.now() + 90_000;                  // 90 seconds
  const payload = JSON.stringify({ userId, listingId, exp });

  await db.insert(kvStore)
    .values({ key: `preview_code:${code}`, value: payload })
    .onConflictDoUpdate({ target: kvStore.key, set: { value: payload } });

  res.json({ previewCode: code });
});

router.post("/report-preview-tokens/exchange", async (req, res): Promise<void> => {
  const { previewCode } = req.body as { previewCode?: string };
  if (!previewCode || !/^[0-9a-f]{40}$/.test(previewCode)) {
    res.status(400).json({ error: "Invalid previewCode format" }); return;
  }

  const rows = await db.select().from(kvStore)
    .where(eq(kvStore.key, `preview_code:${previewCode}`)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Invalid preview code" }); return; }

  // Always delete immediately — single-use
  await db.delete(kvStore).where(eq(kvStore.key, `preview_code:${previewCode}`));

  const data = (typeof rows[0].value === "string"
    ? JSON.parse(rows[0].value)
    : rows[0].value) as { userId: string; listingId: string; exp: number };

  if (Date.now() > data.exp) { res.status(410).json({ error: "Preview code expired" }); return; }

  const secret = process.env.JWT_SECRET;
  if (!secret) { res.status(503).json({ error: "Server misconfigured" }); return; }

  const token = await new SignJWT({ sub: data.userId, listingId: data.listingId, type: "seller-preview" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(new TextEncoder().encode(secret));

  res.json({ token });
});

export default router;

