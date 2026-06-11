import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── lease_templates ──────────────────────────────────────────────────────────
// Stores master lease templates extracted from uploaded documents.
// template_content: JSON string of the extracted clauses (Clause[] shape).
// variable_map: maps placeholder names (TENANT_NAME) → original document values.

export const leaseTemplatesTable = pgTable("lease_templates", {
  id:              uuid("id").primaryKey().defaultRandom(),
  name:            text("name").notNull(),
  jurisdiction:    text("jurisdiction"),
  leaseType:       text("lease_type"),
  premisesType:    text("premises_type"),
  templateContent: text("template_content").notNull(),
  variableMap:     jsonb("variable_map").$type<Record<string, string>>().notNull().default({}),
  isMaster:        boolean("is_master").notNull().default(false),
  createdByUserId: text("created_by_user_id"),
  createdAt:       timestamp("created_at").defaultNow(),
});

export type LeaseTemplate = typeof leaseTemplatesTable.$inferSelect;

// ─── lease_clauses_master ─────────────────────────────────────────────────────
// Shared clause library — one row per unique clause title+jurisdiction.
// Populated automatically when leases are analysed; also seeded with best-practice clauses.

export const leaseClausesMasterTable = pgTable(
  "lease_clauses_master",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    title:              text("title").notNull(),
    category:           text("category").notNull(),
    rating:             text("rating").notNull(),
    riskLevel:          text("risk_level").notNull(),
    plainEnglish:       text("plain_english").notNull(),
    originalText:       text("original_text").notNull(),
    suggestedText:      text("suggested_text"),
    jurisdiction:       text("jurisdiction"),
    cafeRelevanceScore: integer("cafe_relevance_score").notNull().default(3),
    negotiationScore:   integer("negotiation_score").notNull().default(3),
    isSeed:             boolean("is_seed").notNull().default(false),
    sourceTemplateId:   uuid("source_template_id"),
    createdAt:          timestamp("created_at").defaultNow(),
  },
  (t) => [
    uniqueIndex("lease_clauses_master_title_jurisdiction_idx").on(t.title, t.jurisdiction),
  ],
);

export type LeaseClauseMaster = typeof leaseClausesMasterTable.$inferSelect;
