import { relations } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { resource } from "./resource"

export type ResourceTableCell = string | number | boolean | string[] | null
export type ResourceTableColumn = {
  id: string
  name: string
  kind:
    | "text"
    | "number"
    | "checkbox"
    | "date"
    | "select"
    | "multi-select"
    | "mention"
  options?: string[]
}
export type ResourceTableRow = {
  id: string
  [columnId: string]: ResourceTableCell
}
export type ResourceTableData = {
  version: 1
  columns: ResourceTableColumn[]
  rows: ResourceTableRow[]
}

export const defaultResourceTableData: ResourceTableData = {
  version: 1,
  columns: [
    { id: "name", name: "Name", kind: "text" },
    {
      id: "status",
      name: "Status",
      kind: "select",
      options: ["Not started", "In progress", "Done"],
    },
    { id: "owner", name: "Owner", kind: "text" },
    { id: "updated", name: "Date", kind: "date" },
  ],
  rows: [],
}

/** 1:1 database-style content for a table resource. */
export const resourceTable = pgTable("resource_table", {
  id: text("id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  data: jsonb("data")
    .$type<ResourceTableData>()
    .default(defaultResourceTableData)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const resourceTableRelations = relations(resourceTable, ({ one }) => ({
  resource: one(resource, {
    fields: [resourceTable.id],
    references: [resource.id],
  }),
}))
