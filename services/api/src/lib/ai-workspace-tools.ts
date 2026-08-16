import {
  db,
  schema,
  type ResourceTableCell,
  type ResourceTableColumn,
  type ResourceTableData,
} from "@workspace/db"
import { tool } from "ai"
import { and, asc, count, eq, ilike, isNull, ne } from "drizzle-orm"
import { z } from "zod"
import { isKnownAiModel } from "./ai-models"
import { recordAuditEvent } from "./audit"
import { newId } from "./ids"

const resourceKinds = [
  "folder",
  "file",
  "doc",
  "table",
  "whiteboard",
  "project",
  "bookmark",
  "agent",
  "ai-chat",
  "chat",
] as const

const visibleResourceKinds = resourceKinds.filter((kind) => kind !== "chat")
const visibleResourceKind = z.enum(visibleResourceKinds)
const projectStatus = z.enum(["active", "completed", "archived"])
const taskStatus = z.enum(["todo", "in_progress", "done"])
const tableColumnKind = z.enum([
  "text",
  "number",
  "checkbox",
  "date",
  "select",
  "multi-select",
  "mention",
])
const tableCell = z.union([
  z.string().max(100_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(1_000)).max(100),
  z.null(),
])
const tableColumn = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(500),
  kind: tableColumnKind,
  options: z.array(z.string().max(1_000)).max(100).optional(),
})
const tableRowInput = z.object({
  id: z.string().trim().min(1).max(200).optional(),
  values: z.record(z.string().min(1), tableCell),
})

const commonCreateFields = {
  name: z.string().trim().min(1).max(500).describe("Resource name"),
  parentId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Parent folder ID; omit or use null for workspace root"),
  description: z.string().max(10_000).nullable().optional(),
  icon: z.string().max(64).nullable().optional(),
}

export const createResourceToolInput = z.discriminatedUnion("kind", [
  z.object({ ...commonCreateFields, kind: z.literal("folder") }),
  z.object({ ...commonCreateFields, kind: z.literal("file") }),
  z.object({
    ...commonCreateFields,
    kind: z.literal("doc"),
    document: z
      .object({
        content: z
          .string()
          .max(2_000_000)
          .describe("Initial TipTap-compatible HTML document content"),
      })
      .optional(),
  }),
  z.object({
    ...commonCreateFields,
    kind: z.literal("table"),
    table: z
      .object({
        columns: z.array(tableColumn).min(1).max(200),
        rows: z.array(tableRowInput).max(10_000).optional(),
      })
      .optional()
      .describe("Initial table schema and rows; omit for default columns"),
  }),
  z.object({ ...commonCreateFields, kind: z.literal("whiteboard") }),
  z.object({
    ...commonCreateFields,
    kind: z.literal("project"),
    project: z
      .object({
        status: projectStatus.optional(),
        tasks: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(500),
              description: z.string().max(10_000).nullable().optional(),
              status: taskStatus.optional(),
            })
          )
          .max(200)
          .optional(),
      })
      .optional(),
  }),
  z.object({
    ...commonCreateFields,
    kind: z.literal("bookmark"),
    bookmark: z.discriminatedUnion("type", [
      z.object({ type: z.literal("resource"), resourceId: z.string().min(1) }),
      z.object({ type: z.literal("url"), url: z.url() }),
    ]),
  }),
  z.object({
    ...commonCreateFields,
    kind: z.literal("agent"),
    agent: z
      .object({
        model: z.string().min(1).optional(),
        persona: z.string().max(50_000).nullable().optional(),
        systemPrompt: z.string().max(100_000).nullable().optional(),
      })
      .optional(),
  }),
  z.object({
    ...commonCreateFields,
    kind: z.literal("ai-chat"),
    aiChat: z
      .object({
        model: z.string().min(1).optional(),
        agentId: z.string().min(1).nullable().optional(),
      })
      .optional(),
  }),
  z.object({
    ...commonCreateFields,
    kind: z.literal("chat"),
    chatMemberIds: z
      .array(z.string().min(1))
      .min(1)
      .max(200)
      .describe("Workspace user IDs to add alongside the current user"),
  }),
])

