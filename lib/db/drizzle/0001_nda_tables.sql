CREATE TYPE "public"."nda_mode" AS ENUM('none', 'required', 'third_party');

CREATE TABLE "nda_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "listing_id" text NOT NULL,
  "nda_mode" "nda_mode" NOT NULL DEFAULT 'none',
  "third_party_url" text,
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "nda_settings_listing_id_unique" UNIQUE("listing_id")
);

CREATE TABLE "nda_signatures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "listing_id" text NOT NULL,
  "buyer_phone" text NOT NULL,
  "buyer_ip" text,
  "user_agent" text,
  "nda_version" text NOT NULL DEFAULT 'v1',
  "otp_verified" boolean NOT NULL DEFAULT true,
  "signed_at" timestamp DEFAULT now()
);
