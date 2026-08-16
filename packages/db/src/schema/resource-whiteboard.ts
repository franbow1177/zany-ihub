import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { resource } from "./resource"

export type WhiteboardScene = {
  elements: unknown[]
  appState: Record<string, unknown>
}

/** 1:1 editable scene for a whiteboard resource. */
export const resourceWhiteboard = pgTable("resource_whiteboard", {
  id: text("id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  scene: jsonb("scene")
    .$type<WhiteboardScene>()
    .notNull()
    .default({ elements: [], appState: {} }),
  formatVersion: integer("format_version").default(1).notNull(),
  revision: integer("revision").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/** Binary assets stay in S3; Excalidraw's file id links them to scene elements. */
export const resourceWhiteboardAsset = pgTable(
  "resource_whiteboard_asset",
  {
    id: text("id").notNull(),
    whiteboardId: text("whiteboard_id")
      .notNull()
      .references(() => resourceWhiteboard.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.whiteboardId, table.id] }),
    index("resource_whiteboard_asset_whiteboard_idx").on(table.whiteboardId),
  ]
)

export const resourceWhiteboardRelations = relations(
  resourceWhiteboard,
  ({ one, many }) => ({
    resource: one(resource, {
      fields: [resourceWhiteboard.id],
      references: [resource.id],
    }),
    assets: many(resourceWhiteboardAsset),
  })
)

export const resourceWhiteboardAssetRelations = relations(
  resourceWhiteboardAsset,
  ({ one }) => ({
    whiteboard: one(resourceWhiteboard, {
      fields: [resourceWhiteboardAsset.whiteboardId],
      references: [resourceWhiteboard.id],
    }),
  })
)
