CREATE TABLE "workspace_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by" text,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitation_token_hash_uidx" ON "workspace_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitation_ws_email_uidx" ON "workspace_invitation" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "workspace_invitation_workspace_idx" ON "workspace_invitation" USING btree ("workspace_id");