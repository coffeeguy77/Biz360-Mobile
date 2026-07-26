CREATE TABLE "custom_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"date_range_months" integer DEFAULT 12 NOT NULL,
	"include_in_im" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_report_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"source" text NOT NULL,
	"xero_account_id" text,
	"xero_account_name" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "custom_reports" ADD CONSTRAINT "custom_reports_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "custom_report_line_items" ADD CONSTRAINT "custom_report_line_items_report_id_custom_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."custom_reports"("id") ON DELETE cascade ON UPDATE no action;
