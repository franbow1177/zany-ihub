import { db, schema } from "@workspace/db"
import { and, count, desc, eq, lt, or } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { recordAuditEvent, requestId } from "../lib/audit"
import { newId } from "../lib/ids"
import { getSessionUser } from "../lib/session"
import { slugify } from "../lib/slug"

const workspaceFields = {
  id: schema.workspace.id,
  name: schema.workspace.name,
  slug: schema.workspace.slug,
}

function unauthorized(set: { status?: number | string }) {
  set.status = 401
  return { error: "Unauthorized" }
}

function notFound(set: { status?: number | string }) {
  set.status = 404
  return { error: "Workspace not found" }
}

function forbidden(set: { status?: number | string }) {
  set.status = 403
  return { error: "Only workspace owners can manage members" }
}

function memberNotFound(set: { status?: number | string }) {
  set.status = 404
  return { error: "Workspace member not found" }
}

function lastOwner(set: { status?: number | string }) {
  set.status = 409
  return { error: "A workspace must keep at least one owner" }
}

async function findMembership(workspaceId: string, userId: string) {
  return db.query.workspaceMember.findFirst({
    where: (row, { and, eq }) =>
      and(eq(row.workspaceId, workspaceId), eq(row.userId, userId)),
  })
}

function encodeAuditCursor(occurredAt: Date, id: string) {
  return Buffer.from(JSON.stringify([occurredAt.toISOString(), id])).toString(
    "base64url"
  )
}

function decodeAuditCursor(cursor: string) {
  try {
    const value = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as unknown
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      typeof value[0] !== "string" ||
      typeof value[1] !== "string"
    ) {
      return null
    }
    const occurredAt = new Date(value[0])
    if (Number.isNaN(occurredAt.getTime())) return null
    return { occurredAt, id: value[1] }
  } catch {
    return null
  }
}

