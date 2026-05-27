const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}/api` : "/api";

export async function apiGet<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/biz360/kv/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { value: T | null };
    return json.value;
  } catch {
    return null;
  }
}

export async function apiSet<T>(key: string, value: T): Promise<void> {
  await fetch(`${API_BASE}/biz360/kv/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}
