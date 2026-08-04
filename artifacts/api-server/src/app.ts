import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { runCleanup } from "./routes/biz360";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSitemap, buildRobots, injectMeta } from "./seo/render";
import { getSiteSettings } from "./seo/site-settings";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.text({ type: ["text/csv", "text/plain"], limit: "10mb" }));

app.use("/api", router);

// ─── Serve built front-end (exit360-web) ──────────────────────────────────────
// Vite builds the site to artifacts/exit360-web/dist/public. This server bundle
// runs from artifacts/api-server/dist/index.mjs, so resolve the web build
// relative to it (overridable via WEB_DIST_PATH).
const webDist =
  process.env.WEB_DIST_PATH ??
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../exit360-web/dist/public",
  );

// ─── SEO endpoints (must come BEFORE express.static so they win over stale
//     public/sitemap.xml & public/robots.txt, and to serve the GSC file) ──────
let sitemapCache: { xml: string; at: number } | null = null;
const SITEMAP_TTL_MS = 10 * 60 * 1000; // 10 minutes — always near-fresh, no cron

app.get("/sitemap.xml", async (_req, res) => {
  try {
    if (!sitemapCache || Date.now() - sitemapCache.at > SITEMAP_TTL_MS) {
      sitemapCache = { xml: await buildSitemap(), at: Date.now() };
    }
    res.type("application/xml").send(sitemapCache.xml);
  } catch {
    res.type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(buildRobots());
});

// Google Search Console HTML-file verification (filename + contents set in /manage)
app.get(/^\/google[0-9a-f]+\.html$/i, async (req, res, next) => {
  try {
    const settings = await getSiteSettings();
    const name = settings.gsc?.htmlFileName;
    if (name && req.path === `/${name}` && settings.gsc?.htmlFileContent) {
      return res.type("text/html").send(settings.gsc.htmlFileContent);
    }
  } catch { /* fall through */ }
  next();
});

// index:false so "/" falls through to the SPA fallback below and gets SEO meta
// injected, rather than express.static serving the raw index.html.
app.use(express.static(webDist, { index: false }));

// SPA fallback: serve index.html for any non-API GET/HEAD route so client-side
// routing works on deep links / hard refresh. Injects per-route SEO meta so
// crawlers (Google, Bing, social) get correct titles/OG tags without SSR.
let indexTemplate: string | null = null;
function getIndexTemplate(): string | null {
  if (indexTemplate) return indexTemplate;
  try { indexTemplate = fs.readFileSync(path.join(webDist, "index.html"), "utf8"); return indexTemplate; }
  catch { return null; }
}

app.use(async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api")) return next();
  const tpl = getIndexTemplate();
  if (!tpl) {
    return res.sendFile(path.join(webDist, "index.html"), (err) => { if (err) next(); });
  }
  try {
    const html = await injectMeta(tpl, req.path);
    res.type("html").send(html);
  } catch {
    res.type("html").send(tpl);
  }
});

// ─── Scheduled Cloudinary cleanup ─────────────────────────────────────────────
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24 h

async function scheduleCleanup() {
  try {
    const result = await runCleanup();
    if (result.purgedUsers.length || result.purgedListings.length) {
      logger.info({ ...result }, "Cloudinary cleanup completed");
    }
  } catch (err) {
    logger.error({ err }, "Cloudinary cleanup failed");
  }
  setTimeout(scheduleCleanup, CLEANUP_INTERVAL_MS);
}

// Run first pass 30 s after startup so the DB is ready, then every 24 h
// Only runs in production — never in local dev to avoid wiping assets on restart
if (process.env.NODE_ENV === "production") {
  setTimeout(scheduleCleanup, 30_000);
}

export default app;
