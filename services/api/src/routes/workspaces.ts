import { db, schema } from "@workspace/db"
import { eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
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

async function findMembership(workspaceId: string, userId: string) {
  return db.query.workspaceMember.findFirst({
    where: (row, { and, eq }) =>
      and(eq(row.workspaceId, workspaceId), eq(row.userId, userId)),
  })
}

export const workspaceRoutes = new Elysia({ name: "workspace-routes" })
  .post(
    "/workspaces",
    async ({ body, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)

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
  .post(
    "/workspaces/:id/members",
    async ({ body, params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)

      const membership = await findMembership(params.id, sessionUser.id)
      if (!membership) return notFound(set)
      if (membership.role !== "owner") {
        set.status = 403
        return { error: "Only workspace owners can add members" }
      }

      const target = await db.query.user.findFirst({
        where: (row, { eq }) => eq(row.email, body.email),
      })
      if (!target) {
        set.status = 404
        return { error: "User not found" }
      }

      const [created] = await db
        .insert(schema.workspaceMember)
        .values({
          id: newId(),
          workspaceId: params.id,
          userId: target.id,
          role: body.role ?? "member",
        })
        .returning()

      if (!created) throw new Error("Workspace member insert returned no row")

      return {
        ...created,
        name: target.name,
        email: target.email,
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        role: t.Optional(t.Literal("member")),
      }),
    }
  )
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
      })
      .from(schema.workspaceMember)
      .innerJoin(schema.user, eq(schema.workspaceMember.userId, schema.user.id))
      .where(eq(schema.workspaceMember.workspaceId, params.id))
  })
