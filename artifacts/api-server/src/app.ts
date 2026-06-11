import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { runCleanup } from "./routes/biz360";

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
setTimeout(scheduleCleanup, 30_000);

export default app;
