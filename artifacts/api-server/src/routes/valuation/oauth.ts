import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import { db, cafeIntegrationsTable, cafesTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { requireAuth, verifyToken } from "../../middlewares/auth";

const router: IRouter = Router();
const SQUARE_APP_ID = process.env.SQUARE_APP_ID;
const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET;
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;

function getBaseUrl(req: any) {
  if (process.env.OAUTH_REDIRECT_BASE_URL) return process.env.OAUTH_REDIRECT_BASE_URL.replace(/\/$/, "");
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  return `${req.protocol}://${req.get("host")}`;
}

async function assertCafeOwnerById(cafeId: string, userId: string) {
  const [cafe] = await db.select({ id: cafesTable.id }).from(cafesTable).where(and(eq(cafesTable.id, cafeId), eq(cafesTable.ownerId, userId)));
  return !!cafe;
}

function getStateSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  return s;
}

function signState(payload: object): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getStateSecret()).update(json).digest("base64url");
  return `${json}.${sig}`;
}

function verifyState(state: string): { cafeId: string; userId: string; nonce: string } {
  const dot = state.lastIndexOf(".");
  if (dot === -1) throw new Error("malformed state");
  const json = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", getStateSecret()).update(json).digest("base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  const actualBuf   = Buffer.from(sig, "base64url");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new Error("state signature invalid");
  }
  return JSON.parse(Buffer.from(json, "base64url").toString());
}

async function upsertIntegration(cafeId: string, ownerId: string, type: string, data: { status: string; accessToken?: string | null; refreshToken?: string | null; tokenExpiresAt?: Date | null; merchantId?: string | null; merchantName?: string | null; metadata?: object | null }) {
  const [existing] = await db.select({ id: cafeIntegrationsTable.id }).from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, type), eq(cafeIntegrationsTable.ownerId, ownerId)));
  if (existing) {
    await db.update(cafeIntegrationsTable).set(data).where(and(eq(cafeIntegrationsTable.id, existing.id), eq(cafeIntegrationsTable.ownerId, ownerId)));
  } else {
    await db.insert(cafeIntegrationsTable).values({ cafeId, ownerId, type, ...data });
  }
}

const APP_SCHEME = "biz360";
const SQUARE_MOBILE_REDIRECT = `${APP_SCHEME}://oauth/square/callback`;
const XERO_MOBILE_REDIRECT = `${APP_SCHEME}://oauth/xero/callback`;

function donePage(title: string, message: string, ok: boolean, provider: string, detail = "") {
  const color = ok ? "#2D6A4F" : "#9B1C1C";
  const icon = ok ? "✓" : "✕";
  const status = ok ? "success" : "error";
  const deepLink = `${APP_SCHEME}://oauth/done?provider=${provider}&status=${status}&detail=${encodeURIComponent(detail)}`;
  return `<!DOCTYPE html><html><head><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<script>window.location.href=${JSON.stringify(deepLink)};</script>
<style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#FAF7F2;color:#1a0a00;padding:24px;text-align:center}
.icon{width:72px;height:72px;border-radius:36px;background:${color}20;display:flex;align-items:center;justify-content:center;font-size:32px;color:${color};margin:0 auto 20px}
h1{color:${color};margin:0 0 12px}p{color:#8A7060;max-width:340px;margin:0}</style></head>
<body><div class="icon">${icon}</div><h1>${title}</h1><p>${message}</p></body></html>`;
}

function errorPage(title: string, message: string) {
  return `<!DOCTYPE html><html><head><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#FAF7F2;color:#1a0a00;padding:24px;text-align:center}h1{color:#6B3A2A}p{color:#8A7060;max-width:340px}</style></head><body><h1>${title}</h1><p>${message}</p></body></html>`;
}

router.get("/oauth/square/start", async (req, res) => {
  const { cafeId, token, mobile } = req.query as { cafeId?: string; token?: string; mobile?: string };
  if (!SQUARE_APP_ID || !SQUARE_APP_SECRET) return res.status(503).send(errorPage("Square not configured", "Square OAuth credentials are not set on this server."));
  if (!cafeId || !token) return res.status(400).send(errorPage("Missing parameters", "cafeId and token are required."));
  const userId = await verifyToken(token).catch(() => null);
  if (!userId) return res.status(401).send(errorPage("Unauthorised", "Invalid or expired session."));
  const owns = await assertCafeOwnerById(cafeId, userId);
  if (!owns) return res.status(403).send(errorPage("Forbidden", "You do not own this café."));
  const nonce = createHmac("sha256", getStateSecret()).update(`${cafeId}${userId}${Date.now()}`).digest("hex").slice(0, 16);
  const state = signState({ cafeId, userId, nonce });
  const redirectUri = mobile === "1" ? SQUARE_MOBILE_REDIRECT : `${getBaseUrl(req)}/api/valuation/oauth/square/callback`;
  const params = new URLSearchParams({ client_id: SQUARE_APP_ID, scope: "MERCHANT_PROFILE_READ ORDERS_READ PAYMENTS_READ ITEMS_READ", state, redirect_uri: redirectUri });
  return res.redirect(`https://connect.squareup.com/oauth2/authorize?${params}`);
});

