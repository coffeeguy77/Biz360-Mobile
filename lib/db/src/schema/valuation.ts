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
  businessName: text("business_name"),
  title: text("title"),
  tradingName: text("trading_name"),
  city: text("city"),
  businessType: text("business_type").default("cafe"),
  currency: text("currency").default("AUD"),
  timezone: text("timezone"),
  listingId: text("listing_id"),
  slug: text("slug").unique(),
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
    isIncludedInSale: boolean("is_included_in_sale").notNull().default(true),
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
    category: text("category"),
    brand: text("brand"),
    purchaseDate: date("purchase_date"),
    condition: text("condition"),
    depreciationYears: integer("depreciation_years"),
    purchasePrice: numeric("purchase_price"),
    secondhandValue: numeric("secondhand_value"),
    replacementCost: numeric("replacement_cost"),
    currentValue: numeric("current_value"),
    valuationMode: text("valuation_mode").default("purchase"),
    ownership: text("ownership"),
    notes: text("notes"),
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

// ─── custom_reports ──────────────────────────────────────────────────────────
// Seller-created named financial reports that pull from Square/Xero data.
// Private by default; include_in_im controls whether a summary appears in the
// seller's IM report Financial Performance chapter.

export const customReportsTable = pgTable(
  "custom_reports",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    cafeId:          uuid("cafe_id").notNull(),
    ownerId:         text("owner_id").notNull(),
    name:            text("name").notNull(),
    description:     text("description"),
    dateRangeMonths: integer("date_range_months").notNull().default(12),
    includeInIm:     boolean("include_in_im").notNull().default(false),
    createdAt:       timestamp("created_at").defaultNow(),
    updatedAt:       timestamp("updated_at").defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.cafeId], foreignColumns: [cafesTable.id] }).onDelete("cascade"),
  ]
);

export type CustomReport = typeof customReportsTable.$inferSelect;

// ─── custom_report_line_items ─────────────────────────────────────────────────
// Each line item is one income or expense source the seller selected.
// source: 'xero_pl' — pulls from Xero P&L by account name
//         'square'  — uses Square order revenue totals

export const customReportLineItemsTable = pgTable(
  "custom_report_line_items",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    reportId:        uuid("report_id").notNull(),
    // kind: 'income' | 'expense'
    kind:            text("kind").notNull(),
    label:           text("label").notNull(),
    // source: 'xero_pl' | 'square'
    source:          text("source").notNull(),
    xeroAccountId:   text("xero_account_id"),
    xeroAccountName: text("xero_account_name"),
    sortOrder:       integer("sort_order").notNull().default(0),
    createdAt:       timestamp("created_at").defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.reportId], foreignColumns: [customReportsTable.id] }).onDelete("cascade"),
  ]
);

export type CustomReportLineItem = typeof customReportLineItemsTable.$inferSelect;
