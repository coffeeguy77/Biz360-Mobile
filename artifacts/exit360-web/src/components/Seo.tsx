import { useEffect } from "react";

interface SeoProps {
  title: string;
  description: string;
  keywords?: string;
  path?: string;          // canonical path, e.g. "/selling"
  image?: string;
  type?: string;          // og:type
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE = "https://exit360.com.au";
const DEFAULT_IMG = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1200";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Client-side SEO head manager. Sets title, meta description, keywords, canonical,
 * Open Graph / Twitter cards and optional JSON-LD structured data per page.
 */
export function Seo({ title, description, keywords, path = "/", image = DEFAULT_IMG, type = "website", jsonLd }: SeoProps) {
  useEffect(() => {
    const url = `${SITE}${path}`;
    document.title = title;
    upsertMeta("name", "description", description);
    if (keywords) upsertMeta("name", "keywords", keywords);
    upsertLink("canonical", url);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    const id = "page-jsonld";
    document.getElementById(id)?.remove();
    if (jsonLd) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = id;
      s.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(s);
    }
    window.scrollTo(0, 0);
    return () => { document.getElementById(id)?.remove(); };
  }, [title, description, keywords, path, image, type, jsonLd]);

  return null;
}
