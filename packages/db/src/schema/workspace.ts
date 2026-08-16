import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const workspaceRoleEnum = pgEnum("workspace_role", ["owner", "member"])

export const workspace = pgTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_member_ws_user_uidx").on(
      table.workspaceId,
      table.userId
    ),
  ]
)

export const workspaceInvitation = pgTable(
  "workspace_invitation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    acceptedBy: text("accepted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("workspace_invitation_token_hash_uidx").on(table.tokenHash),
    uniqueIndex("workspace_invitation_ws_email_uidx").on(
      table.workspaceId,
      table.email
    ),
    index("workspace_invitation_workspace_idx").on(table.workspaceId),
  ]
)
