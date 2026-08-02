import app from "./app";
import { logger } from "./lib/logger";
import { runBootMigrations } from "./lib/boot-migrations";
import { runPhoneCleanup } from "./lib/cleanup-phone";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Apply additive schema tweaks against the live DB (idempotent, non-blocking).
  void runBootMigrations()
    // One-shot per-phone cleanup — only runs when CLEANUP_PHONE env is set.
    .then(() => runPhoneCleanup())
    .catch((err) => logger.error({ err }, "boot task failed"));
});
