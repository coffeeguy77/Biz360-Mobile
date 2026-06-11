CREATE TABLE "lease_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "jurisdiction" text,
  "lease_type" text,
  "premises_type" text,
  "template_content" text NOT NULL,
  "variable_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_master" boolean DEFAULT false NOT NULL,
  "source_analysis_id" text,
  "created_by_user_id" text,
  "created_at" timestamp DEFAULT now()
);

-- Partial unique index: one template per analysis UUID, NULLs excluded
-- (PostgreSQL treats NULLs as distinct in unique indexes, but WHERE IS NOT NULL
-- makes the intent explicit and avoids any ambiguity with partial null handling)
CREATE UNIQUE INDEX "lease_templates_source_analysis_id_idx"
  ON "lease_templates" ("source_analysis_id")
  WHERE source_analysis_id IS NOT NULL;

CREATE TABLE "lease_clauses_master" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "category" text NOT NULL,
  "rating" text NOT NULL,
  "risk_level" text NOT NULL,
  "plain_english" text NOT NULL,
  "original_text" text NOT NULL,
  "suggested_text" text,
  "jurisdiction" text,
  "cafe_relevance_score" integer DEFAULT 3 NOT NULL,
  "negotiation_score" integer DEFAULT 3 NOT NULL,
  "is_seed" boolean DEFAULT false NOT NULL,
  "source_template_id" uuid,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "lease_clauses_master_title_jurisdiction_idx"
  ON "lease_clauses_master" ("title", "jurisdiction");
