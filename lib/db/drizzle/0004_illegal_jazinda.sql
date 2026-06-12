CREATE TYPE "public"."nda_mode" AS ENUM('none', 'required', 'third_party');--> statement-breakpoint
CREATE TABLE "report_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"event_type" text NOT NULL,
	"section_key" text,
	"buyer_id" text,
	"buyer_phone" text,
	"buyer_ip" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_csv_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"file_name" text,
	"row_count" integer DEFAULT 0,
	"matched_count" integer DEFAULT 0,
	"unknown_keys" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'complete' NOT NULL,
	"import_summary" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"version_id" uuid,
	"export_type" text NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"section_key" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"body" text,
	"bullet_points" jsonb DEFAULT '[]'::jsonb,
	"table_data" jsonb,
	"chart_data" jsonb,
	"ai_instruction" text,
	"seller_notes" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"include_in_pdf" boolean DEFAULT true NOT NULL,
	"include_in_html" boolean DEFAULT true NOT NULL,
	"include_in_app" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_auto_generated" boolean DEFAULT false NOT NULL,
	"is_ai_editable" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'empty' NOT NULL,
	"data_source" text DEFAULT 'seller_supplied' NOT NULL,
	"last_updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"title" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_html_url" text,
	"generated_pdf_url" text,
	"snapshot_json" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nda_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"nda_mode" "nda_mode" DEFAULT 'none' NOT NULL,
	"third_party_url" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "nda_settings_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE "nda_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_phone" text NOT NULL,
	"buyer_ip" text,
	"user_agent" text,
	"nda_version" text DEFAULT 'v1' NOT NULL,
	"otp_verified" boolean DEFAULT true NOT NULL,
	"signed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "seller_lease_clauses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lease_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_leases" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "val_business_units" ADD COLUMN "is_included_in_sale" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "purchase_date" date;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "condition" text;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "depreciation_years" integer;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "secondhand_value" numeric;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "replacement_cost" numeric;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "ownership" text;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "val_cafes" ADD COLUMN "business_name" text;--> statement-breakpoint
ALTER TABLE "val_cafes" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "val_cafes" ADD COLUMN "trading_name" text;--> statement-breakpoint
ALTER TABLE "seller_lease_clauses" ADD CONSTRAINT "seller_lease_clauses_lease_id_seller_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."seller_leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_sections_listing_section_idx" ON "report_sections" USING btree ("listing_id","section_key");--> statement-breakpoint
CREATE UNIQUE INDEX "lease_clauses_master_title_jurisdiction_idx" ON "lease_clauses_master" USING btree ("title","jurisdiction");--> statement-breakpoint
CREATE UNIQUE INDEX "lease_templates_source_analysis_id_idx" ON "lease_templates" USING btree ("source_analysis_id") WHERE source_analysis_id IS NOT NULL;