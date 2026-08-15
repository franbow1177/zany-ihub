CREATE TYPE "public"."project_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_task_status" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
ALTER TYPE "public"."resource_kind" ADD VALUE 'whiteboard';--> statement-breakpoint
ALTER TYPE "public"."resource_kind" ADD VALUE 'project';--> statement-breakpoint
ALTER TYPE "public"."resource_kind" ADD VALUE 'bookmark';--> statement-breakpoint
CREATE TABLE "resource_bookmark" (
	"id" text PRIMARY KEY NOT NULL,
	"target_resource_id" text,
	"external_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_bookmark_single_target_chk" CHECK (NOT ("resource_bookmark"."target_resource_id" IS NOT NULL AND "resource_bookmark"."external_url" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "project_task" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "project_task_status" DEFAULT 'todo' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_project" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_whiteboard" (
	"id" text PRIMARY KEY NOT NULL,
	"scene" jsonb DEFAULT '{"elements":[],"appState":{}}'::jsonb NOT NULL,
	"format_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_whiteboard_asset" (
	"id" text NOT NULL,
	"whiteboard_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_whiteboard_asset_whiteboard_id_id_pk" PRIMARY KEY("whiteboard_id","id"),
	CONSTRAINT "resource_whiteboard_asset_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "resource_bookmark" ADD CONSTRAINT "resource_bookmark_id_resource_id_fk" FOREIGN KEY ("id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_bookmark" ADD CONSTRAINT "resource_bookmark_target_resource_id_resource_id_fk" FOREIGN KEY ("target_resource_id") REFERENCES "public"."resource"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_project_id_resource_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."resource_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_project" ADD CONSTRAINT "resource_project_id_resource_id_fk" FOREIGN KEY ("id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_whiteboard" ADD CONSTRAINT "resource_whiteboard_id_resource_id_fk" FOREIGN KEY ("id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_whiteboard_asset" ADD CONSTRAINT "resource_whiteboard_asset_whiteboard_id_resource_whiteboard_id_fk" FOREIGN KEY ("whiteboard_id") REFERENCES "public"."resource_whiteboard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_task_project_idx" ON "project_task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "resource_whiteboard_asset_whiteboard_idx" ON "resource_whiteboard_asset" USING btree ("whiteboard_id");