CREATE TABLE "resource_file" (
	"id" text PRIMARY KEY NOT NULL,
	"storage_key" text,
	"mime_type" text,
	"size_bytes" bigint,
	"original_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_file" ADD CONSTRAINT "resource_file_id_resource_id_fk" FOREIGN KEY ("id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;