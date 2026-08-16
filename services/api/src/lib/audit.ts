import { db, schema, type AuditEventData } from "@workspace/db"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type AuditEventInput = {
  workspaceId: string
  actorId: string | null
  action: string
  targetType: string
  targetId?: string | null
  targetLabel?: string | null
  changes?: AuditEventData
  metadata?: AuditEventData
  source?: "api" | "system"
  requestId?: string | null
  operationId?: string | null
}

export function requestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID()
}

/** Record an audit event in the caller's domain-write transaction. */
export async function recordAuditEvent(
  tx: DbTransaction,
  event: AuditEventInput
) {
  await tx.insert(schema.auditEvent).values({
    id: crypto.randomUUID(),
    workspaceId: event.workspaceId,
    actorId: event.actorId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    targetLabel: event.targetLabel ?? null,
    changes: event.changes ?? {},
    metadata: event.metadata ?? {},
    source: event.source ?? "api",
    requestId: event.requestId ?? null,
    operationId: event.operationId ?? null,
  })
}
