import { assertParentIsFolder, db, schema } from "@workspace/db"
import { and, count, eq, isNull } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { newId } from "../lib/ids"
import { getSessionUser } from "../lib/session"

type StatusSet = { status?: number | string }

function unauthorized(set: StatusSet) {
  set.status = 401
  return { error: "Unauthorized" }
}

function forbidden(set: StatusSet) {
  set.status = 403
  return { error: "Workspace membership required" }
}

function notFound(set: StatusSet) {
  set.status = 404
  return { error: "Resource not found" }
}

function invalidParent(set: StatusSet) {
  set.status = 400
  return { error: "Parent must be a folder in the same workspace" }
}

async function findMembership(workspaceId: string, userId: string) {
  return db.query.workspaceMember.findFirst({
    where: (row, { and, eq }) =>
      and(eq(row.workspaceId, workspaceId), eq(row.userId, userId)),
  })
}

async function findResource(id: string) {
  return db.query.resource.findFirst({
    where: (row, { eq }) => eq(row.id, id),
  })
}

async function findValidParent(parentId: string, workspaceId: string) {
  const parent = await findResource(parentId)
  if (!parent || parent.workspaceId !== workspaceId) return null

  try {
    assertParentIsFolder(parent)
    return parent
  } catch {
    return null
  }
}

async function wouldCreateCycle(
  resourceId: string,
  parent: NonNullable<Awaited<ReturnType<typeof findResource>>>
) {
  const visited = new Set<string>()
  let current: typeof parent | undefined = parent

  while (current) {
    if (current.id === resourceId || visited.has(current.id)) return true
    visited.add(current.id)
    current = current.parentId
      ? await findResource(current.parentId)
      : undefined
  }

  return false
}

const resourceKind = t.Union([
  t.Literal("folder"),
  t.Literal("file"),
  t.Literal("doc"),
  t.Literal("table"),
])

export const resourceRoutes = new Elysia({ name: "resource-routes" })
  .get(
    "/workspaces/:id/resources",
    async ({ params, query, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)

      const membership = await findMembership(params.id, sessionUser.id)
      if (!membership) return forbidden(set)

      const parentId = query.parentId || null
      if (parentId) {
        const parent = await findValidParent(parentId, params.id)
        if (!parent) return invalidParent(set)
      }

      return db
        .select()
        .from(schema.resource)
        .where(
          and(
            eq(schema.resource.workspaceId, params.id),
            parentId
              ? eq(schema.resource.parentId, parentId)
              : isNull(schema.resource.parentId)
          )
        )
    },
    {
      query: t.Object({
        parentId: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/workspaces/:id/resources",
    async ({ body, params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)

      const membership = await findMembership(params.id, sessionUser.id)
      if (!membership) return forbidden(set)

      if (body.parentId) {
        const parent = await findValidParent(body.parentId, params.id)
        if (!parent) return invalidParent(set)
      }

      const [created] = await db
        .insert(schema.resource)
        .values({
          id: newId(),
          workspaceId: params.id,
          parentId: body.parentId ?? null,
          kind: body.kind,
          name: body.name,
          createdBy: sessionUser.id,
        })
        .returning()

      if (!created) throw new Error("Resource insert returned no row")
      return created
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        kind: resourceKind,
        parentId: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    "/resources/:id",
    async ({ body, params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)

      const resource = await findResource(params.id)
      if (!resource) return notFound(set)

      const membership = await findMembership(
        resource.workspaceId,
        sessionUser.id
      )
      if (!membership) return forbidden(set)

      if (body.parentId) {
        const parent = await findValidParent(
          body.parentId,
          resource.workspaceId
        )
        if (!parent || (await wouldCreateCycle(resource.id, parent))) {
          return invalidParent(set)
        }
      }

      const changes: {
        name?: string
        parentId?: string | null
        updatedAt: Date
      } = { updatedAt: new Date() }
      if (body.name !== undefined) changes.name = body.name
      if (body.parentId !== undefined) changes.parentId = body.parentId

      const [updated] = await db
        .update(schema.resource)
        .set(changes)
        .where(eq(schema.resource.id, resource.id))
        .returning()

      if (!updated) throw new Error("Resource update returned no row")
      return updated
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        parentId: t.Optional(
          t.Union([t.String({ minLength: 1 }), t.Null()])
        ),
      }),
    }
  )
  .delete("/resources/:id", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)

    const resource = await findResource(params.id)
    if (!resource) return notFound(set)

    const membership = await findMembership(
      resource.workspaceId,
      sessionUser.id
    )
    if (!membership) return forbidden(set)

    if (resource.kind === "folder") {
      const [result] = await db
        .select({ value: count() })
        .from(schema.resource)
        .where(eq(schema.resource.parentId, resource.id))

      if (result && result.value > 0) {
        set.status = 409
        return { error: "Folder must be empty before deletion" }
      }
    }

    const [deleted] = await db
      .delete(schema.resource)
      .where(eq(schema.resource.id, resource.id))
      .returning()

    if (!deleted) throw new Error("Resource delete returned no row")
    return deleted
  })
