CREATE TABLE IF NOT EXISTS "buyers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
