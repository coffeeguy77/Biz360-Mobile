import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT } from "jose";
import {
  db,
  cafesTable,
  reportAccessSettingsTable,
  reportAccessGrantsTable,
  reportViewEventsTable,
} from "@workspace/db";

const router = Router({ mergeParams: true });
const scryptAsync = promisify(scrypt);

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "");

async function hashPwd(pw: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(pw, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function checkPwd(pw: string, hash: string): Promise<boolean> {
  try {
    const [salt, stored] = hash.split(":");
    const key = (await scryptAsync(pw, salt, 64)) as Buffer;
    const storedBuf = Buffer.from(stored, "hex");
    if (key.length !== storedBuf.length) return false;
    return timingSafeEqual(key, storedBuf);
  } catch {
    return false;
  }
}

function validatePwd(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter";
  if (!/[0-9]/.test(pw)) return "Password must contain a number";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain a symbol";
  return null;
}

async function requireCafeOwner(cafeId: string, ownerId: string) {
  const [cafe] = await db.select().from(cafesTable).where(
    and(eq(cafesTable.id, cafeId), eq(cafesTable.ownerId, ownerId))
  );
  return cafe ?? null;
}

// GET /valuation/cafes/:cafeId/report-access
router.get("/", async (req, res) => {
  const { cafeId } = req.params as { cafeId: string };
  const ownerId = req.user!.id;
  const cafe = await requireCafeOwner(cafeId, ownerId);
  if (!cafe) return res.status(403).json({ error: "Forbidden" });
  const listingId = cafe.listingId;
  if (!listingId) return res.json({ settings: null, grants: [] });

  const [settings] = await db.select().from(reportAccessSettingsTable)
    .where(eq(reportAccessSettingsTable.listingId, listingId));
  const grants = await db.select().from(reportAccessGrantsTable)
    .where(eq(reportAccessGrantsTable.listingId, listingId))
    .orderBy(desc(reportAccessGrantsTable.createdAt));

  return res.json({
    settings: settings
      ? { ...settings, passwordHash: undefined, hasPassword: !!settings.passwordHash }
      : null,
    grants,
  });
});

// PUT /valuation/cafes/:cafeId/report-access
router.put("/", async (req, res) => {
  const { cafeId } = req.params as { cafeId: string };
  const ownerId = req.user!.id;
  const cafe = await requireCafeOwner(cafeId, ownerId);
  if (!cafe) return res.status(403).json({ error: "Forbidden" });
  const listingId = cafe.listingId;
  if (!listingId) return res.status(400).json({ error: "This valuation has no linked listing" });

  const { accessMode, password, clearPassword, smsUnlockEnabled } = req.body as {
    accessMode?: string;
    password?: string;
    clearPassword?: boolean;
    smsUnlockEnabled?: boolean;
  };

  const validModes = ["public", "users", "password", "users_and_password"];
  if (accessMode && !validModes.includes(accessMode)) {
    return res.status(400).json({ error: "Invalid access mode" });
  }

  let passwordHash: string | undefined | null = undefined;
  if (password) {
    const err = validatePwd(password);
    if (err) return res.status(400).json({ error: err });
    passwordHash = await hashPwd(password);
  } else if (clearPassword) {
    passwordHash = null;
  }

  const [existing] = await db.select().from(reportAccessSettingsTable)
    .where(eq(reportAccessSettingsTable.listingId, listingId));

  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (accessMode) updates.accessMode = accessMode;
    if (passwordHash !== undefined) updates.passwordHash = passwordHash;
    if (smsUnlockEnabled !== undefined) updates.smsUnlockEnabled = smsUnlockEnabled;
    const [updated] = await db.update(reportAccessSettingsTable)
      .set(updates)
      .where(eq(reportAccessSettingsTable.listingId, listingId))
      .returning();
    return res.json({ settings: { ...updated, passwordHash: undefined, hasPassword: !!updated.passwordHash } });
  } else {
    const [created] = await db.insert(reportAccessSettingsTable).values({
      listingId,
      accessMode: (accessMode ?? "public") as any,
      passwordHash: passwordHash ?? null,
      smsUnlockEnabled: smsUnlockEnabled ?? false,
    }).returning();
    return res.json({ settings: { ...created, passwordHash: undefined, hasPassword: !!created.passwordHash } });
  }
});

// POST /valuation/cafes/:cafeId/report-access/grants
router.post("/grants", async (req, res) => {
  const { cafeId } = req.params as { cafeId: string };
  const ownerId = req.user!.id;
  const cafe = await requireCafeOwner(cafeId, ownerId);
  if (!cafe) return res.status(403).json({ error: "Forbidden" });
  const listingId = cafe.listingId;
  if (!listingId) return res.status(400).json({ error: "No linked listing" });

  const { phone, note } = req.body as { phone?: string; note?: string };
  if (!phone) return res.status(400).json({ error: "phone is required" });

  const normalised = phone.replace(/\s/g, "");
  const [grant] = await db.insert(reportAccessGrantsTable).values({
    listingId,
    phone: normalised,
    grantedBy: ownerId,
    note: note ?? null,
  }).returning();
  return res.status(201).json({ grant });
});

// DELETE /valuation/cafes/:cafeId/report-access/grants/:grantId
router.delete("/grants/:grantId", async (req, res) => {
  const { cafeId, grantId } = req.params as { cafeId: string; grantId: string };
  const ownerId = req.user!.id;
  const cafe = await requireCafeOwner(cafeId, ownerId);
  if (!cafe) return res.status(403).json({ error: "Forbidden" });

  await db.delete(reportAccessGrantsTable)
    .where(and(
      eq(reportAccessGrantsTable.id, grantId),
      eq(reportAccessGrantsTable.listingId, cafe.listingId ?? "")
    ));
  return res.json({ ok: true });
});

// GET /valuation/cafes/:cafeId/report-access/analytics
router.get("/analytics", async (req, res) => {
  const { cafeId } = req.params as { cafeId: string };
  const ownerId = req.user!.id;
  const cafe = await requireCafeOwner(cafeId, ownerId);
  if (!cafe) return res.status(403).json({ error: "Forbidden" });
  const listingId = cafe.listingId;
  if (!listingId) return res.json({ events: [], total: 0 });

  const events = await db.select().from(reportViewEventsTable)
    .where(eq(reportViewEventsTable.listingId, listingId))
    .orderBy(desc(reportViewEventsTable.openedAt))
    .limit(200);

  return res.json({ events, total: events.length });
});

// ─── Public helper used by biz360 router ─────────────────────────────────────

export async function signReportAccessToken(listingId: string): Promise<string> {
  return new SignJWT({ listingId, type: "report-access" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyReportAccessToken(
  token: string,
  listingId: string
): Promise<boolean> {
  const { jwtVerify } = await import("jose");
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload as any).listingId === listingId && (payload as any).type === "report-access";
  } catch {
    return false;
  }
}

export { checkPwd, hashPwd, validatePwd };
export default router;
