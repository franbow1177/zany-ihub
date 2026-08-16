import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { resourceAgent } from "./resource-agent"
import { resource } from "./resource"

/** 1:1 persistent conversation settings and AI SDK UI messages. */
export const resourceAiChat = pgTable("resource_ai_chat", {
  id: text("id")
    .primaryKey()
    .references(() => resource.id, { onDelete: "cascade" }),
  model: text("model").default("openrouter/free").notNull(),
  agentId: text("agent_id").references(() => resourceAgent.id, {
    onDelete: "set null",
  }),
  messages: jsonb("messages").$type<unknown[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
