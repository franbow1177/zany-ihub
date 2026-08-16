DROP INDEX "resource_chat_target_uidx";--> statement-breakpoint
CREATE INDEX "resource_chat_target_idx" ON "resource_chat" USING btree ("target_resource_id") WHERE "resource_chat"."type" = 'thread';