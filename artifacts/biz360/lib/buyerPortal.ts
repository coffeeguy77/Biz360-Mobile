import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./apiStore";

/**
 * In-app buyer portal data layer.
 *
 * The app authenticates a buyer with a phone-verified "biz360 auth token"
 * (stored as `biz360_auth_token`). The buyer portal endpoints, however, expect
 * a dedicated `buyer_portal` JWT. `POST /api/buyer-portal/link` exchanges the
 * biz360 auth token for a buyer portal token (no second SMS), which we cache.
 *
 * This mirrors the web portal (exit360-web/src/pages/buyers-portal.tsx) so a
 * buyer sees the same granted listings, report access and email verification
 * status on either platform.
 */

const AUTH_TOKEN_KEY   = "biz360_auth_token";
const PORTAL_TOKEN_KEY = "biz360_buyer_portal_token";

export interface PortalPermissions {
  canViewImReport: boolean;
  canViewWalkthrough: boolean;
  canViewFinancials: boolean;
  canViewEquipment: boolean;
}

export interface PortalListing {
  cafeId: string;
  listingId: string | null;
  businessName: string;
  city: string | null;
  businessType: string;
  heroImageUrl: string | null;
  permissions: PortalPermissions;
  accessToken: string | null;
}

export interface MyAccessResponse {
  listings: PortalListing[];
  phone: string | null;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
}

async function getAuthToken(): Promise<string | null> {
  try { return await AsyncStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

/**
 * Exchange the phone-verified biz360 auth token for a buyer_portal token.
 * Returns null if the user isn't signed in or the exchange fails.
 */
async function linkPortalToken(name?: string): Promise<string | null> {
  const auth = await getAuthToken();
  if (!auth) return null;
  try {
    const res = await fetch(`${API_BASE}/buyer-portal/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ name: name ?? undefined }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { token?: string };
    if (!json.token) return null;
    await AsyncStorage.setItem(PORTAL_TOKEN_KEY, json.token);
    return json.token;
  } catch {
    return null;
  }
}

/** Get a usable buyer portal token — cached, else freshly linked. */
export async function getPortalToken(opts?: { forceRefresh?: boolean; name?: string }): Promise<string | null> {
  if (!opts?.forceRefresh) {
    try {
      const cached = await AsyncStorage.getItem(PORTAL_TOKEN_KEY);
      if (cached) return cached;
    } catch { /* fall through to link */ }
  }
  return linkPortalToken(opts?.name);
}

export async function clearPortalToken(): Promise<void> {
  try { await AsyncStorage.removeItem(PORTAL_TOKEN_KEY); } catch { /* ignore */ }
}

/** Is the buyer signed in (phone-verified) at all? */
export async function isSignedIn(): Promise<boolean> {
  return !!(await getAuthToken());
}

const EMPTY: MyAccessResponse = { listings: [], phone: null, name: null, email: null, emailVerified: false };

/**
 * Fetch the buyer's granted listings + email status. Transparently re-links the
 * portal token once if the cached one is rejected (expired). Returns EMPTY when
 * the buyer isn't signed in.
 */
export async function fetchMyAccess(name?: string): Promise<MyAccessResponse> {
  let token = await getPortalToken({ name });
  if (!token) return EMPTY;

  const call = async (t: string) =>
    fetch(`${API_BASE}/buyer-portal/my-access`, {
      headers: { Authorization: `Bearer ${t}` },
    });

  let res = await call(token);
  if (res.status === 401) {
    // cached token stale — force a fresh link and retry once
    token = await getPortalToken({ forceRefresh: true, name });
    if (!token) return EMPTY;
    res = await call(token);
  }
  if (!res.ok) return EMPTY;
  try {
    const json = (await res.json()) as MyAccessResponse;
    return {
      listings: Array.isArray(json.listings) ? json.listings : [],
      phone: json.phone ?? null,
      name: json.name ?? null,
      email: json.email ?? null,
      emailVerified: !!json.emailVerified,
    };
  } catch {
    return EMPTY;
  }
}

/** Set / update the buyer's email (triggers a verification email server-side). */
export async function setBuyerEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getPortalToken();
  if (!token) return { ok: false, error: "Not signed in" };
  try {
    const res = await fetch(`${API_BASE}/buyer-portal/email/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) return { ok: false, error: json.error ?? "Couldn't save email" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/**
 * Build the URL of the buyer's confidential web report for a granted listing.
 * The report is a web page served from the same host as the API; opening it in
 * an in-app browser keeps the native feel while reusing the full web report.
 */
export function reportUrl(listing: PortalListing): string | null {
  if (!listing.listingId || !listing.accessToken) return null;
  const origin = API_BASE.replace(/\/api\/?$/, "");
  return `${origin}/reports/${listing.listingId}?accessToken=${encodeURIComponent(listing.accessToken)}`;
}

/** Public 360° business listing URL (walkthrough). */
export function listingUrl(listing: PortalListing): string | null {
  if (!listing.listingId) return null;
  const origin = API_BASE.replace(/\/api\/?$/, "");
  return `${origin}/listings/${listing.listingId}`;
}
