CREATE TABLE "buyer_portal_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cafe_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "buyer_portal_groups_cafe_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "val_cafes"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "buyer_portal_group_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "phone" text NOT NULL,
  "name" text,
  "added_at" timestamp DEFAULT now(),
  CONSTRAINT "buyer_portal_group_members_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "buyer_portal_groups"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "buyer_portal_group_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "cafe_id" uuid NOT NULL,
  "can_view_im_report" boolean NOT NULL DEFAULT false,
  "can_view_walkthrough" boolean NOT NULL DEFAULT false,
  "can_view_financials" boolean NOT NULL DEFAULT false,
  "can_view_equipment" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "buyer_portal_group_permissions_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "buyer_portal_groups"("id") ON DELETE CASCADE,
  CONSTRAINT "buyer_portal_group_permissions_cafe_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "val_cafes"("id") ON DELETE CASCADE,
  CONSTRAINT "buyer_portal_perms_group_cafe_uniq" UNIQUE ("group_id", "cafe_id")
);
