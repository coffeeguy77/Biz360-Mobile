import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const reportAccessModeEnum = pgEnum("report_access_mode", [
  "public",
  "users",
  "password",
  "users_and_password",
]);

export const reportAccessSettingsTable = pgTable("report_access_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: text("listing_id").notNull().unique(),
  accessMode: reportAccessModeEnum("access_mode").notNull().default("public"),
  passwordHash: text("password_hash"),
  smsUnlockEnabled: boolean("sms_unlock_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ReportAccessSettings = typeof reportAccessSettingsTable.$inferSelect;

export const reportAccessGrantsTable = pgTable("report_access_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: text("listing_id").notNull(),
  phone: text("phone").notNull(),
  grantedBy: text("granted_by").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ReportAccessGrant = typeof reportAccessGrantsTable.$inferSelect;

export const reportViewEventsTable = pgTable("report_view_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: text("listing_id").notNull(),
  viewerPhone: text("viewer_phone"),
  viewerIp: text("viewer_ip"),
  userAgent: text("user_agent"),
  documentType: text("document_type").notNull().default("financials"),
  openedAt: timestamp("opened_at").defaultNow(),
});

export type ReportViewEvent = typeof reportViewEventsTable.$inferSelect;
