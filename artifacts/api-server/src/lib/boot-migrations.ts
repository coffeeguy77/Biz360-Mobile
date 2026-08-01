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
  // NDA gate — ensure the enum + tables exist even if they were never migrated.
  `DO $$ BEGIN CREATE TYPE nda_mode AS ENUM ('none','required','third_party'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `CREATE TABLE IF NOT EXISTS nda_settings (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     listing_id text NOT NULL UNIQUE,
     nda_mode nda_mode NOT NULL DEFAULT 'none',
     third_party_url text,
     updated_at timestamp DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS nda_signatures (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     listing_id text NOT NULL,
     buyer_name text,
     buyer_phone text NOT NULL,
     buyer_ip text,
     user_agent text,
     nda_version text NOT NULL DEFAULT 'v1',
     otp_verified boolean NOT NULL DEFAULT true,
     signed_at timestamp DEFAULT now()
   )`,
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
