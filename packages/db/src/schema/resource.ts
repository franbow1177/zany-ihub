import {
  type AnyPgColumn,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { workspace } from "./workspace"

export const resourceKindEnum = pgEnum("resource_kind", [
  "folder",
  "file",
  "doc",
  "table",
  "whiteboard",
  "project",
  "bookmark",
  "agent",
  "ai-chat",
])

export const resource = pgTable("resource", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references((): AnyPgColumn => resource.id, {
    onDelete: "restrict",
  }),
  kind: resourceKindEnum("kind").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
