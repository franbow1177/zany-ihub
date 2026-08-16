CREATE TYPE "public"."audit_event_source" AS ENUM('api', 'zero', 'system');--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"target_label" text,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" "audit_event_source" NOT NULL,
	"request_id" text,
	"operation_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_event_workspace_occurred_idx" ON "audit_event" USING btree ("workspace_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "audit_event_target_occurred_idx" ON "audit_event" USING btree ("target_type","target_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_event_actor_occurred_idx" ON "audit_event" USING btree ("actor_id","occurred_at");
--> statement-breakpoint
CREATE FUNCTION "prevent_audit_event_mutation"() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'audit_event is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "audit_event_append_only"
BEFORE UPDATE OR DELETE ON "audit_event"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_event_mutation"();
