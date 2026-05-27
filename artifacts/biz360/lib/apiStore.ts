const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}/api` : "/api";

const TIMEOUT_MS = 8000;

export async function apiGet<T>(key: string): Promise<T | null> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/biz360/kv/${encodeURIComponent(key)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { value: T | null };
    return json.value;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function apiSet<T>(key: string, value: T): Promise<void> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(`${API_BASE}/biz360/kv/${encodeURIComponent(key)}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ value }),
      signal:  controller.signal,
    });
  } catch {
    // non-critical — swallow timeout/network errors on writes
  } finally {
    clearTimeout(timer);
  }
}
