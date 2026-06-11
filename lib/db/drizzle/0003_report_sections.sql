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
CREATE UNIQUE INDEX "report_sections_listing_section_idx"
  ON "report_sections" ("listing_id", "section_key");
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
