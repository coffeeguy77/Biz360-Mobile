CREATE TYPE "public"."report_access_mode" AS ENUM('public', 'users', 'password', 'users_and_password');--> statement-breakpoint
CREATE TABLE "kv_store" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "val_business_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"revenue_share_pct" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "val_cafe_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"unit_id" uuid,
	"name" text NOT NULL,
	"purchase_price" numeric,
	"current_value" numeric,
	"valuation_mode" text DEFAULT 'purchase',
	"is_leased" boolean DEFAULT false,
	"suspended" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "val_cafe_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"merchant_id" text,
	"merchant_name" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "val_cafes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"business_type" text DEFAULT 'cafe',
	"currency" text DEFAULT 'AUD',
	"timezone" text,
	"listing_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "val_owner_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"unit_id" uuid,
	"label" text NOT NULL,
	"annual_amount" numeric NOT NULL,
	"description" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "val_square_orders_cache" (
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"order_date" date NOT NULL,
	"gross_amount" numeric,
	"net_amount" numeric,
	"order_count" integer,
	CONSTRAINT "val_square_orders_cache_cafe_id_order_date_pk" PRIMARY KEY("cafe_id","order_date")
);
--> statement-breakpoint
CREATE TABLE "val_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"unit_id" uuid,
	"snapshot_date" date,
	"period_months" integer,
	"gross_revenue" numeric,
	"cogs" numeric,
	"gross_profit" numeric,
	"xero_total_expenses" numeric,
	"xero_total_revenue" numeric,
	"ebitda" numeric,
	"adjusted_ebitda" numeric,
	"valuation_midpoint" numeric,
	"total_equipment_value" numeric,
	"square_revenue" numeric,
	"xero_revenue" numeric,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "val_xero_pl_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"unit_id" uuid,
	"account_code" text,
	"account_name" text,
	"is_included" boolean DEFAULT true,
	"section" text
);
--> statement-breakpoint
CREATE TABLE "val_xero_supplier_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cafe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"unit_id" uuid,
	"contact_id" text,
	"contact_name" text,
	"is_cogs" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "report_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"phone" text NOT NULL,
	"granted_by" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_access_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"access_mode" "report_access_mode" DEFAULT 'public' NOT NULL,
	"password_hash" text,
	"sms_unlock_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "report_access_settings_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE "report_view_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"viewer_phone" text,
	"viewer_ip" text,
	"user_agent" text,
	"document_type" text DEFAULT 'financials' NOT NULL,
	"opened_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "val_business_units" ADD CONSTRAINT "val_business_units_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD CONSTRAINT "val_cafe_equipment_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_cafe_equipment" ADD CONSTRAINT "val_cafe_equipment_unit_id_val_business_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."val_business_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_cafe_integrations" ADD CONSTRAINT "val_cafe_integrations_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_owner_adjustments" ADD CONSTRAINT "val_owner_adjustments_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_owner_adjustments" ADD CONSTRAINT "val_owner_adjustments_unit_id_val_business_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."val_business_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_square_orders_cache" ADD CONSTRAINT "val_square_orders_cache_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_snapshots" ADD CONSTRAINT "val_snapshots_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_snapshots" ADD CONSTRAINT "val_snapshots_unit_id_val_business_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."val_business_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_xero_pl_mappings" ADD CONSTRAINT "val_xero_pl_mappings_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_xero_pl_mappings" ADD CONSTRAINT "val_xero_pl_mappings_unit_id_val_business_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."val_business_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_xero_supplier_mappings" ADD CONSTRAINT "val_xero_supplier_mappings_cafe_id_val_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."val_cafes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_xero_supplier_mappings" ADD CONSTRAINT "val_xero_supplier_mappings_unit_id_val_business_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."val_business_units"("id") ON DELETE cascade ON UPDATE no action;