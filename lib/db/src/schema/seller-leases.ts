import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sellerLeasesTable = pgTable("seller_leases", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
               .default(sql`now()`)
               .notNull(),
});

export const sellerLeaseClausesTable = pgTable("seller_lease_clauses", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  leaseId:   text("lease_id")
               .notNull()
               .references(() => sellerLeasesTable.id, { onDelete: "cascade" }),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
               .default(sql`now()`)
               .notNull(),
});
