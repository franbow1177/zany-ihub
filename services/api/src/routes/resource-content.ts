import { db, schema, type WhiteboardScene } from "@workspace/db"
import { and, asc, eq, max, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { recordAuditEvent, requestId } from "../lib/audit"
import { newId } from "../lib/ids"
import { getObject, putObject, whiteboardAssetStorageKey } from "../lib/s3"
import { getSessionUser } from "../lib/session"

type StatusSet = { status?: number | string }

function error(set: StatusSet, status: number, message: string) {
  set.status = status
  return { error: message }
}

async function findResource(id: string) {
  return db.query.resource.findFirst({
    where: (row, { eq }) => eq(row.id, id),
  })
}

async function findMembership(workspaceId: string, userId: string) {
  return db.query.workspaceMember.findFirst({
    where: (row, { and, eq }) =>
      and(eq(row.workspaceId, workspaceId), eq(row.userId, userId)),
  })
}

async function authorizeResource(request: Request, id: string) {
  const sessionUser = await getSessionUser(request)
  if (!sessionUser) return { failure: { status: 401, message: "Unauthorized" } }

  const resource = await findResource(id)
  if (!resource) {
    return { failure: { status: 404, message: "Resource not found" } }
  }

  const membership = await findMembership(resource.workspaceId, sessionUser.id)
  if (!membership) {
    return {
      failure: { status: 403, message: "Workspace membership required" },
    }
  }

  return { resource, sessionUser }
}

function normalizeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

async function touchResource(id: string) {
  await db
    .update(schema.resource)
    .set({ updatedAt: new Date() })
    .where(eq(schema.resource.id, id))
}

const projectStatus = t.Union([
  t.Literal("active"),
  t.Literal("completed"),
  t.Literal("archived"),
])

const taskStatus = t.Union([
  t.Literal("todo"),
  t.Literal("in_progress"),
  t.Literal("done"),
])

const bookmarkTarget = t.Union([
  t.Object({
    type: t.Literal("resource"),
    resourceId: t.String({ minLength: 1 }),
  }),
  t.Object({
    type: t.Literal("url"),
    url: t.String({ minLength: 1 }),
  }),
])

export const resourceContentRoutes = new Elysia({
  name: "resource-content-routes",
})
  .get("/resources/:id/whiteboard", async ({ params, request, set }) => {
    const access = await authorizeResource(request, params.id)
    if (access.failure) {
      return error(set, access.failure.status, access.failure.message)
    }
    if (access.resource.kind !== "whiteboard") {
      return error(set, 400, "Resource is not a whiteboard")
    }

    const [whiteboard] = await db
      .select()
      .from(schema.resourceWhiteboard)
      .where(eq(schema.resourceWhiteboard.id, params.id))
      .limit(1)
    if (!whiteboard) return error(set, 404, "Whiteboard content not found")

    const assets = await db
      .select({
        id: schema.resourceWhiteboardAsset.id,
        mimeType: schema.resourceWhiteboardAsset.mimeType,
        sizeBytes: schema.resourceWhiteboardAsset.sizeBytes,
        createdAt: schema.resourceWhiteboardAsset.createdAt,
      })
      .from(schema.resourceWhiteboardAsset)
      .where(eq(schema.resourceWhiteboardAsset.whiteboardId, params.id))

    return {
      scene: whiteboard.scene,
      revision: whiteboard.revision,
      formatVersion: whiteboard.formatVersion,
      assets: assets.map((asset) => ({
        ...asset,
        created: asset.createdAt.getTime(),
      })),
    }
  })
  .patch(
    "/resources/:id/whiteboard",
    async ({ body, params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return error(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "whiteboard") {
        return error(set, 400, "Resource is not a whiteboard")
      }

      const updated = await db.transaction(async (tx) => {
        const [whiteboard] = await tx
          .update(schema.resourceWhiteboard)
          .set({
            scene: body.scene as WhiteboardScene,
            revision: sql`${schema.resourceWhiteboard.revision} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.resourceWhiteboard.id, params.id),
              eq(schema.resourceWhiteboard.revision, body.revision)
            )
          )
          .returning()

        if (!whiteboard) return null

        await tx
          .update(schema.resource)
          .set({ updatedAt: new Date() })
          .where(eq(schema.resource.id, params.id))
        return whiteboard
      })

      if (!updated) {
        return error(
          set,
          409,
          "Whiteboard changed elsewhere; reload before saving again"
        )
      }

      return {
        scene: updated.scene,
        revision: updated.revision,
        formatVersion: updated.formatVersion,
      }
    },
    {
      body: t.Object({
        revision: t.Integer({ minimum: 0 }),
        scene: t.Object({
          elements: t.Array(t.Any()),
          appState: t.Record(t.String(), t.Any()),
        }),
      }),
    }
  )
  .post(
    "/resources/:id/whiteboard/assets/:assetId",
    async ({ params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return error(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "whiteboard") {
        return error(set, 400, "Resource is not a whiteboard")
      }
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.assetId)) {
        return error(set, 400, "Invalid whiteboard asset id")
      }

      const form = await request.formData()
      const uploaded = form.get("file")
      if (!(uploaded instanceof File) || uploaded.size === 0) {
        return error(set, 400, "file is required")
      }
      if (!uploaded.type.startsWith("image/")) {
        return error(set, 400, "Whiteboard assets must be images")
      }
      if (uploaded.size > 20 * 1024 * 1024) {
        return error(set, 413, "Whiteboard assets are limited to 20 MB")
      }

      const bytes = new Uint8Array(await uploaded.arrayBuffer())
      const mimeType = uploaded.type || "application/octet-stream"
      const storageKey = whiteboardAssetStorageKey(
        access.resource.workspaceId,
        access.resource.id,
        params.assetId
      )

      await putObject({ key: storageKey, body: bytes, contentType: mimeType })
      const [asset] = await db
        .insert(schema.resourceWhiteboardAsset)
        .values({
          id: params.assetId,
          whiteboardId: params.id,
          storageKey,
          mimeType,
          sizeBytes: bytes.byteLength,
        })
        .onConflictDoUpdate({
          target: [
            schema.resourceWhiteboardAsset.whiteboardId,
            schema.resourceWhiteboardAsset.id,
          ],
          set: { storageKey, mimeType, sizeBytes: bytes.byteLength },
        })
        .returning()

      await touchResource(params.id)
      return asset
    }
  )
  .get(
    "/resources/:id/whiteboard/assets/:assetId",
    async ({ params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return error(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "whiteboard") {
        return error(set, 400, "Resource is not a whiteboard")
      }

      const [asset] = await db
        .select()
        .from(schema.resourceWhiteboardAsset)
        .where(
          and(
            eq(schema.resourceWhiteboardAsset.whiteboardId, params.id),
            eq(schema.resourceWhiteboardAsset.id, params.assetId)
          )
        )
        .limit(1)
      if (!asset) return error(set, 404, "Whiteboard asset not found")

      const object = await getObject(asset.storageKey)
      const bytes = await object.Body?.transformToByteArray()
      if (!bytes) return error(set, 404, "Whiteboard asset object missing")

      const body = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer
      return new Response(body, {
        headers: {
          "Content-Type": asset.mimeType,
          "Content-Length": String(bytes.byteLength),
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": "attachment",
          "X-Content-Type-Options": "nosniff",
        },
      })
    }
  )
  .get("/resources/:id/project", async ({ params, request, set }) => {
    const access = await authorizeResource(request, params.id)
    if (access.failure) {
      return error(set, access.failure.status, access.failure.message)
    }
    if (access.resource.kind !== "project") {
      return error(set, 400, "Resource is not a project")
    }

    const [project] = await db
      .select()
      .from(schema.resourceProject)
      .where(eq(schema.resourceProject.id, params.id))
      .limit(1)
    if (!project) return error(set, 404, "Project content not found")

    const tasks = await db
      .select()
      .from(schema.projectTask)
      .where(eq(schema.projectTask.projectId, params.id))
      .orderBy(
        asc(schema.projectTask.position),
        asc(schema.projectTask.createdAt)
      )

    return { project, tasks }
  })
  .patch(
    "/resources/:id/project",
    async ({ body, params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return error(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "project") {
        return error(set, 400, "Resource is not a project")
      }
      const [previous] = await db
        .select()
        .from(schema.resourceProject)
        .where(eq(schema.resourceProject.id, params.id))
        .limit(1)
      if (!previous) return error(set, 404, "Project content not found")
      const auditRequestId = requestId(request)
      const project = await db.transaction(async (tx) => {
        const [written] = await tx
          .update(schema.resourceProject)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(schema.resourceProject.id, params.id))
          .returning()
        if (!written) return null
        await tx
          .update(schema.resource)
          .set({ updatedAt: new Date() })
          .where(eq(schema.resource.id, params.id))
        if (body.status !== undefined && body.status !== previous.status) {
          await recordAuditEvent(tx, {
            workspaceId: access.resource.workspaceId,
            actorId: access.sessionUser.id,
            action: "project.status_changed",
            targetType: "resource",
            targetId: params.id,
            targetLabel: access.resource.name,
            changes: { status: { from: previous.status, to: body.status } },
            requestId: auditRequestId,
          })
        }
        return written
      })
      if (!project) return error(set, 404, "Project content not found")
      return project
    },
    {
      body: t.Object({
        status: t.Optional(projectStatus),
      }),
    }
  )
  .post(
    "/resources/:id/tasks",
    async ({ body, params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return error(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "project") {
        return error(set, 400, "Resource is not a project")
      }
      if (!body.title.trim()) return error(set, 400, "Task title is required")
      const auditRequestId = requestId(request)

      const [positionResult] = await db
        .select({ value: max(schema.projectTask.position) })
        .from(schema.projectTask)
        .where(eq(schema.projectTask.projectId, params.id))

      const task = await db.transaction(async (tx) => {
        const [written] = await tx
          .insert(schema.projectTask)
          .values({
            id: newId(),
            projectId: params.id,
            title: body.title.trim(),
            description: body.description?.trim() || null,
            status: body.status ?? "todo",
            position: (positionResult?.value ?? -1) + 1,
            createdBy: access.sessionUser.id,
          })
          .returning()
        if (!written) throw new Error("Task insert returned no row")
        await tx
          .update(schema.resource)
          .set({ updatedAt: new Date() })
          .where(eq(schema.resource.id, params.id))
        await recordAuditEvent(tx, {
          workspaceId: access.resource.workspaceId,
          actorId: access.sessionUser.id,
          action: "task.created",
          targetType: "task",
          targetId: written.id,
          targetLabel: written.title,
          metadata: { projectId: params.id, status: written.status },
          requestId: auditRequestId,
        })
        return written
      })
      return task
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        status: t.Optional(taskStatus),
      }),
    }
  )
  .patch(
    "/tasks/:taskId",
    async ({ body, params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return error(set, 401, "Unauthorized")

      const [existing] = await db
        .select()
        .from(schema.projectTask)
        .where(eq(schema.projectTask.id, params.taskId))
        .limit(1)
      if (!existing) return error(set, 404, "Task not found")

      const access = await authorizeResource(request, existing.projectId)
      if (access.failure) {
        return error(set, access.failure.status, access.failure.message)
      }
      if (body.title !== undefined && !body.title.trim()) {
        return error(set, 400, "Task title is required")
      }
      const auditRequestId = requestId(request)

      const changes: {
        title?: string
        description?: string | null
        status?: "todo" | "in_progress" | "done"
        position?: number
        updatedAt: Date
      } = { updatedAt: new Date() }
      if (body.title !== undefined) changes.title = body.title.trim()
      if (body.description !== undefined) {
        changes.description = body.description?.trim() || null
      }
      if (body.status !== undefined) changes.status = body.status
      if (body.position !== undefined) changes.position = body.position

      const task = await db.transaction(async (tx) => {
        const [written] = await tx
          .update(schema.projectTask)
          .set(changes)
          .where(eq(schema.projectTask.id, params.taskId))
          .returning()
        if (!written) return null
        await tx
          .update(schema.resource)
          .set({ updatedAt: new Date() })
          .where(eq(schema.resource.id, existing.projectId))
        if (body.status !== undefined && body.status !== existing.status) {
          await recordAuditEvent(tx, {
            workspaceId: access.resource.workspaceId,
            actorId: access.sessionUser.id,
            action: "task.status_changed",
            targetType: "task",
            targetId: existing.id,
            targetLabel: written.title,
            changes: { status: { from: existing.status, to: body.status } },
            metadata: { projectId: existing.projectId },
            requestId: auditRequestId,
          })
        }
        return written
      })
      return task
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        status: t.Optional(taskStatus),
        position: t.Optional(t.Integer({ minimum: 0 })),
      }),
    }
  )
  .delete("/tasks/:taskId", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return error(set, 401, "Unauthorized")

    const [existing] = await db
      .select()
      .from(schema.projectTask)
      .where(eq(schema.projectTask.id, params.taskId))
      .limit(1)
    if (!existing) return error(set, 404, "Task not found")

    const access = await authorizeResource(request, existing.projectId)
    if (access.failure) {
      return error(set, access.failure.status, access.failure.message)
    }
    const auditRequestId = requestId(request)
    const task = await db.transaction(async (tx) => {
      const [written] = await tx
        .delete(schema.projectTask)
        .where(eq(schema.projectTask.id, params.taskId))
        .returning()
      if (!written) return null
      await tx
        .update(schema.resource)
        .set({ updatedAt: new Date() })
        .where(eq(schema.resource.id, existing.projectId))
      await recordAuditEvent(tx, {
        workspaceId: access.resource.workspaceId,
        actorId: access.sessionUser.id,
        action: "task.deleted",
        targetType: "task",
        targetId: existing.id,
        targetLabel: existing.title,
        metadata: { projectId: existing.projectId },
        requestId: auditRequestId,
      })
      return written
    })
    return task
  })
  .get("/resources/:id/bookmark", async ({ params, request, set }) => {
    const access = await authorizeResource(request, params.id)
    if (access.failure) {
      return error(set, access.failure.status, access.failure.message)
    }
    if (access.resource.kind !== "bookmark") {
      return error(set, 400, "Resource is not a bookmark")
    }

    const [bookmark] = await db
      .select()
      .from(schema.resourceBookmark)
      .where(eq(schema.resourceBookmark.id, params.id))
      .limit(1)
    if (!bookmark) return error(set, 404, "Bookmark content not found")

    const targetResource = bookmark.targetResourceId
      ? await findResource(bookmark.targetResourceId)
      : null

    return {
      target: bookmark.externalUrl
        ? { type: "url" as const, url: bookmark.externalUrl }
        : bookmark.targetResourceId
          ? {
              type: "resource" as const,
              resourceId: bookmark.targetResourceId,
              resource: targetResource
                ? {
                    id: targetResource.id,
                    name: targetResource.name,
                    kind: targetResource.kind,
                  }
                : null,
            }
          : null,
      updatedAt: bookmark.updatedAt,
    }
  })
  .patch(
    "/resources/:id/bookmark",
    async ({ body, params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return error(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "bookmark") {
        return error(set, 400, "Resource is not a bookmark")
      }
      const [previous] = await db
        .select()
        .from(schema.resourceBookmark)
        .where(eq(schema.resourceBookmark.id, params.id))
        .limit(1)
      if (!previous) return error(set, 404, "Bookmark content not found")
      const auditRequestId = requestId(request)

      let targetResourceId: string | null = null
      let externalUrl: string | null = null
      if (body.target.type === "resource") {
        const target = await findResource(body.target.resourceId)
        if (
          !target ||
          target.workspaceId !== access.resource.workspaceId ||
          target.id === access.resource.id
        ) {
          return error(
            set,
            400,
            "Bookmark target must be another resource in the same workspace"
          )
        }
        targetResourceId = target.id
      } else {
        externalUrl = normalizeExternalUrl(body.target.url)
        if (!externalUrl) {
          return error(set, 400, "Bookmark URL must use http or https")
        }
      }

      const bookmark = await db.transaction(async (tx) => {
        const [written] = await tx
          .update(schema.resourceBookmark)
          .set({ targetResourceId, externalUrl, updatedAt: new Date() })
          .where(eq(schema.resourceBookmark.id, params.id))
          .returning()
        if (!written) return null
        await tx
          .update(schema.resource)
          .set({ updatedAt: new Date() })
          .where(eq(schema.resource.id, params.id))
        await recordAuditEvent(tx, {
          workspaceId: access.resource.workspaceId,
          actorId: access.sessionUser.id,
          action: "bookmark.target_changed",
          targetType: "resource",
          targetId: params.id,
          targetLabel: access.resource.name,
          changes: {
            targetType: {
              from: previous.targetResourceId ? "resource" : "url",
              to: targetResourceId ? "resource" : "url",
            },
          },
          requestId: auditRequestId,
        })
        return written
      })
      if (!bookmark) return error(set, 404, "Bookmark content not found")
      return bookmark
    },
    { body: t.Object({ target: bookmarkTarget }) }
  )
