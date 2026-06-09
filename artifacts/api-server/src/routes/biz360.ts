import { Router } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
  db, kvStore, cafesTable, valuationSnapshotsTable,
  reportAccessSettingsTable, reportAccessGrantsTable, reportViewEventsTable,
} from "@workspace/db";
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

router.get("/public/listing/:listingId", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2"));
    const kvValue = rows[0]?.value;
    const allListings = Array.isArray(kvValue) ? kvValue : [];
    const liveListing = allListings.find((l: any) => l.listingId === listingId) ?? null;

    let snapshot = null;
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
      snapshot = snap ?? null;
    }

    res.json({ listing: liveListing, snapshot });
  } catch {
    res.status(500).json({ error: "Failed to fetch listing data" });
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
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[biz360/img] Cloudinary error:", msg);
    res.status(500).json({ error: msg });
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

router.post("/public/listing/:listingId/request-sms-password", async (req, res): Promise<void> => {
  const { listingId } = req.params;
  const { phone } = req.body as { phone?: string };
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  try {
    const [settings] = await db.select().from(reportAccessSettingsTable)
      .where(eq(reportAccessSettingsTable.listingId, listingId));
    if (!settings?.smsUnlockEnabled || !settings.passwordHash) {
      res.status(403).json({ error: "SMS unlock not enabled" }); return;
    }
    const client = getTwilioClient();
    await client.messages.create({
      to: phone,
      from: process.env.TWILIO_PHONE_NUMBER ?? undefined,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SID ?? undefined,
      body: `Your EXIT360 report password has been requested. Please contact the listing agent or use the password provided to you.`,
    }).catch(() => null);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "SMS failed" });
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
    const client = getTwilioClient();
    const check  = await client.verify.v2
      .services(getVerifyServiceSid())
      .verificationChecks.create({ to: phone, code });
    if (check.status === "approved") {
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

export default router;