const listResourcesInput = z.object({
  parentId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Folder ID, null for root only, or omit to search all folders"),
  kind: visibleResourceKind.optional(),
  search: z.string().trim().max(500).optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

const getResourceInput = z.object({
  resourceId: z.string().min(1),
  rowLimit: z.number().int().min(1).max(500).default(100),
})

const listMembersInput = z.object({
  search: z.string().trim().max(500).optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

export const AI_WORKSPACE_TOOL_INSTRUCTIONS = `You have tools for the current workspace.
- Use listResources to discover resource IDs and structure instead of guessing.
- Use getResource when the user asks about resource-specific content.
- Use listMembers to resolve people to user IDs.
- Call createResource only when the user explicitly asks to create something. Before creating a nested resource, resolve and use the parent folder ID. Supply kind-specific initial content when the user provides it.
- Never claim a write succeeded unless the createResource tool returned success.`

export type WorkspaceToolContext = {
  workspaceId: string
  actorId: string
  requestId: string
}

function iso(value: Date) {
  return value.toISOString()
}

function serializeResource(row: typeof schema.resource.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    parentId: row.parentId,
    kind: row.kind,
    name: row.name,
    description: row.description,
    icon: row.icon,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

async function requireFolder(workspaceId: string, parentId?: string | null) {
  if (!parentId) return
  const parent = await db.query.resource.findFirst({
    where: (row, { and, eq }) =>
      and(eq(row.id, parentId), eq(row.workspaceId, workspaceId)),
  })
  if (!parent || parent.kind !== "folder") {
    throw new Error("Parent must be a folder in the current workspace")
  }
}

function normalizeExternalUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Bookmark URL must use http or https")
  }
  return url.toString()
}

function buildTableData(
  id: string,
  input?: z.infer<typeof createResourceToolInput> & { kind: "table" }
): ResourceTableData {
  if (!input?.table) {
    return {
      ...schema.defaultResourceTableData,
      rows: [
        {
          id: `${id}-row-1`,
          name: "",
          status: "Not started",
          owner: "",
          updated: "",
        },
      ],
    }
  }

  const columns = input.table.columns as ResourceTableColumn[]
  const columnIds = new Set(columns.map((column) => column.id))
  if (columnIds.size !== columns.length) {
    throw new Error("Table column IDs must be unique")
  }
  for (const row of input.table.rows ?? []) {
    const unknownColumn = Object.keys(row.values).find(
      (columnId) => !columnIds.has(columnId)
    )
    if (unknownColumn) {
      throw new Error(`Table row references unknown column: ${unknownColumn}`)
    }
  }

  return {
    version: 1,
    columns,
    rows: (input.table.rows ?? []).map((row) => ({
      id: row.id ?? newId(),
      ...(row.values as Record<string, ResourceTableCell>),
    })),
  }
}

export async function listResources(
  workspaceId: string,
  input: z.infer<typeof listResourcesInput>
) {
  const parentCondition =
    input.parentId === undefined
      ? undefined
      : input.parentId === null
        ? isNull(schema.resource.parentId)
        : eq(schema.resource.parentId, input.parentId)

  const rows = await db
    .select()
    .from(schema.resource)
    .where(
      and(
        eq(schema.resource.workspaceId, workspaceId),
        ne(schema.resource.kind, "chat"),
        parentCondition,
        input.kind ? eq(schema.resource.kind, input.kind) : undefined,
        input.search
          ? ilike(schema.resource.name, `%${input.search}%`)
          : undefined
      )
    )
    .orderBy(asc(schema.resource.name))
    .limit(input.limit)

  return { resources: rows.map(serializeResource), count: rows.length }
}

export async function getResource(
  workspaceId: string,
  input: z.infer<typeof getResourceInput>
) {
  const resource = await db.query.resource.findFirst({
    where: (row, { and, eq, ne }) =>
      and(
        eq(row.id, input.resourceId),
        eq(row.workspaceId, workspaceId),
        ne(row.kind, "chat")
      ),
  })
  if (!resource) throw new Error("Resource not found in the current workspace")

  let content: unknown = null
  if (resource.kind === "folder") {
    const [result] = await db
      .select({ value: count() })
      .from(schema.resource)
      .where(
        and(
          eq(schema.resource.parentId, resource.id),
          ne(schema.resource.kind, "chat")
        )
      )
    content = { childCount: result?.value ?? 0 }
  } else if (resource.kind === "file") {
    const [file] = await db
      .select({
        mimeType: schema.resourceFile.mimeType,
        sizeBytes: schema.resourceFile.sizeBytes,
        originalName: schema.resourceFile.originalName,
        uploaded: schema.resourceFile.storageKey,
      })
      .from(schema.resourceFile)
      .where(eq(schema.resourceFile.id, resource.id))
      .limit(1)
    content = file ? { ...file, uploaded: Boolean(file.uploaded) } : null
  } else if (resource.kind === "doc") {
    const [document] = await db
      .select({ content: schema.resourceDocument.content })
      .from(schema.resourceDocument)
      .where(eq(schema.resourceDocument.id, resource.id))
      .limit(1)
    const value = document?.content ?? ""
    content = {
      html: value.slice(0, 30_000),
      truncated: value.length > 30_000,
    }
  } else if (resource.kind === "table") {
    const [table] = await db
      .select({ data: schema.resourceTable.data })
      .from(schema.resourceTable)
      .where(eq(schema.resourceTable.id, resource.id))
      .limit(1)
    content = table
      ? {
          ...table.data,
          rows: table.data.rows.slice(0, input.rowLimit),
          rowCount: table.data.rows.length,
          truncated: table.data.rows.length > input.rowLimit,
        }
      : null
  } else if (resource.kind === "whiteboard") {
    const [whiteboard] = await db
      .select({
        formatVersion: schema.resourceWhiteboard.formatVersion,
        revision: schema.resourceWhiteboard.revision,
      })
      .from(schema.resourceWhiteboard)
      .where(eq(schema.resourceWhiteboard.id, resource.id))
      .limit(1)
    content = whiteboard ?? null
  } else if (resource.kind === "project") {
    const [project] = await db
      .select({ status: schema.resourceProject.status })
      .from(schema.resourceProject)
      .where(eq(schema.resourceProject.id, resource.id))
      .limit(1)
    const tasks = await db
      .select({
        id: schema.projectTask.id,
        title: schema.projectTask.title,
        description: schema.projectTask.description,
        status: schema.projectTask.status,
        position: schema.projectTask.position,
      })
      .from(schema.projectTask)
      .where(eq(schema.projectTask.projectId, resource.id))
      .orderBy(asc(schema.projectTask.position))
      .limit(input.rowLimit)
    content = { status: project?.status ?? null, tasks }
  } else if (resource.kind === "bookmark") {
    const [bookmark] = await db
      .select({
        targetResourceId: schema.resourceBookmark.targetResourceId,
        externalUrl: schema.resourceBookmark.externalUrl,
      })
      .from(schema.resourceBookmark)
      .where(eq(schema.resourceBookmark.id, resource.id))
      .limit(1)
    content = bookmark ?? null
  } else if (resource.kind === "agent") {
    const [agent] = await db
      .select({
        model: schema.resourceAgent.model,
        persona: schema.resourceAgent.persona,
        systemPrompt: schema.resourceAgent.systemPrompt,
      })
      .from(schema.resourceAgent)
      .where(eq(schema.resourceAgent.id, resource.id))
      .limit(1)
    content = agent ?? null
  } else if (resource.kind === "ai-chat") {
    const [chat] = await db
      .select({
        model: schema.resourceAiChat.model,
        agentId: schema.resourceAiChat.agentId,
        messages: schema.resourceAiChat.messages,
      })
      .from(schema.resourceAiChat)
      .where(eq(schema.resourceAiChat.id, resource.id))
      .limit(1)
    content = chat
      ? {
          model: chat.model,
          agentId: chat.agentId,
          messageCount: chat.messages.length,
        }
      : null
  }

  return { resource: serializeResource(resource), content }
}

export async function listMembers(
  workspaceId: string,
  input: z.infer<typeof listMembersInput>
) {
  const rows = await db
    .select({
      membershipId: schema.workspaceMember.id,
      userId: schema.workspaceMember.userId,
      role: schema.workspaceMember.role,
      name: schema.user.name,
      email: schema.user.email,
      image: schema.user.image,
    })
    .from(schema.workspaceMember)
    .innerJoin(schema.user, eq(schema.workspaceMember.userId, schema.user.id))
    .where(
      and(
        eq(schema.workspaceMember.workspaceId, workspaceId),
        input.search ? ilike(schema.user.name, `%${input.search}%`) : undefined
      )
    )
    .orderBy(asc(schema.user.name))
    .limit(input.limit)

  return { members: rows, count: rows.length }
}

export async function createResource(
  context: WorkspaceToolContext,
  input: z.infer<typeof createResourceToolInput>
) {
  await requireFolder(context.workspaceId, input.parentId)

  if (
    (input.kind === "agent" &&
      input.agent?.model &&
      !isKnownAiModel(input.agent.model)) ||
    (input.kind === "ai-chat" &&
      input.aiChat?.model &&
      !isKnownAiModel(input.aiChat.model))
  ) {
    throw new Error("Unknown AI model")
  }

  let bookmarkValues:
    | { targetResourceId: string; externalUrl: null }
    | { targetResourceId: null; externalUrl: string }
    | undefined
  if (input.kind === "bookmark") {
    if (input.bookmark.type === "resource") {
      const targetResourceId = input.bookmark.resourceId
      const target = await db.query.resource.findFirst({
        where: (row, { and, eq }) =>
          and(
            eq(row.id, targetResourceId),
            eq(row.workspaceId, context.workspaceId)
          ),
      })
      if (!target) {
        throw new Error("Bookmark target must be in the current workspace")
      }
      bookmarkValues = { targetResourceId: target.id, externalUrl: null }
    } else {
      bookmarkValues = {
        targetResourceId: null,
        externalUrl: normalizeExternalUrl(input.bookmark.url),
      }
    }
  }

  if (input.kind === "ai-chat" && input.aiChat?.agentId) {
    const agent = await db.query.resource.findFirst({
      where: (row, { and, eq }) =>
        and(
          eq(row.id, input.aiChat!.agentId!),
          eq(row.workspaceId, context.workspaceId),
          eq(row.kind, "agent")
        ),
    })
    if (!agent) throw new Error("Agent must be in the current workspace")
  }

  let channelMemberIds: string[] = []
  if (input.kind === "chat") {
    channelMemberIds = [
      ...new Set(input.chatMemberIds.filter((id) => id !== context.actorId)),
    ]
    if (channelMemberIds.length === 0) {
      throw new Error("Select at least one other channel member")
    }
    const selectedMemberships = await db
      .select({ userId: schema.workspaceMember.userId })
      .from(schema.workspaceMember)
      .where(eq(schema.workspaceMember.workspaceId, context.workspaceId))
    const memberIds = new Set(selectedMemberships.map((row) => row.userId))
    if (channelMemberIds.some((userId) => !memberIds.has(userId))) {
      throw new Error("Channel members must belong to the current workspace")
    }
  }

  const id = newId()
  const tableData =
    input.kind === "table" ? buildTableData(id, input) : undefined
  const created = await db.transaction(async (tx) => {
    const [resource] = await tx
      .insert(schema.resource)
      .values({
        id,
        workspaceId: context.workspaceId,
        parentId: input.parentId ?? null,
        kind: input.kind,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        icon: input.icon?.trim() || null,
        createdBy: context.actorId,
      })
      .returning()
    if (!resource) throw new Error("Resource insert returned no row")

    if (input.kind === "doc") {
      await tx.insert(schema.resourceDocument).values({
        id,
        content: input.document?.content ?? "",
      })
    } else if (input.kind === "table") {
      await tx.insert(schema.resourceTable).values({ id, data: tableData })
    } else if (input.kind === "file") {
      await tx.insert(schema.resourceFile).values({ id })
    } else if (input.kind === "whiteboard") {
      await tx.insert(schema.resourceWhiteboard).values({ id })
    } else if (input.kind === "project") {
      await tx.insert(schema.resourceProject).values({
        id,
        status: input.project?.status ?? "active",
      })
      const tasks = input.project?.tasks ?? []
      if (tasks.length > 0) {
        const writtenTasks = tasks.map((task, position) => ({
          id: newId(),
          projectId: id,
          title: task.title.trim(),
          description: task.description?.trim() || null,
          status: task.status ?? "todo",
          position,
          createdBy: context.actorId,
        }))
        await tx.insert(schema.projectTask).values(writtenTasks)
        for (const task of writtenTasks) {
          await recordAuditEvent(tx, {
            workspaceId: context.workspaceId,
            actorId: context.actorId,
            action: "task.created",
            targetType: "task",
            targetId: task.id,
            targetLabel: task.title,
            metadata: { projectId: id, status: task.status },
            requestId: context.requestId,
          })
        }
      }
    } else if (input.kind === "bookmark" && bookmarkValues) {
      await tx.insert(schema.resourceBookmark).values({ id, ...bookmarkValues })
    } else if (input.kind === "agent") {
      await tx.insert(schema.resourceAgent).values({
        id,
        model: input.agent?.model,
        persona: input.agent?.persona?.trim() || null,
        systemPrompt: input.agent?.systemPrompt?.trim() || null,
      })
    } else if (input.kind === "ai-chat") {
      await tx.insert(schema.resourceAiChat).values({
        id,
        model: input.aiChat?.model,
        agentId: input.aiChat?.agentId ?? null,
      })
    } else if (input.kind === "chat") {
      await tx.insert(schema.resourceChat).values({ id, type: "channel" })
      await tx.insert(schema.chatParticipant).values(
        [context.actorId, ...channelMemberIds].map((userId) => ({
          id: newId(),
          chatId: id,
          userId,
        }))
      )
    }

    await recordAuditEvent(tx, {
      workspaceId: context.workspaceId,
      actorId: context.actorId,
      action: "resource.created",
      targetType: "resource",
      targetId: resource.id,
      targetLabel: resource.name,
      metadata: { kind: resource.kind, parentId: resource.parentId },
      requestId: context.requestId,
    })
    return resource
  })

  return {
    success: true,
    resource: serializeResource(created),
    initialized: {
      document: input.kind === "doc" && Boolean(input.document),
      table:
        input.kind === "table"
          ? {
              columnCount: tableData?.columns.length ?? 0,
              rowCount: tableData?.rows.length ?? 0,
            }
          : undefined,
      projectTaskCount:
        input.kind === "project"
          ? (input.project?.tasks?.length ?? 0)
          : undefined,
    },
  }
}

export function createWorkspaceTools(context: WorkspaceToolContext) {
  return {
    listResources: tool({
      description:
        "List or search non-private resources in the current workspace. Returns IDs, kinds, names, parent IDs, and metadata.",
      inputSchema: listResourcesInput,
      execute: (input) => listResources(context.workspaceId, input),
    }),
    getResource: tool({
      description:
        "Get one resource plus kind-specific content: document HTML, table schema/rows, project tasks, bookmark target, file metadata, agent config, or AI-chat config.",
      inputSchema: getResourceInput,
      execute: (input) => getResource(context.workspaceId, input),
    }),
    listMembers: tool({
      description:
        "List workspace members and their user IDs, names, emails, and roles. Use this to resolve channel participants or owners.",
      inputSchema: listMembersInput,
      execute: (input) => listMembers(context.workspaceId, input),
    }),
    createResource: tool({
      description:
        "Create a typed resource in the current workspace with its kind-specific initial data. Use only after the user explicitly asks to create it. Supports folders, files, docs, tables, whiteboards, projects with tasks, bookmarks, agents, AI chats, and member channels.",
      inputSchema: createResourceToolInput,
      execute: (input) => createResource(context, input),
    }),
  }
}
