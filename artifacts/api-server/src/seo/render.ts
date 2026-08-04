import { db, kvStore } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSiteSettings, SITE_URL, extractGscToken, type PageSeo } from "./site-settings";

const LISTINGS_KEY = "biz360_admin_pending_v2";

export interface ResolvedSeo {
  title: string;
  description: string;
  keywords?: string | null;
  ogImageAlt?: string | null;
  canonical: string;
  ogImage: string;
  ogType: string;
  noindex: boolean;
  jsonLd?: Record<string, unknown> | null;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getAllListings(): Promise<any[]> {
  try {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, LISTINGS_KEY));
    return Array.isArray(rows[0]?.value) ? (rows[0]!.value as any[]) : [];
  } catch {
    return [];
  }
}

function firstWebImage(l: any): string | null {
  const photos = Array.isArray(l.photos) ? l.photos : [];
  return photos.find((p: any) => typeof p === "string" && /^https?:\/\//.test(p)) ?? null;
}

/** Public + crawlable = approved, not suspended, and not flagged noindex. */
export function isListingIndexable(l: any): boolean {
  return !!l && l.status === "approved" && !l.suspended && l.seoIndexable !== false && !!l.listingId;
}

/** Marketing page titles used when no admin override exists. */
const PAGE_DEFAULTS: Record<string, { title: string; description?: string }> = {
  "/": { title: "EXIT360 — Buy & Sell Businesses with 360° Virtual Tours" },
  "/listings": { title: "Businesses for sale — browse 360° virtual tours", description: "Browse verified businesses for sale across Australia with immersive 360° virtual walkthroughs on EXIT360." },
  "/buying": { title: "Buying a business", description: "How to buy a business the smart way — walk through with a 360° virtual tour before you sign." },
  "/selling": { title: "Sell your business", description: "List your business for sale with a 360° virtual tour and reach serious, verified buyers on EXIT360." },
  "/brokers": { title: "For business brokers", description: "Win more listings and close faster with immersive 360° virtual tours for every business you represent." },
  "/walkthroughs": { title: "360° business walkthroughs", description: "See how immersive 360° virtual tours let buyers explore a business before they enquire." },
  "/how-it-works": { title: "How EXIT360 works", description: "How EXIT360 connects serious buyers with transparent sellers using 360° virtual tours and verified financials." },
  "/compare": { title: "Compare EXIT360", description: "See how EXIT360 compares for buying and selling businesses online." },
  "/list-your-business": { title: "List your business for sale", description: "Create your listing and 360° virtual tour to reach verified buyers on EXIT360." },
  "/photographers": { title: "360° photographers & partners", description: "Become an EXIT360 capture partner and photograph businesses in immersive 360°." },
  "/find-a-partner": { title: "Find a capture partner", description: "Find an EXIT360 partner near you to capture your business in 360°." },
  "/sign-in": { title: "Sign in", description: "Sign in to EXIT360." },
  "/buyers": { title: "Buyer sign in", description: "Sign in to your EXIT360 buyer portal." },
};

export async function resolveSeo(pathname: string): Promise<ResolvedSeo> {
  const settings = await getSiteSettings();
  const { defaults } = settings;
  const suffix = defaults.titleSuffix ?? "";
  const override: PageSeo | undefined = settings.pages[pathname];

  // ── Listing detail: /listings/:id ──
  const m = pathname.match(/^\/listings\/([^/]+)\/?$/);
  if (m) {
    const listings = await getAllListings();
    const l = listings.find((x) => x.listingId === decodeURIComponent(m[1]));
    if (l) {
      const indexable = isListingIndexable(l);
      const loc = [l.suburb, l.state].filter((v) => v && v !== "Unknown").join(", ");
      const name = l.businessName || "Business for sale";
      const priceBits = l.askingPrice ? ` Asking $${Number(l.askingPrice).toLocaleString()}.` : "";
      const desc = (l.description && String(l.description).trim())
        ? String(l.description).replace(/\s+/g, " ").slice(0, 200)
        : `${name}${loc ? ` in ${loc}` : ""} for sale on EXIT360.${priceBits} Explore the 360° virtual tour and verified figures.`;
      return {
        title: `${name}${loc ? ` — business for sale in ${loc}` : " — business for sale"}${suffix}`,
        description: desc,
        canonical: `${SITE_URL}${pathname}`,
        ogImage: firstWebImage(l) || defaults.defaultOgImage,
        ogType: "website",
        noindex: !indexable,
        jsonLd: indexable ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          description: desc,
          ...(firstWebImage(l) ? { image: firstWebImage(l) } : {}),
          ...(l.askingPrice ? { offers: { "@type": "Offer", price: Number(l.askingPrice), priceCurrency: "AUD", availability: "https://schema.org/InStock" } } : {}),
          url: `${SITE_URL}${pathname}`,
        } : null,
      };
    }
    // Unknown listing → noindex, generic
    return { title: `Business for sale${suffix}`, description: defaults.defaultDescription, canonical: `${SITE_URL}${pathname}`, ogImage: defaults.defaultOgImage, ogType: "website", noindex: true, jsonLd: null };
  }

  // ── Report pages are gated content → never index ──
  if (/^\/reports\//.test(pathname)) {
    return { title: `Confidential report${suffix}`, description: "Confidential business information memorandum.", canonical: `${SITE_URL}${pathname}`, ogImage: defaults.defaultOgImage, ogType: "website", noindex: true, jsonLd: null };
  }

  // ── Seller/admin/portal areas → never index ──
  if (/^\/(seller|manage|buyers\/portal)(\/|$)/.test(pathname)) {
    return { title: `EXIT360`, description: defaults.defaultDescription, canonical: `${SITE_URL}${pathname}`, ogImage: defaults.defaultOgImage, ogType: "website", noindex: true, jsonLd: null };
  }

  // ── Marketing / static pages: admin override → page defaults → site defaults ──
  const pd = PAGE_DEFAULTS[pathname];
  const title = override?.title || pd?.title || `EXIT360${suffix ? "" : ""}`;
  const finalTitle = /EXIT360/i.test(title) ? title : `${title}${suffix}`;
  return {
    title: finalTitle,
    description: override?.description || pd?.description || defaults.defaultDescription,
    keywords: override?.keywords || null,
    ogImageAlt: override?.ogImageAlt || null,
    canonical: override?.canonical || `${SITE_URL}${pathname === "/" ? "/" : pathname}`,
    ogImage: override?.ogImage || defaults.defaultOgImage,
    ogType: pathname === "/" ? "website" : "website",
    noindex: override?.noindex ?? false,
    jsonLd: pathname === "/" ? {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "EXIT360",
      url: SITE_URL,
      description: defaults.defaultDescription,
    } : null,
  };
}

