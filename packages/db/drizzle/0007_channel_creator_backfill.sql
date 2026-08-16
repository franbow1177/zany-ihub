INSERT INTO "chat_participant" ("id", "chat_id", "user_id")
SELECT
	'channel-backfill-' || md5("resource_chat"."id"),
	"resource_chat"."id",
	"resource"."created_by"
FROM "resource_chat"
INNER JOIN "resource" ON "resource"."id" = "resource_chat"."id"
WHERE "resource_chat"."type" = 'channel'
ON CONFLICT ("chat_id", "user_id") DO NOTHING;
