import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";

// ─── val_cafes ──────────────────────────────────────────────────────────────

export const cafesTable = pgTable("val_cafes", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  city: text("city"),
  businessType: text("business_type").default("cafe"),
  currency: text("currency").default("AUD"),
  timezone: text("timezone"),
  listingId: text("listing_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Cafe = typeof cafesTable.$inferSelect;

// ─── val_business_units ─────────────────────────────────────────────────────

export const businessUnitsTable = pgTable(
  "val_business_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").notNull(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    revenueSharePct: numeric("revenue_share_pct").notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
  ]
);

export type BusinessUnit = typeof businessUnitsTable.$inferSelect;

// ─── val_cafe_integrations ──────────────────────────────────────────────────

export const cafeIntegrationsTable = pgTable(
  "val_cafe_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").notNull(),
    ownerId: text("owner_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("disconnected"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    merchantId: text("merchant_id"),
    merchantName: text("merchant_name"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
  ]
);

export type CafeIntegration = typeof cafeIntegrationsTable.$inferSelect;

// ─── val_cafe_equipment ─────────────────────────────────────────────────────

export const cafeEquipmentTable = pgTable(
  "val_cafe_equipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").notNull(),
    ownerId: text("owner_id").notNull(),
    unitId: uuid("unit_id"),
    name: text("name").notNull(),
    purchasePrice: numeric("purchase_price"),
    currentValue: numeric("current_value"),
    valuationMode: text("valuation_mode").default("purchase"),
    isLeased: boolean("is_leased").default(false),
    suspended: boolean("suspended").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
    foreignKey({ columns: [t.unitId], foreignColumns: [businessUnitsTable.id] }).onDelete("cascade"),
  ]
);

export type CafeEquipment = typeof cafeEquipmentTable.$inferSelect;

// ─── val_owner_adjustments ──────────────────────────────────────────────────

export const ownerAdjustmentsTable = pgTable(
  "val_owner_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").notNull(),
    ownerId: text("owner_id").notNull(),
    unitId: uuid("unit_id"),
    label: text("label").notNull(),
    annualAmount: numeric("annual_amount").notNull(),
    description: jsonb("description"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
    foreignKey({ columns: [t.unitId], foreignColumns: [businessUnitsTable.id] }).onDelete("cascade"),
  ]
);

export type OwnerAdjustment = typeof ownerAdjustmentsTable.$inferSelect;

// ─── val_snapshots ──────────────────────────────────────────────────────────

export const valuationSnapshotsTable = pgTable(
  "val_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").notNull(),
    ownerId: text("owner_id").notNull(),
    unitId: uuid("unit_id"),
    snapshotDate: date("snapshot_date"),
    periodMonths: integer("period_months"),
    grossRevenue: numeric("gross_revenue"),
    cogs: numeric("cogs"),
    grossProfit: numeric("gross_profit"),
    xeroTotalExpenses: numeric("xero_total_expenses"),
    xeroTotalRevenue: numeric("xero_total_revenue"),
    ebitda: numeric("ebitda"),
    adjustedEbitda: numeric("adjusted_ebitda"),
    valuationMidpoint: numeric("valuation_midpoint"),
    totalEquipmentValue: numeric("total_equipment_value"),
    squareRevenue: numeric("square_revenue"),
    xeroRevenue: numeric("xero_revenue"),
    isPublished: boolean("is_published").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
    foreignKey({ columns: [t.unitId], foreignColumns: [businessUnitsTable.id] }).onDelete("cascade"),
  ]
);

export type ValuationSnapshot = typeof valuationSnapshotsTable.$inferSelect;

// ─── val_square_orders_cache ────────────────────────────────────────────────

export const squareOrdersCacheTable = pgTable(
  "val_square_orders_cache",
  {
    cafeId: uuid("cafe_id").notNull(),
    ownerId: text("owner_id").notNull(),
    orderDate: date("order_date").notNull(),
    grossAmount: numeric("gross_amount"),
    netAmount: numeric("net_amount"),
    orderCount: integer("order_count"),
  },
  (t) => [
    primaryKey({ columns: [t.cafeId, t.orderDate] }),
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
  ]
);

// ─── val_xero_pl_mappings ───────────────────────────────────────────────────

export const xeroPLMappingsTable = pgTable(
  "val_xero_pl_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").notNull(),
    ownerId: text("owner_id").notNull(),
    unitId: uuid("unit_id"),
    accountCode: text("account_code"),
    accountName: text("account_name"),
    isIncluded: boolean("is_included").default(true),
    section: text("section"),
  },
  (t) => [
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
    foreignKey({ columns: [t.unitId], foreignColumns: [businessUnitsTable.id] }).onDelete("cascade"),
  ]
);

export type XeroPLMapping = typeof xeroPLMappingsTable.$inferSelect;

// ─── val_xero_supplier_mappings ─────────────────────────────────────────────

export const xeroSupplierMappingsTable = pgTable(
  "val_xero_supplier_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cafeId: uuid("cafe_id").notNull(),
    ownerId: text("owner_id").notNull(),
    unitId: uuid("unit_id"),
    contactId: text("contact_id"),
    contactName: text("contact_name"),
    isCogs: boolean("is_cogs").default(false),
  },
  (t) => [
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
    foreignKey({ columns: [t.unitId], foreignColumns: [businessUnitsTable.id] }).onDelete("cascade"),
  ]
);

export type XeroSupplierMapping = typeof xeroSupplierMappingsTable.$inferSelect;
