import { sql } from "drizzle-orm"
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { resource } from "./resource"

/**
 * A bookmark targets either a resource or an external URL. Both may be null
 * only after an internally targeted resource has been deleted.
 */
export const resourceBookmark = pgTable(
  "resource_bookmark",
  {
    id: text("id")
      .primaryKey()
      .references(() => resource.id, { onDelete: "cascade" }),
    targetResourceId: text("target_resource_id").references(() => resource.id, {
      onDelete: "set null",
    }),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "resource_bookmark_single_target_chk",
      sql`NOT (${table.targetResourceId} IS NOT NULL AND ${table.externalUrl} IS NOT NULL)`
    ),
  ]
)
