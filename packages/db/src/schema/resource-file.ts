import { relations } from "drizzle-orm"
import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { resource } from "./resource"

/** 1:1 extension of `resource` when kind === 'file'. Same primary key. */
export const resourceFile = pgTable("resource_file", {
  id: text("id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  storageKey: text("storage_key"),
  mimeType: text("mime_type"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  originalName: text("original_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const resourceFileRelations = relations(resourceFile, ({ one }) => ({
  resource: one(resource, {
    fields: [resourceFile.id],
    references: [resource.id],
  }),
}))