export const workspaceRoutes = new Elysia({ name: "workspace-routes" })
  .post(
    "/workspaces",
    async ({ body, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)
      const auditRequestId = requestId(request)

      const created = await db.transaction(async (tx) => {
        const [workspace] = await tx
          .insert(schema.workspace)
          .values({
            id: newId(),
            name: body.name,
            slug: slugify(body.name),
          })
          .returning(workspaceFields)

        if (!workspace) throw new Error("Workspace insert returned no row")

        await tx.insert(schema.workspaceMember).values({
          id: newId(),
          workspaceId: workspace.id,
          userId: sessionUser.id,
          role: "owner",
        })
        await recordAuditEvent(tx, {
          workspaceId: workspace.id,
          actorId: sessionUser.id,
          action: "workspace.created",
          targetType: "workspace",
          targetId: workspace.id,
          targetLabel: workspace.name,
          requestId: auditRequestId,
        })

        return workspace
      })

      return created
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
      }),
    }
  )
  .get("/workspaces", async ({ request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)

    return db
      .select(workspaceFields)
      .from(schema.workspaceMember)
      .innerJoin(
        schema.workspace,
        eq(schema.workspaceMember.workspaceId, schema.workspace.id)
      )
      .where(eq(schema.workspaceMember.userId, sessionUser.id))
  })
  .get("/workspaces/:id", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)

    const membership = await findMembership(params.id, sessionUser.id)
    if (!membership) return notFound(set)

    const [workspace] = await db
      .select(workspaceFields)
      .from(schema.workspace)
      .where(eq(schema.workspace.id, params.id))
      .limit(1)

    if (!workspace) return notFound(set)
    return workspace
  })
  .get("/workspaces/:id/members", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)

    const membership = await findMembership(params.id, sessionUser.id)
    if (!membership) return notFound(set)

    return db
      .select({
        id: schema.workspaceMember.id,
        workspaceId: schema.workspaceMember.workspaceId,
        userId: schema.workspaceMember.userId,
        role: schema.workspaceMember.role,
        createdAt: schema.workspaceMember.createdAt,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
      })
      .from(schema.workspaceMember)
      .innerJoin(schema.user, eq(schema.workspaceMember.userId, schema.user.id))
      .where(eq(schema.workspaceMember.workspaceId, params.id))
  })
  .get(
    "/workspaces/:id/audit-events",
    async ({ params, query, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)

      const membership = await findMembership(params.id, sessionUser.id)
      if (!membership) return notFound(set)
      if (membership.role !== "owner") {
        set.status = 403
        return { error: "Only workspace owners can view audit history" }
      }

      const cursor = query.cursor ? decodeAuditCursor(query.cursor) : undefined
      if (query.cursor && !cursor) {
        set.status = 400
        return { error: "Invalid audit cursor" }
      }
      const requestedLimit = Number(query.limit ?? 50)
      const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : 50
      const cursorCondition = cursor
        ? or(
            lt(schema.auditEvent.occurredAt, cursor.occurredAt),
            and(
              eq(schema.auditEvent.occurredAt, cursor.occurredAt),
              lt(schema.auditEvent.id, cursor.id)
            )
          )
        : undefined

      const rows = await db
        .select({
          id: schema.auditEvent.id,
          workspaceId: schema.auditEvent.workspaceId,
          actorId: schema.auditEvent.actorId,
          actorName: schema.user.name,
          actorEmail: schema.user.email,
          action: schema.auditEvent.action,
          targetType: schema.auditEvent.targetType,
          targetId: schema.auditEvent.targetId,
          targetLabel: schema.auditEvent.targetLabel,
          changes: schema.auditEvent.changes,
          metadata: schema.auditEvent.metadata,
          source: schema.auditEvent.source,
          requestId: schema.auditEvent.requestId,
          occurredAt: schema.auditEvent.occurredAt,
        })
        .from(schema.auditEvent)
        .leftJoin(schema.user, eq(schema.auditEvent.actorId, schema.user.id))
        .where(
          and(eq(schema.auditEvent.workspaceId, params.id), cursorCondition)
        )
        .orderBy(desc(schema.auditEvent.occurredAt), desc(schema.auditEvent.id))
        .limit(limit + 1)

      const hasMore = rows.length > limit
      const events = hasMore ? rows.slice(0, limit) : rows
      const last = events.at(-1)
      return {
        events,
        nextCursor:
          hasMore && last ? encodeAuditCursor(last.occurredAt, last.id) : null,
      }
    },
    {
      query: t.Object({
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    "/workspaces/:id/members/:memberId",
    async ({ body, params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)
      const auditRequestId = requestId(request)

      const result = await db.transaction(async (tx) => {
        const [lockedWorkspace] = await tx
          .select({ id: schema.workspace.id })
          .from(schema.workspace)
          .where(eq(schema.workspace.id, params.id))
          .for("update")
        if (!lockedWorkspace) return { failure: "workspace" as const }

        const [actor] = await tx
          .select()
          .from(schema.workspaceMember)
          .where(
            and(
              eq(schema.workspaceMember.workspaceId, params.id),
              eq(schema.workspaceMember.userId, sessionUser.id)
            )
          )
          .limit(1)
        if (!actor) return { failure: "workspace" as const }
        if (actor.role !== "owner") return { failure: "forbidden" as const }

        const [target] = await tx
          .select({
            id: schema.workspaceMember.id,
            workspaceId: schema.workspaceMember.workspaceId,
            userId: schema.workspaceMember.userId,
            role: schema.workspaceMember.role,
            name: schema.user.name,
            email: schema.user.email,
          })
          .from(schema.workspaceMember)
          .innerJoin(
            schema.user,
            eq(schema.workspaceMember.userId, schema.user.id)
          )
          .where(
            and(
              eq(schema.workspaceMember.id, params.memberId),
              eq(schema.workspaceMember.workspaceId, params.id)
            )
          )
          .limit(1)
        if (!target) return { failure: "member" as const }

        if (target.role === "owner" && body.role === "member") {
          const [owners] = await tx
            .select({ value: count() })
            .from(schema.workspaceMember)
            .where(
              and(
                eq(schema.workspaceMember.workspaceId, params.id),
                eq(schema.workspaceMember.role, "owner")
              )
            )
          if (!owners || owners.value <= 1) {
            return { failure: "last-owner" as const }
          }
        }

        const [updated] = await tx
          .update(schema.workspaceMember)
          .set({ role: body.role })
          .where(eq(schema.workspaceMember.id, target.id))
          .returning()
        if (!updated) return { failure: "member" as const }
        if (target.role !== updated.role) {
          await recordAuditEvent(tx, {
            workspaceId: params.id,
            actorId: sessionUser.id,
            action: "member.role_changed",
            targetType: "member",
            targetId: target.userId,
            targetLabel: target.name || target.email,
            changes: { role: { from: target.role, to: updated.role } },
            requestId: auditRequestId,
          })
        }
        return { member: updated }
      })

      if ("member" in result) return result.member
      if (result.failure === "forbidden") return forbidden(set)
      if (result.failure === "member") return memberNotFound(set)
      if (result.failure === "last-owner") return lastOwner(set)
      return notFound(set)
    },
    {
      body: t.Object({
        role: t.Union([t.Literal("owner"), t.Literal("member")]),
      }),
    }
  )
  .delete(
    "/workspaces/:id/members/:memberId",
    async ({ params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)
      const auditRequestId = requestId(request)

      const result = await db.transaction(async (tx) => {
        const [lockedWorkspace] = await tx
          .select({ id: schema.workspace.id })
          .from(schema.workspace)
          .where(eq(schema.workspace.id, params.id))
          .for("update")
        if (!lockedWorkspace) return { failure: "workspace" as const }

        const [actor] = await tx
          .select()
          .from(schema.workspaceMember)
          .where(
            and(
              eq(schema.workspaceMember.workspaceId, params.id),
              eq(schema.workspaceMember.userId, sessionUser.id)
            )
          )
          .limit(1)
        if (!actor) return { failure: "workspace" as const }
        if (actor.role !== "owner") return { failure: "forbidden" as const }

        const [target] = await tx
          .select({
            id: schema.workspaceMember.id,
            workspaceId: schema.workspaceMember.workspaceId,
            userId: schema.workspaceMember.userId,
            role: schema.workspaceMember.role,
            name: schema.user.name,
            email: schema.user.email,
          })
          .from(schema.workspaceMember)
          .innerJoin(
            schema.user,
            eq(schema.workspaceMember.userId, schema.user.id)
          )
          .where(
            and(
              eq(schema.workspaceMember.id, params.memberId),
              eq(schema.workspaceMember.workspaceId, params.id)
            )
          )
          .limit(1)
        if (!target) return { failure: "member" as const }

        if (target.role === "owner") {
          const [owners] = await tx
            .select({ value: count() })
            .from(schema.workspaceMember)
            .where(
              and(
                eq(schema.workspaceMember.workspaceId, params.id),
                eq(schema.workspaceMember.role, "owner")
              )
            )
          if (!owners || owners.value <= 1) {
            return { failure: "last-owner" as const }
          }
        }

        await tx
          .delete(schema.workspaceMember)
          .where(eq(schema.workspaceMember.id, target.id))
        await recordAuditEvent(tx, {
          workspaceId: params.id,
          actorId: sessionUser.id,
          action: "member.removed",
          targetType: "member",
          targetId: target.userId,
          targetLabel: target.name || target.email,
          metadata: { role: target.role },
          requestId: auditRequestId,
        })
        return { deleted: target.id }
      })

      if ("deleted" in result) {
        set.status = 204
        return
      }
      if (result.failure === "forbidden") return forbidden(set)
      if (result.failure === "member") return memberNotFound(set)
      if (result.failure === "last-owner") return lastOwner(set)
      return notFound(set)
    }
  )
