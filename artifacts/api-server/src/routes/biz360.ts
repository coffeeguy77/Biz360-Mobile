import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, kvStore } from "@workspace/db";
import twilio from "twilio";
import { v2 as cloudinary } from "cloudinary";

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

// ─── Tour image upload via Cloudinary ─────────────────────────────────────────
// POST /biz360/img  { key, data (base64), mimeType }  → uploads to Cloudinary biz360 folder
//                                                       → returns { url: <cloudinary https url> }

router.post("/biz360/img", async (req, res): Promise<void> => {
  const { key, data, mimeType } = req.body as { key?: string; data?: string; mimeType?: string };
  if (!key || !data) { res.status(400).json({ error: "key and data required" }); return; }
  try {
    const mime      = mimeType ?? "image/jpeg";
    const dataUri   = `data:${mime};base64,${data}`;
    const safeKey   = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    const result    = await cloudinary.uploader.upload(dataUri, {
      folder:         "biz360",
      public_id:      safeKey,
      overwrite:      true,
      resource_type:  "image",
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    res.status(500).json({ error: msg });
  }
});

// ─── Twilio Verify — phone OTP ─────────────────────────────────────────────────

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
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: "Incorrect or expired code" });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: msg });
  }
});

export default router;
