import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { runCleanup } from "./routes/biz360";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

app.use(express.static(webDist));

// SPA fallback: serve index.html for any non-API GET/HEAD route so client-side
// routing works on deep links / hard refresh. /api paths fall through to a 404.
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(webDist, "index.html"), (err) => {
    if (err) next();
  });
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
