import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { resource } from "./resource"

/** 1:1 model and instruction settings for an agent resource. */
export const resourceAgent = pgTable("resource_agent", {
  id: text("id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  model: text("model").default("openrouter/free").notNull(),
  persona: text("persona"),
  systemPrompt: text("system_prompt"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
