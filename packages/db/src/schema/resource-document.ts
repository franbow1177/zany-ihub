import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { resource } from "./resource"

/** 1:1 rich text content for a document resource. */
export const resourceDocument = pgTable("resource_document", {
  id: text("id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  content: text("content").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const resourceDocumentRelations = relations(
  resourceDocument,
  ({ one }) => ({
    resource: one(resource, {
      fields: [resourceDocument.id],
      references: [resource.id],
    }),
  })
)