/** Inject resolved SEO tags into the built index.html without touching Vite's asset tags. */
export async function injectMeta(html: string, pathname: string): Promise<string> {
  const seo = await resolveSeo(pathname);
  const settings = await getSiteSettings();
  const gsc = extractGscToken(settings.gsc?.metaToken);

  let out = html;
  // Replace <title>
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seo.title)}</title>`);
  // Replace core metas if present
  out = out.replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${esc(seo.description)}" />`);
  out = out.replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(seo.title)}" />`);
  out = out.replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${esc(seo.description)}" />`);
  out = out.replace(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${esc(seo.canonical)}" />`);
  out = out.replace(/<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${esc(seo.ogImage)}" />`);
  out = out.replace(/<meta\s+property="og:type"[^>]*>/i, `<meta property="og:type" content="${esc(seo.ogType)}" />`);
  // Remove the static JSON-LD block (we inject a fresh, route-specific one)
  out = out.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i, "");

  const extra: string[] = [];
  extra.push(`<link rel="canonical" href="${esc(seo.canonical)}" />`);
  extra.push(`<meta name="robots" content="${seo.noindex ? "noindex, nofollow" : "index, follow"}" />`);
  extra.push(`<meta name="twitter:title" content="${esc(seo.title)}" />`);
  extra.push(`<meta name="twitter:description" content="${esc(seo.description)}" />`);
  extra.push(`<meta name="twitter:image" content="${esc(seo.ogImage)}" />`);
  if (seo.keywords) extra.push(`<meta name="keywords" content="${esc(seo.keywords)}" />`);
  if (seo.ogImageAlt) extra.push(`<meta property="og:image:alt" content="${esc(seo.ogImageAlt)}" />`);
  if (gsc) extra.push(`<meta name="google-site-verification" content="${esc(gsc)}" />`);
  if (seo.jsonLd) extra.push(`<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>`);
  // Editable marketing copy overrides — injected synchronously so pages render
  // admin-edited copy on first paint (no flash of default text).
  const copyMap: Record<string, Record<string, string>> = {};
  const contentMap: Record<string, unknown> = {};
  for (const [p, pg] of Object.entries(settings.pages ?? {})) {
    if (pg?.copy && Object.keys(pg.copy).length) copyMap[p] = pg.copy;
    if ((pg as any)?.content && Object.keys((pg as any).content).length) contentMap[p] = (pg as any).content;
  }
  if (Object.keys(copyMap).length) {
    extra.push(`<script>window.__EXIT360_COPY__=${JSON.stringify(copyMap).replace(/</g, "\\u003c")}</script>`);
  }
  if (Object.keys(contentMap).length) {
    extra.push(`<script>window.__EXIT360_CONTENT__=${JSON.stringify(contentMap).replace(/</g, "\\u003c")}</script>`);
  }

  out = out.replace(/<\/head>/i, `${extra.join("\n    ")}\n  </head>`);
  return out;
}

/** Build sitemap.xml from marketing pages + all indexable listings. */
export async function buildSitemap(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls: { loc: string; changefreq: string; priority: string }[] = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/listings", changefreq: "hourly", priority: "0.9" },
    { loc: "/buying", changefreq: "weekly", priority: "0.8" },
    { loc: "/selling", changefreq: "weekly", priority: "0.8" },
    { loc: "/brokers", changefreq: "weekly", priority: "0.8" },
    { loc: "/walkthroughs", changefreq: "weekly", priority: "0.7" },
    { loc: "/how-it-works", changefreq: "weekly", priority: "0.7" },
    { loc: "/compare", changefreq: "weekly", priority: "0.7" },
    { loc: "/list-your-business", changefreq: "weekly", priority: "0.8" },
    { loc: "/photographers", changefreq: "weekly", priority: "0.7" },
    { loc: "/find-a-partner", changefreq: "weekly", priority: "0.7" },
  ];

  const listings = (await getAllListings()).filter(isListingIndexable);
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const u of staticUrls) {
    parts.push(`  <url><loc>${SITE_URL}${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority><lastmod>${today}</lastmod></url>`);
  }
  for (const l of listings) {
    const lastmod = l.updatedAt || l.submittedAt ? new Date(l.updatedAt ?? l.submittedAt).toISOString().slice(0, 10) : today;
    parts.push(`  <url><loc>${SITE_URL}/listings/${encodeURIComponent(l.listingId)}</loc><changefreq>daily</changefreq><priority>0.8</priority><lastmod>${lastmod}</lastmod></url>`);
  }
  parts.push("</urlset>");
  return parts.join("\n");
}

export function buildRobots(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /manage",
    "Disallow: /seller",
    "Disallow: /reports/",
    "Disallow: /buyers/portal",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}
