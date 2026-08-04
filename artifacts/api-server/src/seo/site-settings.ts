import { db, kvStore } from "@workspace/db";
import { eq } from "drizzle-orm";

export const SITE_URL = process.env.SITE_URL ?? "https://exit360.com.au";
const SETTINGS_KEY = "site_settings_v1";

export interface PageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
  noindex?: boolean;
  /** Editable marketing copy (Phase C) — arbitrary named text blocks. */
  copy?: Record<string, string>;
}

export interface SiteSettings {
  gsc: {
    /** google-site-verification token value (the `content` attr). */
    metaToken?: string | null;
    /** Full filename Google gives you, e.g. "google1234abcd.html". */
    htmlFileName?: string | null;
    /** Exact contents of that verification file. */
    htmlFileContent?: string | null;
  };
  defaults: {
    titleSuffix: string;
    defaultDescription: string;
    defaultOgImage: string;
  };
  /** Per-path SEO + copy overrides, keyed by pathname ("/", "/selling", …). */
  pages: Record<string, PageSeo>;
}

const DEFAULTS: SiteSettings = {
  gsc: { metaToken: null, htmlFileName: null, htmlFileContent: null },
  defaults: {
    titleSuffix: " | EXIT360",
    defaultDescription:
      "Discover verified businesses for sale with immersive 360° virtual tours. Walk through before you sign. EXIT360 connects serious buyers with transparent sellers across Australia.",
    defaultOgImage: `${SITE_URL}/opengraph.jpg`,
  },
  pages: {},
};

let cache: { value: SiteSettings; at: number } | null = null;
const TTL_MS = 30_000;

export async function getSiteSettings(force = false): Promise<SiteSettings> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, SETTINGS_KEY));
    const stored = (rows[0]?.value ?? {}) as Partial<SiteSettings>;
    const value: SiteSettings = {
      gsc: { ...DEFAULTS.gsc, ...(stored.gsc ?? {}) },
      defaults: { ...DEFAULTS.defaults, ...(stored.defaults ?? {}) },
      pages: stored.pages ?? {},
    };
    cache = { value, at: Date.now() };
    return value;
  } catch {
    return DEFAULTS;
  }
}

export async function saveSiteSettings(partial: Partial<SiteSettings>): Promise<SiteSettings> {
  const cur = await getSiteSettings(true);
  const next: SiteSettings = {
    gsc: { ...cur.gsc, ...(partial.gsc ?? {}) },
    defaults: { ...cur.defaults, ...(partial.defaults ?? {}) },
    pages: partial.pages ? { ...cur.pages, ...partial.pages } : cur.pages,
  };
  await db
    .insert(kvStore)
    .values({ key: SETTINGS_KEY, value: next })
    .onConflictDoUpdate({ target: kvStore.key, set: { value: next } });
  cache = { value: next, at: Date.now() };
  return next;
}

/** Merge/replace a single page's SEO+copy override. */
export async function savePageSeo(path: string, page: PageSeo): Promise<SiteSettings> {
  const cur = await getSiteSettings(true);
  const pages = { ...cur.pages, [path]: { ...(cur.pages[path] ?? {}), ...page } };
  return saveSiteSettings({ pages });
}

export function invalidateSettingsCache() {
  cache = null;
}
