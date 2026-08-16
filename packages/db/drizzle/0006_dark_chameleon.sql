CREATE TYPE "public"."chat_type" AS ENUM('dm', 'channel', 'thread');--> statement-breakpoint
ALTER TYPE "public"."resource_kind" ADD VALUE 'chat';--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_read_state" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_message_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_chat" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "chat_type" NOT NULL,
	"target_resource_id" text,
	"direct_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_chat_shape_check" CHECK (("resource_chat"."type" = 'thread' AND "resource_chat"."target_resource_id" IS NOT NULL AND "resource_chat"."direct_key" IS NULL) OR ("resource_chat"."type" = 'dm' AND "resource_chat"."target_resource_id" IS NULL AND "resource_chat"."direct_key" IS NOT NULL) OR ("resource_chat"."type" = 'channel' AND "resource_chat"."target_resource_id" IS NULL AND "resource_chat"."direct_key" IS NULL)),
	CONSTRAINT "resource_chat_not_self_target_check" CHECK ("resource_chat"."target_resource_id" IS NULL OR "resource_chat"."target_resource_id" <> "resource_chat"."id")
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_resource_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."resource_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_chat_id_resource_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."resource_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read_state" ADD CONSTRAINT "chat_read_state_chat_id_resource_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."resource_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read_state" ADD CONSTRAINT "chat_read_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read_state" ADD CONSTRAINT "chat_read_state_last_read_message_id_chat_message_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_chat" ADD CONSTRAINT "resource_chat_id_resource_id_fk" FOREIGN KEY ("id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_chat" ADD CONSTRAINT "resource_chat_target_resource_id_resource_id_fk" FOREIGN KEY ("target_resource_id") REFERENCES "public"."resource"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_chat_created_idx" ON "chat_message" USING btree ("chat_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_participant_chat_user_uidx" ON "chat_participant" USING btree ("chat_id","user_id");--> statement-breakpoint
CREATE INDEX "chat_participant_user_idx" ON "chat_participant" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_read_state_chat_user_uidx" ON "chat_read_state" USING btree ("chat_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_chat_target_uidx" ON "resource_chat" USING btree ("target_resource_id") WHERE "resource_chat"."type" = 'thread';--> statement-breakpoint
CREATE UNIQUE INDEX "resource_chat_direct_key_uidx" ON "resource_chat" USING btree ("direct_key") WHERE "resource_chat"."type" = 'dm';