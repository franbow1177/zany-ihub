import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { resource } from "./resource"

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "completed",
  "archived",
])

export const projectTaskStatusEnum = pgEnum("project_task_status", [
  "todo",
  "in_progress",
  "done",
])

/** 1:1 project settings for a project resource. */
export const resourceProject = pgTable("resource_project", {
  id: text("id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  status: projectStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const projectTask = pgTable(
  "project_task",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => resourceProject.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: projectTaskStatusEnum("status").default("todo").notNull(),
    position: integer("position").default(0).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("project_task_project_idx").on(table.projectId)]
)
