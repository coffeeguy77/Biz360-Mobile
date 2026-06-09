import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const ndaModeEnum = pgEnum("nda_mode", ["none", "required", "third_party"]);

export const ndaSettingsTable = pgTable("nda_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: text("listing_id").notNull().unique(),
  ndaMode: ndaModeEnum("nda_mode").notNull().default("none"),
  thirdPartyUrl: text("third_party_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type NdaSettings = typeof ndaSettingsTable.$inferSelect;

export const ndaSignaturesTable = pgTable("nda_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: text("listing_id").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  buyerIp: text("buyer_ip"),
  userAgent: text("user_agent"),
  ndaVersion: text("nda_version").notNull().default("v1"),
  signedAt: timestamp("signed_at").defaultNow(),
});

export type NdaSignature = typeof ndaSignaturesTable.$inferSelect;
