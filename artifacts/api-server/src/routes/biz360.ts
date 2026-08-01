import { Router } from "express";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import {
  db, kvStore, cafesTable, valuationSnapshotsTable, cafeEquipmentTable,
  reportAccessSettingsTable, reportAccessGrantsTable, reportViewEventsTable,
  ndaSettingsTable, ndaSignaturesTable, buyersTable,
} from "@workspace/db";
import { sendEmail, emailShell, emailConfigured, PUBLIC_WEB_URL } from "../lib/email";
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
const TEST_OTP_NUMBERS = ["414631463", "412708337"];
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
    await db
      .insert(kvStore)
      .values({ key, value })
      .onConflictDoUpdate({
        target: kvStore.key,
        set: { value, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
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
    const rows = await db
      .select()
      .from(cafeEquipmentTable)
      .where(and(inArray(cafeEquipmentTable.cafeId, cafeIds), sql`${cafeEquipmentTable.suspended} IS NOT TRUE`));
    const items = rows
      .map((r) => {
        const secondhand = Number(r.currentValue ?? r.secondhandValue ?? 0) || 0;
        const replacement = Number(r.replacementCost ?? r.purchasePrice ?? 0) || 0;
        return {
          id: r.id,
          name: r.name,
          category: (r.category ?? "General").trim() || "General",
          brand: r.brand ?? null,
          condition: r.condition ?? null,
          secondhandValue: secondhand,
          // Never show a replacement below the second-hand figure (a missing/low
          // replacement would otherwise understate what it costs to buy new).
          replacementCost: replacement > 0 ? Math.max(replacement, secondhand) : 0,
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
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

// ─── TEMPORARY email self-test ────────────────────────────────────────────────
// GET /biz360/email-selftest — sends a test email to the account owner only, so a
// real send can be verified end-to-end. Fixed recipient = no abuse. Remove after.
router.get("/biz360/email-selftest", async (_req, res): Promise<void> => {
  const to = "info@beanculture.com.au";
  const configured = emailConfigured();
  let sent = false;
  if (configured) {
    sent = await sendEmail({
      to,
      subject: "EXIT360 email test ✅",
      html: emailShell(
        "Email is working",
        "<p>This confirms EXIT360 can send emails through Resend. You can ignore this message.</p>",
      ),
    });
  }
  res.json({ configured, sent, to, from: process.env.EMAIL_FROM ?? null });
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
      const [urow] = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_users"));
      const users = Array.isArray(urow?.value) ? (urow!.value as any[]) : [];
      const owner = users.find((u) => u?.id === ownerId || u?.email === ownerId);
      const email = owner?.email;
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
  const { phone, documentType } = req.body as { phone?: string; documentType?: string };
  try {
    let viewerPhone = phone ?? null;
    const authHeader = req.headers.authorization;
    if (!viewerPhone && authHeader?.startsWith("Bearer ")) {
      const userId = await verifyToken(authHeader.slice(7)).catch(() => null);
      if (userId) viewerPhone = userId.replace(/^u-/, "").replace(/^(\d+)$/, "+$1");
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
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        const { SignJWT } = await import("jose");
        const secret = new TextEncoder().encode(jwtSecret);
        token = await new SignJWT({ sub: userId })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("90d")
          .sign(secret);
      }
      res.json({ ok: true, token, userId });
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

