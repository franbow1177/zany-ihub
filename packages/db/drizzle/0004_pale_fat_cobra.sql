ALTER TYPE "public"."resource_kind" ADD VALUE 'agent';--> statement-breakpoint
ALTER TYPE "public"."resource_kind" ADD VALUE 'ai-chat';--> statement-breakpoint
CREATE TABLE "resource_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"model" text DEFAULT 'openrouter/free' NOT NULL,
	"persona" text,
	"system_prompt" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_ai_chat" (
	"id" text PRIMARY KEY NOT NULL,
	"model" text DEFAULT 'openrouter/free' NOT NULL,
	"agent_id" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_agent" ADD CONSTRAINT "resource_agent_id_resource_id_fk" FOREIGN KEY ("id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_ai_chat" ADD CONSTRAINT "resource_ai_chat_id_resource_id_fk" FOREIGN KEY ("id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_ai_chat" ADD CONSTRAINT "resource_ai_chat_agent_id_resource_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."resource_agent"("id") ON DELETE set null ON UPDATE no action;
