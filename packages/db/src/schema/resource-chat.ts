import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { resource } from "./resource"

export const chatTypeEnum = pgEnum("chat_type", ["dm", "channel", "thread"])

/** 1:1 human conversation settings for a chat resource. */
export const resourceChat = pgTable(
  "resource_chat",
  {
    id: text("id")
      .primaryKey()
      .references(() => resource.id, { onDelete: "cascade" }),
    type: chatTypeEnum("type").notNull(),
    targetResourceId: text("target_resource_id").references(
      (): typeof resource.id => resource.id,
      { onDelete: "restrict" }
    ),
    directKey: text("direct_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("resource_chat_target_idx")
      .on(table.targetResourceId)
      .where(sql`${table.type} = 'thread'`),
    uniqueIndex("resource_chat_direct_key_uidx")
      .on(table.directKey)
      .where(sql`${table.type} = 'dm'`),
    check(
      "resource_chat_shape_check",
      sql`(${table.type} = 'thread' AND ${table.targetResourceId} IS NOT NULL AND ${table.directKey} IS NULL) OR (${table.type} = 'dm' AND ${table.targetResourceId} IS NULL AND ${table.directKey} IS NOT NULL) OR (${table.type} = 'channel' AND ${table.targetResourceId} IS NULL AND ${table.directKey} IS NULL)`
    ),
    check(
      "resource_chat_not_self_target_check",
      sql`${table.targetResourceId} IS NULL OR ${table.targetResourceId} <> ${table.id}`
    ),
  ]
)

export const chatParticipant = pgTable(
  "chat_participant",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => resourceChat.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("chat_participant_chat_user_uidx").on(
      table.chatId,
      table.userId
    ),
    index("chat_participant_user_idx").on(table.userId),
  ]
)

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => resourceChat.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("chat_message_chat_created_idx").on(
      table.chatId,
      table.createdAt,
      table.id
    ),
  ]
)

export const chatReadState = pgTable(
  "chat_read_state",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => resourceChat.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadMessageId: text("last_read_message_id").references(
      (): typeof chatMessage.id => chatMessage.id,
      { onDelete: "set null" }
    ),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("chat_read_state_chat_user_uidx").on(
      table.chatId,
      table.userId
    ),
  ]
)

export const resourceChatRelations = relations(
  resourceChat,
  ({ one, many }) => ({
    resource: one(resource, {
      fields: [resourceChat.id],
      references: [resource.id],
      relationName: "chatResource",
    }),
    target: one(resource, {
      fields: [resourceChat.targetResourceId],
      references: [resource.id],
      relationName: "chatTarget",
    }),
    participants: many(chatParticipant),
    messages: many(chatMessage),
    readStates: many(chatReadState),
  })
)

export const chatParticipantRelations = relations(
  chatParticipant,
  ({ one }) => ({
    chat: one(resourceChat, {
      fields: [chatParticipant.chatId],
      references: [resourceChat.id],
    }),
    user: one(user, {
      fields: [chatParticipant.userId],
      references: [user.id],
    }),
  })
)

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  chat: one(resourceChat, {
    fields: [chatMessage.chatId],
    references: [resourceChat.id],
  }),
  author: one(user, {
    fields: [chatMessage.authorId],
    references: [user.id],
  }),
}))

export const chatReadStateRelations = relations(chatReadState, ({ one }) => ({
  chat: one(resourceChat, {
    fields: [chatReadState.chatId],
    references: [resourceChat.id],
  }),
  user: one(user, {
    fields: [chatReadState.userId],
    references: [user.id],
  }),
  lastReadMessage: one(chatMessage, {
    fields: [chatReadState.lastReadMessageId],
    references: [chatMessage.id],
  }),
}))