router.get("/oauth/square/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error) return res.redirect(`${getBaseUrl(req)}/api/valuation/oauth/done?provider=square&status=error&detail=${encodeURIComponent(error)}`);
  if (!code) return res.redirect(`${getBaseUrl(req)}/api/valuation/oauth/done?provider=square&status=error&detail=missing_code`);
  let cafeId: string, userId: string;
  try { const parsed = verifyState(state); cafeId = parsed.cafeId; userId = parsed.userId; }
  catch { return res.status(400).send(errorPage("Invalid state", "OAuth state signature is invalid or tampered.")); }
  const owns = await assertCafeOwnerById(cafeId, userId);
  if (!owns) return res.redirect(`${getBaseUrl(req)}/api/valuation/oauth/done?provider=square&status=error&detail=access_denied`);
  const baseUrl = getBaseUrl(req);
  const tokenRes = await fetch("https://connect.squareup.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": "2024-01-17" },
    body: JSON.stringify({ client_id: SQUARE_APP_ID, client_secret: SQUARE_APP_SECRET, code, grant_type: "authorization_code", redirect_uri: `${baseUrl}/api/valuation/oauth/square/callback` }),
  });
  if (!tokenRes.ok) { const errBody = await tokenRes.text(); return res.redirect(`${baseUrl}/api/valuation/oauth/done?provider=square&status=error&detail=${encodeURIComponent(errBody.slice(0, 120))}`); }
  const tokenData = await tokenRes.json() as any;
  let merchantName = "", merchantId = tokenData.merchant_id;
  try {
    const meRes = await fetch("https://connect.squareup.com/v2/merchants/me", { headers: { Authorization: `Bearer ${tokenData.access_token}`, "Square-Version": "2024-01-17" } });
    if (meRes.ok) { const meData = await meRes.json() as any; merchantName = meData.merchant?.business_name ?? ""; merchantId = meData.merchant?.id ?? merchantId; }
  } catch {}
  await upsertIntegration(cafeId, userId, "square", { status: "connected", merchantId, merchantName, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, tokenExpiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : null });
  return res.redirect(`${baseUrl}/api/valuation/oauth/done?provider=square&status=success`);
});

router.get("/oauth/xero/start", async (req, res) => {
  const { cafeId, token, mobile } = req.query as { cafeId?: string; token?: string; mobile?: string };
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) return res.status(503).send(errorPage("Xero not configured", "Xero OAuth credentials are not set on this server."));
  if (!cafeId || !token) return res.status(400).send(errorPage("Missing parameters", "cafeId and token are required."));
  const userId = await verifyToken(token).catch(() => null);
  if (!userId) return res.status(401).send(errorPage("Unauthorised", "Invalid or expired session."));
  const owns = await assertCafeOwnerById(cafeId, userId);
  if (!owns) return res.status(403).send(errorPage("Forbidden", "You do not own this café."));
  const nonce = createHmac("sha256", getStateSecret()).update(`${cafeId}${userId}${Date.now()}`).digest("hex").slice(0, 16);
  const state = signState({ cafeId, userId, nonce });
  const redirectUri = mobile === "1" ? XERO_MOBILE_REDIRECT : `${getBaseUrl(req)}/api/valuation/oauth/xero/callback`;
  const params = new URLSearchParams({ response_type: "code", client_id: XERO_CLIENT_ID, redirect_uri: redirectUri, scope: "openid profile email offline_access accounting.transactions accounting.contacts", state });
  return res.redirect(`https://login.xero.com/identity/connect/authorize?${params}`);
});

