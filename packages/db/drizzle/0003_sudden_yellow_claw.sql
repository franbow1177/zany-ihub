ALTER TABLE "resource" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "resource" ADD COLUMN "icon" text;--> statement-breakpoint
UPDATE "resource"
SET "description" = "resource_project"."description"
FROM "resource_project"
WHERE "resource"."id" = "resource_project"."id";--> statement-breakpoint
ALTER TABLE "resource_project" DROP COLUMN "description";
