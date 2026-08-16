import { assertParentIsFolder, db, schema } from "@workspace/db"
import { and, count, eq, inArray, isNull, ne, or } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { newId } from "../lib/ids"
import { deleteObject, fileStorageKey, getObject, putObject } from "../lib/s3"
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

async function canAccessChatResource(resourceId: string, userId: string) {
  const [chat] = await db
    .select()
    .from(schema.resourceChat)
    .where(eq(schema.resourceChat.id, resourceId))
    .limit(1)
  if (!chat) return false
  if (chat.type === "thread") return true

  const [participant] = await db
    .select({ id: schema.chatParticipant.id })
    .from(schema.chatParticipant)
    .where(
      and(
        eq(schema.chatParticipant.chatId, resourceId),
        eq(schema.chatParticipant.userId, userId)
      )
    )
    .limit(1)
  return Boolean(participant)
}

async function findResourceFile(id: string) {
  const [row] = await db
    .select()
    .from(schema.resourceFile)
    .where(eq(schema.resourceFile.id, id))
    .limit(1)
  return row ?? null
}

function serializeFile(
  row: NonNullable<Awaited<ReturnType<typeof findResourceFile>>>
) {
  return {
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    originalName: row.originalName,
    uploaded: Boolean(row.storageKey),
  }
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
  t.Literal("whiteboard"),
  t.Literal("project"),
  t.Literal("bookmark"),
  t.Literal("agent"),
  t.Literal("ai-chat"),
  t.Literal("chat"),
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

function normalizeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

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
            or(
              ne(schema.resource.kind, "chat"),
              inArray(
                schema.resource.id,
                db
                  .select({ id: schema.resourceChat.id })
                  .from(schema.resourceChat)
                  .innerJoin(
                    schema.chatParticipant,
                    eq(
                      schema.chatParticipant.chatId,
                      schema.resourceChat.id
                    )
                  )
                  .where(
                    and(
                      eq(schema.resourceChat.type, "channel"),
                      eq(schema.chatParticipant.userId, sessionUser.id)
                    )
                  )
              )
            ),
            query.scope === "all"
              ? undefined
              : parentId
                ? eq(schema.resource.parentId, parentId)
                : isNull(schema.resource.parentId)
          )
        )
    },
    {
      query: t.Object({
        parentId: t.Optional(t.String()),
        scope: t.Optional(t.Literal("all")),
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

      const channelMemberIds = [
        ...new Set(
          (body.chatMemberIds ?? []).filter(
            (userId) => userId !== sessionUser.id
          )
        ),
      ]
      if (body.kind === "chat") {
        if (channelMemberIds.length === 0) {
          set.status = 400
          return { error: "Select at least one channel member" }
        }
        const selectedMemberships = await db
          .select({ userId: schema.workspaceMember.userId })
          .from(schema.workspaceMember)
          .where(
            and(
              eq(schema.workspaceMember.workspaceId, params.id),
              inArray(schema.workspaceMember.userId, channelMemberIds)
            )
          )
        if (selectedMemberships.length !== channelMemberIds.length) {
          set.status = 400
          return { error: "Channel members must belong to the workspace" }
        }
      }

      let bookmarkValues:
        | { targetResourceId: string; externalUrl: null }
        | { targetResourceId: null; externalUrl: string }
        | null = null

      if (body.kind === "bookmark") {
        if (!body.bookmark) {
          set.status = 400
          return { error: "Bookmark target is required" }
        }

        if (body.bookmark.type === "resource") {
          const target = await findResource(body.bookmark.resourceId)
          if (!target || target.workspaceId !== params.id) {
            set.status = 400
            return { error: "Bookmark target must be in the same workspace" }
          }
          bookmarkValues = {
            targetResourceId: target.id,
            externalUrl: null,
          }
        } else {
          const url = normalizeExternalUrl(body.bookmark.url)
          if (!url) {
            set.status = 400
            return { error: "Bookmark URL must use http or https" }
          }
          bookmarkValues = { targetResourceId: null, externalUrl: url }
        }
      }

      const id = newId()
      const created = await db.transaction(async (tx) => {
        const [resource] = await tx
          .insert(schema.resource)
          .values({
            id,
            workspaceId: params.id,
            parentId: body.parentId ?? null,
            kind: body.kind,
            name: body.name.trim(),
            description: body.description?.trim() || null,
            icon: body.icon?.trim() || null,
            createdBy: sessionUser.id,
          })
          .returning()

        if (!resource) throw new Error("Resource insert returned no row")

        if (body.kind === "file") {
          await tx.insert(schema.resourceFile).values({ id })
        } else if (body.kind === "whiteboard") {
          await tx.insert(schema.resourceWhiteboard).values({ id })
        } else if (body.kind === "project") {
          await tx.insert(schema.resourceProject).values({ id })
        } else if (body.kind === "bookmark" && bookmarkValues) {
          await tx.insert(schema.resourceBookmark).values({
            id,
            ...bookmarkValues,
          })
        } else if (body.kind === "agent") {
          await tx.insert(schema.resourceAgent).values({ id })
        } else if (body.kind === "ai-chat") {
          await tx.insert(schema.resourceAiChat).values({ id })
        } else if (body.kind === "chat") {
          await tx.insert(schema.resourceChat).values({ id, type: "channel" })
          await tx.insert(schema.chatParticipant).values(
            [sessionUser.id, ...channelMemberIds].map((userId) => ({
              id: newId(),
              chatId: id,
              userId,
            }))
          )
        }

        return resource
      })

      if (created.kind === "file") {
        const file = await findResourceFile(created.id)
        return { ...created, file: file ? serializeFile(file) : null }
      }

      return created
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        kind: resourceKind,
        parentId: t.Optional(t.String()),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        icon: t.Optional(t.Union([t.String({ maxLength: 64 }), t.Null()])),
        bookmark: t.Optional(bookmarkTarget),
        chatMemberIds: t.Optional(
          t.Array(t.String({ minLength: 1 }), { minItems: 1 })
        ),
      }),
    }
  )
  .get("/resources/:id", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)

    const resource = await findResource(params.id)
    if (!resource) return notFound(set)

    const membership = await findMembership(
      resource.workspaceId,
      sessionUser.id
    )
    if (!membership) return forbidden(set)
    if (
      resource.kind === "chat" &&
      !(await canAccessChatResource(resource.id, sessionUser.id))
    ) {
      return notFound(set)
    }

    if (resource.kind === "file") {
      const file = await findResourceFile(resource.id)
      return { ...resource, file: file ? serializeFile(file) : null }
    }

    return resource
  })
  .post("/resources/:id/upload", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)

    const resource = await findResource(params.id)
    if (!resource) return notFound(set)

    const membership = await findMembership(
      resource.workspaceId,
      sessionUser.id
    )
    if (!membership) return forbidden(set)

    if (resource.kind !== "file") {
      set.status = 400
      return { error: "Only file resources accept uploads" }
    }

    const form = await request.formData()
    const uploaded = form.get("file")
    if (!(uploaded instanceof File) || uploaded.size === 0) {
      set.status = 400
      return { error: "file is required" }
    }

    const bytes = new Uint8Array(await uploaded.arrayBuffer())
    const key = fileStorageKey(resource.workspaceId, resource.id)
    const mimeType = uploaded.type || "application/octet-stream"

    await putObject({
      key,
      body: bytes,
      contentType: mimeType,
    })

    const existing = await findResourceFile(resource.id)
    if (!existing) {
      await db.insert(schema.resourceFile).values({ id: resource.id })
    }

    const [updated] = await db
      .update(schema.resourceFile)
      .set({
        storageKey: key,
        mimeType,
        sizeBytes: bytes.byteLength,
        originalName: uploaded.name,
        updatedAt: new Date(),
      })
      .where(eq(schema.resourceFile.id, resource.id))
      .returning()

    if (!updated) throw new Error("resource_file update returned no row")
    return serializeFile(updated)
  })
  .get("/resources/:id/download", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)

    const resource = await findResource(params.id)
    if (!resource) return notFound(set)

    const membership = await findMembership(
      resource.workspaceId,
      sessionUser.id
    )
    if (!membership) return forbidden(set)

    if (resource.kind !== "file") {
      set.status = 400
      return { error: "Only file resources can be downloaded" }
    }

    const file = await findResourceFile(resource.id)
    if (!file?.storageKey) {
      set.status = 404
      return { error: "No file uploaded yet" }
    }

    const object = await getObject(file.storageKey)
    const bytes = await object.Body?.transformToByteArray()
    if (!bytes) {
      set.status = 404
      return { error: "File object missing in storage" }
    }

    const filename = file.originalName || resource.name
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer

    return new Response(body, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Content-Length": String(bytes.byteLength),
      },
    })
  })
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
      if (
        resource.kind === "chat" &&
        !(await canAccessChatResource(resource.id, sessionUser.id))
      ) {
        return notFound(set)
      }
      if (resource.kind === "chat") {
        const [chat] = await db
          .select({ type: schema.resourceChat.type })
          .from(schema.resourceChat)
          .where(eq(schema.resourceChat.id, resource.id))
          .limit(1)
        if (!chat || chat.type !== "channel") {
          set.status = 400
          return { error: "Only channels have editable resource settings" }
        }
      }

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
        description?: string | null
        icon?: string | null
        updatedAt: Date
      } = { updatedAt: new Date() }
      if (body.name !== undefined) changes.name = body.name.trim()
      if (body.parentId !== undefined) changes.parentId = body.parentId
      if (body.description !== undefined) {
        changes.description = body.description?.trim() || null
      }
      if (body.icon !== undefined) changes.icon = body.icon?.trim() || null

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
        parentId: t.Optional(t.Union([t.String({ minLength: 1 }), t.Null()])),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        icon: t.Optional(t.Union([t.String({ maxLength: 64 }), t.Null()])),
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
    if (
      resource.kind === "chat" &&
      !(await canAccessChatResource(resource.id, sessionUser.id))
    ) {
      return notFound(set)
    }

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

    if (resource.kind === "whiteboard") {
      const assets = await db
        .select({ storageKey: schema.resourceWhiteboardAsset.storageKey })
        .from(schema.resourceWhiteboardAsset)
        .where(eq(schema.resourceWhiteboardAsset.whiteboardId, resource.id))

      await Promise.all(
        assets.map(async ({ storageKey }) => {
          try {
            await deleteObject(storageKey)
          } catch {
            // DB rows still delete; orphan objects can be GC'd later
          }
        })
      )
    }

    if (resource.kind === "file") {
      const file = await findResourceFile(resource.id)
      if (file?.storageKey) {
        try {
          await deleteObject(file.storageKey)
        } catch {
          // DB row still deleted; orphan object can be GC'd later
        }
      }
    }

    const [deleted] = await db.transaction(async (tx) => {
      const attachedThreads = await tx
        .select({ id: schema.resourceChat.id })
        .from(schema.resourceChat)
        .where(eq(schema.resourceChat.targetResourceId, resource.id))

      if (attachedThreads.length > 0) {
        await tx.delete(schema.resource).where(
          inArray(
            schema.resource.id,
            attachedThreads.map((thread) => thread.id)
          )
        )
      }

      return tx
        .delete(schema.resource)
        .where(eq(schema.resource.id, resource.id))
        .returning()
    })

    if (!deleted) throw new Error("Resource delete returned no row")
    return deleted
  })
