CREATE TABLE "listing_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "listing_id" text NOT NULL,
  "owner_id" text NOT NULL,
  "title" text NOT NULL,
  "doc_type" text NOT NULL DEFAULT 'other',
  "url" text NOT NULL,
  "cloudinary_public_id" text,
  "file_size" integer,
  "mime_type" text,
  "created_at" timestamp DEFAULT now()
);
