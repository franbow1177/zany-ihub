import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const auditEventSourceEnum = pgEnum("audit_event_source", [
  "api",
  "zero",
  "system",
])

export type AuditEventData = Record<string, unknown>

/**
 * Append-only workspace audit history.
 *
 * Identifiers deliberately have no foreign keys: deleting a workspace, actor,
 * or target must not erase the historical record that describes the deletion.
 */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    changes: jsonb("changes").$type<AuditEventData>().default({}).notNull(),
    metadata: jsonb("metadata").$type<AuditEventData>().default({}).notNull(),
    source: auditEventSourceEnum("source").notNull(),
    requestId: text("request_id"),
    operationId: text("operation_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_event_workspace_occurred_idx").on(
      table.workspaceId,
      table.occurredAt,
      table.id
    ),
    index("audit_event_target_occurred_idx").on(
      table.targetType,
      table.targetId,
      table.occurredAt
    ),
    index("audit_event_actor_occurred_idx").on(table.actorId, table.occurredAt),
  ]
)
