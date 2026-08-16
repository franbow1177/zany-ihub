import { db, schema } from "@workspace/db"
import { and, count, eq } from "drizzle-orm"
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
  .patch(
    "/workspaces/:id/members/:memberId",
    async ({ body, params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)

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
          .select()
          .from(schema.workspaceMember)
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
          .select()
          .from(schema.workspaceMember)
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
