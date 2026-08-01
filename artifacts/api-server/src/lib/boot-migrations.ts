import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent, additive schema tweaks run once at server startup against the
 * live database. Each statement uses IF NOT EXISTS so re-running is a no-op.
 * Wrapped so a failure (e.g. missing table) never blocks the server booting.
 */
const STATEMENTS: string[] = [
  `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS email text`,
  `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false`,
  `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS email_verify_token text`,
];

export async function runBootMigrations(): Promise<void> {
  for (const stmt of STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err) {
      logger.warn({ err, stmt }, "Boot migration statement failed (continuing)");
    }
  }
  logger.info("Boot migrations applied");
}
