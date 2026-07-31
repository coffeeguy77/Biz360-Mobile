import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Canonical buyer identity, keyed by phone number.
 * Both buyer flows resolve to one record here:
 *  - the public enquiry flow (/sign-in) upserts name + phone after SMS verify
 *  - the buyer portal login (/buyers) upserts phone on SMS verify
 * Seller-granted document access (buyer_portal_group_members) is matched by
 * the same phone, so an enquiring buyer and a portal buyer are the same person.
 */
export const buyersTable = pgTable("buyers", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Buyer = typeof buyersTable.$inferSelect;
