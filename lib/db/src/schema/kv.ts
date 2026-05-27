import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const kvStore = pgTable("kv_store", {
  key:       text("key").primaryKey(),
  value:     jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KvStoreRow = typeof kvStore.$inferSelect;