router.get("/oauth/xero/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error) return res.redirect(`${getBaseUrl(req)}/api/valuation/oauth/done?provider=xero&status=error&detail=${encodeURIComponent(error)}`);
  let cafeId: string, userId: string;
  try { const parsed = verifyState(state); cafeId = parsed.cafeId; userId = parsed.userId; }
  catch { return res.status(400).send(errorPage("Invalid state", "OAuth state signature is invalid or tampered.")); }
  const owns = await assertCafeOwnerById(cafeId, userId);
  if (!owns) return res.redirect(`${getBaseUrl(req)}/api/valuation/oauth/done?provider=xero&status=error&detail=access_denied`);
  const baseUrl = getBaseUrl(req);
  const credentials = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${baseUrl}/api/valuation/oauth/xero/callback` }),
  });
  if (!tokenRes.ok) { return res.redirect(`${baseUrl}/api/valuation/oauth/done?provider=xero&status=error`); }
  const tokenData = await tokenRes.json() as any;
  let orgName = "", tenantId = "";
  try {
    const tenantsRes = await fetch("https://api.xero.com/connections", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    if (tenantsRes.ok) { const tenants = await tenantsRes.json() as any[]; if (tenants.length > 0) { orgName = tenants[0].tenantName ?? ""; tenantId = tenants[0].tenantId ?? ""; } }
  } catch {}
  await upsertIntegration(cafeId, userId, "xero", { status: "connected", merchantName: orgName, metadata: { tenant_id: tenantId }, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000) });
  return res.redirect(`${baseUrl}/api/valuation/oauth/done?provider=xero&status=success`);
});

router.post("/oauth/square/mobile-exchange", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { code, state } = req.body as { code?: string; state?: string };
  if (!SQUARE_APP_ID || !SQUARE_APP_SECRET) return res.status(503).json({ error: "Square not configured" });
  if (!code || !state) return res.status(400).json({ error: "code and state required" });
  let cafeId: string;
  try { const parsed = verifyState(state); cafeId = parsed.cafeId; if (parsed.userId !== userId) throw new Error("user mismatch"); }
  catch { return res.status(400).json({ error: "Invalid state" }); }
  const owns = await assertCafeOwnerById(cafeId, userId);
  if (!owns) return res.status(403).json({ error: "Access denied" });
  const tokenRes = await fetch("https://connect.squareup.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": "2024-01-17" },
    body: JSON.stringify({ client_id: SQUARE_APP_ID, client_secret: SQUARE_APP_SECRET, code, grant_type: "authorization_code", redirect_uri: SQUARE_MOBILE_REDIRECT }),
  });
  if (!tokenRes.ok) { const err = await tokenRes.text(); return res.status(400).json({ error: err.slice(0, 200) }); }
  const tokenData = await tokenRes.json() as any;
  let merchantName = "", merchantId = tokenData.merchant_id;
  try {
    const meRes = await fetch("https://connect.squareup.com/v2/merchants/me", { headers: { Authorization: `Bearer ${tokenData.access_token}`, "Square-Version": "2024-01-17" } });
    if (meRes.ok) { const meData = await meRes.json() as any; merchantName = meData.merchant?.business_name ?? ""; merchantId = meData.merchant?.id ?? merchantId; }
  } catch {}
  await upsertIntegration(cafeId, userId, "square", { status: "connected", merchantId, merchantName, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, tokenExpiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : null });
  return res.json({ ok: true, merchantName });
});

router.post("/oauth/xero/mobile-exchange", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { code, state } = req.body as { code?: string; state?: string };
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) return res.status(503).json({ error: "Xero not configured" });
  if (!code || !state) return res.status(400).json({ error: "code and state required" });
  let cafeId: string;
  try { const parsed = verifyState(state); cafeId = parsed.cafeId; if (parsed.userId !== userId) throw new Error("user mismatch"); }
  catch { return res.status(400).json({ error: "Invalid state" }); }
  const owns = await assertCafeOwnerById(cafeId, userId);
  if (!owns) return res.status(403).json({ error: "Access denied" });
  const credentials = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: XERO_MOBILE_REDIRECT }),
  });
  if (!tokenRes.ok) { return res.status(400).json({ error: "Token exchange failed" }); }
  const tokenData = await tokenRes.json() as any;
  let orgName = "", tenantId = "";
  try {
    const tenantsRes = await fetch("https://api.xero.com/connections", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    if (tenantsRes.ok) { const tenants = await tenantsRes.json() as any[]; if (tenants.length > 0) { orgName = tenants[0].tenantName ?? ""; tenantId = tenants[0].tenantId ?? ""; } }
  } catch {}
  await upsertIntegration(cafeId, userId, "xero", { status: "connected", merchantName: orgName, metadata: { tenant_id: tenantId }, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000) });
  return res.json({ ok: true, orgName });
});

router.get("/oauth/done", (req, res) => {
  const { provider, status, detail } = req.query as Record<string, string>;
  const ok = status === "success";
  const name = provider === "square" ? "Square" : "Xero";
  return res.send(donePage(ok ? "Connected!" : "Connection failed", ok ? `${name} was connected successfully. You can close this window.` : `Could not connect ${name}${detail ? `: ${detail}` : ""}. Please try again.`, ok, provider ?? "", detail ?? ""));
});

router.delete("/integrations/:integrationId/disconnect", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const integrationId = req.params["integrationId"] as string;
  const [integration] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.id, integrationId), eq(cafeIntegrationsTable.ownerId, userId)));
  if (!integration) return res.status(404).json({ error: "Integration not found" });
  await db.update(cafeIntegrationsTable).set({ status: "disconnected", accessToken: null, refreshToken: null, tokenExpiresAt: null }).where(and(eq(cafeIntegrationsTable.id, integrationId), eq(cafeIntegrationsTable.ownerId, userId)));
  return res.json({ ok: true });
});

export default router;
