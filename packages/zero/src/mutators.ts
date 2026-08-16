import {
  defineMutatorWithType,
  defineMutators,
  type Transaction,
} from "@rocicorp/zero"
import { z } from "zod"

import type { ZeroContext } from "./context"
import { type Schema, zql } from "./schema"

const defineMutator = defineMutatorWithType<Schema, ZeroContext | undefined>()

const resourceKind = z.enum([
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
])
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
  id: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(500),
  kind: tableColumnKind,
  options: z.array(z.string().max(1_000)).max(100).optional(),
})
const tableRow = z
  .object({ id: z.string().min(1).max(200) })
  .catchall(tableCell)
const tableData = z.object({
  version: z.literal(1),
  columns: z.array(tableColumn).max(200),
  rows: z.array(tableRow).max(10_000),
})

const defaultTableColumns = [
  { id: "name", name: "Name", kind: "text" as const },
  {
    id: "status",
    name: "Status",
    kind: "select" as const,
    options: ["Not started", "In progress", "Done"],
  },
  { id: "owner", name: "Owner", kind: "text" as const },
  { id: "updated", name: "Date", kind: "date" as const },
]

function initialTableData(resourceId: string) {
  return {
    version: 1 as const,
    columns: defaultTableColumns,
    rows: [
      {
        id: `${resourceId}-row-1`,
        name: "",
        status: "Not started",
        owner: "",
        updated: "",
      },
    ],
  }
}

function requireUser(ctx: ZeroContext | undefined) {
  if (!ctx) throw new Error("Unauthorized")
  return ctx.userID
}

async function assertWorkspaceAccess<TWrappedTransaction>(
  tx: Transaction<Schema, TWrappedTransaction>,
  ctx: ZeroContext | undefined,
  workspaceId: string
) {
  const userID = requireUser(ctx)
  if (tx.location === "client") return

  const membership = await tx.run(
    zql.workspaceMember
      .where("workspaceId", workspaceId)
      .where("userId", userID)
      .one()
  )
  if (!membership) throw new Error("Workspace membership required")
}

async function getAuthorizedResource<TWrappedTransaction>(
  tx: Transaction<Schema, TWrappedTransaction>,
  ctx: ZeroContext | undefined,
  resourceId: string
) {
  requireUser(ctx)
  const resource = await tx.run(zql.resource.where("id", resourceId).one())
  if (!resource) throw new Error("Resource not found")
  await assertWorkspaceAccess(tx, ctx, resource.workspaceId)
  return resource
}

async function assertHumanChatAccess<TWrappedTransaction>(
  tx: Transaction<Schema, TWrappedTransaction>,
  ctx: ZeroContext | undefined,
  chatId: string
) {
  const userID = requireUser(ctx)
  if (tx.location === "client") return
  const chat = await tx.run(zql.resourceChat.where("id", chatId).one())
  if (!chat) throw new Error("Chat not found")

  if (chat.type !== "thread") {
    const participant = await tx.run(
      zql.chatParticipant.where("chatId", chatId).where("userId", userID).one()
    )
    if (!participant) throw new Error("Chat access required")
    const resource = await tx.run(zql.resource.where("id", chat.id).one())
    if (!resource) throw new Error("Chat resource not found")
    await assertWorkspaceAccess(tx, ctx, resource.workspaceId)
    return
  }

  await getAuthorizedResource(
    tx,
    ctx,
    chat.type === "thread" && chat.targetResourceId
      ? chat.targetResourceId
      : chat.id
  )
}

function timestamp<TWrappedTransaction>(
  tx: Transaction<Schema, TWrappedTransaction>,
  optimisticNow: number
) {
  return tx.location === "server" ? Date.now() : optimisticNow
}

type ZeroAuditEvent = {
  workspaceId: string
  action: string
  targetType: string
  targetId?: string | null
  targetLabel?: string | null
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

async function recordAuditEvent<TWrappedTransaction>(
  tx: Transaction<Schema, TWrappedTransaction>,
  ctx: ZeroContext | undefined,
  event: ZeroAuditEvent
) {
  if (tx.location !== "server") return

  await tx.mutate.auditEvent.insert({
    id: crypto.randomUUID(),
    workspaceId: event.workspaceId,
    actorId: requireUser(ctx),
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    targetLabel: event.targetLabel ?? null,
    changes: event.changes ?? {},
    metadata: event.metadata ?? {},
    source: "zero",
    requestId: ctx?.requestID ?? null,
    operationId: null,
    occurredAt: Date.now(),
  })
}

function slugify(name: string, id: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `${base || "workspace"}-${id.slice(0, 8)}`
}

async function touchResource<TWrappedTransaction>(
  tx: Transaction<Schema, TWrappedTransaction>,
  resourceId: string,
  now: number
) {
  await tx.mutate.resource.update({ id: resourceId, updatedAt: now })
}

function directChatKey(
  workspaceId: string,
  firstUserId: string,
  secondUserId: string
) {
  return JSON.stringify([workspaceId, ...[firstUserId, secondUserId].sort()])
}

const bookmarkTarget = z.discriminatedUnion("type", [
  z.object({ type: z.literal("resource"), resourceId: z.string().min(1) }),
  z.object({ type: z.literal("url"), url: z.url() }),
])
const channelParticipant = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
})
const teamMemberInput = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
})

function assertUniqueTeamMembers(
  members: ReadonlyArray<z.infer<typeof teamMemberInput>>
) {
  if (new Set(members.map((member) => member.userId)).size !== members.length) {
    throw new Error("A member can only appear once in a team")
  }
}

async function assertTeamMembersInWorkspace<TWrappedTransaction>(
  tx: Transaction<Schema, TWrappedTransaction>,
  workspaceId: string,
  members: ReadonlyArray<z.infer<typeof teamMemberInput>>
) {
  if (tx.location === "client") return
  for (const member of members) {
    const workspaceMember = await tx.run(
      zql.workspaceMember
        .where("workspaceId", workspaceId)
        .where("userId", member.userId)
        .one()
    )
    if (!workspaceMember) {
      throw new Error("Team members must belong to the workspace")
    }
  }
}

async function getAuthorizedTeam<TWrappedTransaction>(
  tx: Transaction<Schema, TWrappedTransaction>,
  ctx: ZeroContext | undefined,
  teamId: string
) {
  requireUser(ctx)
  const existingTeam = await tx.run(zql.team.where("id", teamId).one())
  if (!existingTeam) throw new Error("Team not found")
  await assertWorkspaceAccess(tx, ctx, existingTeam.workspaceId)
  return existingTeam
}

export const mutators = defineMutators({
  workspaces: {
    create: defineMutator(
      z.object({
        id: z.string().min(1),
        membershipId: z.string().min(1),
        name: z.string().trim().min(1).max(160),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        const now = timestamp(tx, args.now)
        await tx.mutate.workspace.insert({
          id: args.id,
          name: args.name,
          slug: slugify(args.name, args.id),
          createdAt: now,
          updatedAt: now,
        })
        await tx.mutate.workspaceMember.insert({
          id: args.membershipId,
          workspaceId: args.id,
          userId: userID,
          role: "owner",
          createdAt: now,
        })
        await recordAuditEvent(tx, ctx, {
          workspaceId: args.id,
          action: "workspace.created",
          targetType: "workspace",
          targetId: args.id,
          targetLabel: args.name,
        })
      }
    ),
  },
  teams: {
    create: defineMutator(
      z.object({
        id: z.string().min(1),
        workspaceId: z.string().min(1),
        name: z.string().trim().min(1).max(160),
        description: z.string().nullable(),
        members: z.array(teamMemberInput),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        await assertWorkspaceAccess(tx, ctx, args.workspaceId)
        assertUniqueTeamMembers(args.members)
        await assertTeamMembersInWorkspace(tx, args.workspaceId, args.members)
        const now = timestamp(tx, args.now)

        await tx.mutate.team.insert({
          id: args.id,
          workspaceId: args.workspaceId,
          name: args.name,
          description: args.description?.trim() || null,
          createdAt: now,
          updatedAt: now,
        })
        for (const member of args.members) {
          await tx.mutate.teamMember.insert({
            id: member.id,
            teamId: args.id,
            userId: member.userId,
            createdAt: now,
          })
        }
      }
    ),
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(160),
        description: z.string().nullable(),
        members: z.array(teamMemberInput),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const existingTeam = await getAuthorizedTeam(tx, ctx, args.id)
        assertUniqueTeamMembers(args.members)
        await assertTeamMembersInWorkspace(
          tx,
          existingTeam.workspaceId,
          args.members
        )
        const now = timestamp(tx, args.now)
        const currentMembers = await tx.run(
          zql.teamMember.where("teamId", args.id)
        )
        const desiredUserIds = new Set(
          args.members.map((member) => member.userId)
        )
        const currentUserIds = new Set(
          currentMembers.map((member) => member.userId)
        )

        await tx.mutate.team.update({
          id: args.id,
          name: args.name,
          description: args.description?.trim() || null,
          updatedAt: now,
        })
        for (const member of currentMembers) {
          if (!desiredUserIds.has(member.userId)) {
            await tx.mutate.teamMember.delete({ id: member.id })
          }
        }
        for (const member of args.members) {
          if (!currentUserIds.has(member.userId)) {
            await tx.mutate.teamMember.insert({
              id: member.id,
              teamId: args.id,
              userId: member.userId,
              createdAt: now,
            })
          }
        }
      }
    ),
    delete: defineMutator(
      z.object({ id: z.string().min(1) }),
      async ({ tx, ctx, args }) => {
        await getAuthorizedTeam(tx, ctx, args.id)
        await tx.mutate.team.delete({ id: args.id })
      }
    ),
  },
  resources: {
    create: defineMutator(
      z.object({
        id: z.string().min(1),
        workspaceId: z.string().min(1),
        parentId: z.string().min(1).nullable(),
        kind: resourceKind,
        name: z.string().trim().min(1).max(240),
        description: z.string().nullable(),
        icon: z.string().max(64).nullable(),
        bookmark: bookmarkTarget.nullable(),
        channelParticipants: z.array(channelParticipant).nullable(),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        await assertWorkspaceAccess(tx, ctx, args.workspaceId)

        const channelUserIds = new Set(
          args.channelParticipants?.map((participant) => participant.userId) ??
            []
        )
        if (
          args.kind === "chat" &&
          (!args.channelParticipants ||
            channelUserIds.size !== args.channelParticipants.length ||
            channelUserIds.size < 2 ||
            !channelUserIds.has(userID))
        ) {
          throw new Error(
            "Channels require the creator and at least one selected member"
          )
        }

        if (tx.location === "server" && args.parentId) {
          const parent = await tx.run(
            zql.resource.where("id", args.parentId).one()
          )
          if (
            !parent ||
            parent.workspaceId !== args.workspaceId ||
            parent.kind !== "folder"
          ) {
            throw new Error("Parent must be a folder in the same workspace")
          }
        }

        if (args.kind === "bookmark" && !args.bookmark) {
          throw new Error("Bookmark target is required")
        }
        if (tx.location === "server" && args.bookmark?.type === "resource") {
          const target = await tx.run(
            zql.resource.where("id", args.bookmark.resourceId).one()
          )
          if (!target || target.workspaceId !== args.workspaceId) {
            throw new Error("Bookmark target must be in the same workspace")
          }
        }
        if (tx.location === "server" && args.kind === "chat") {
          for (const participant of args.channelParticipants ?? []) {
            const membership = await tx.run(
              zql.workspaceMember
                .where("workspaceId", args.workspaceId)
                .where("userId", participant.userId)
                .one()
            )
            if (!membership) {
              throw new Error("Channel members must belong to the workspace")
            }
          }
        }

        const now = timestamp(tx, args.now)
        await tx.mutate.resource.insert({
          id: args.id,
          workspaceId: args.workspaceId,
          parentId: args.parentId,
          kind: args.kind,
          name: args.name,
          description: args.description?.trim() || null,
          icon: args.icon?.trim() || null,
          createdBy: userID,
          createdAt: now,
          updatedAt: now,
        })

        if (args.kind === "doc") {
          await tx.mutate.resourceDocument.insert({
            id: args.id,
            content: "",
            createdAt: now,
            updatedAt: now,
          })
        } else if (args.kind === "table") {
          await tx.mutate.resourceTable.insert({
            id: args.id,
            data: initialTableData(args.id),
            createdAt: now,
            updatedAt: now,
          })
        } else if (args.kind === "file") {
          await tx.mutate.resourceFile.insert({
            id: args.id,
            mimeType: null,
            sizeBytes: null,
            originalName: null,
            createdAt: now,
            updatedAt: now,
          })
        } else if (args.kind === "whiteboard") {
          await tx.mutate.resourceWhiteboard.insert({
            id: args.id,
            scene: { elements: [], appState: {} },
            formatVersion: 1,
            revision: 0,
            createdAt: now,
            updatedAt: now,
          })
        } else if (args.kind === "project") {
          await tx.mutate.resourceProject.insert({
            id: args.id,
            status: "active",
            createdAt: now,
            updatedAt: now,
          })
        } else if (args.kind === "bookmark" && args.bookmark) {
          await tx.mutate.resourceBookmark.insert({
            id: args.id,
            targetResourceId:
              args.bookmark.type === "resource"
                ? args.bookmark.resourceId
                : null,
            externalUrl:
              args.bookmark.type === "url" ? args.bookmark.url : null,
            createdAt: now,
            updatedAt: now,
          })
        } else if (args.kind === "agent") {
          await tx.mutate.resourceAgent.insert({
            id: args.id,
            model: "openrouter/free",
            persona: null,
            systemPrompt: null,
            createdAt: now,
            updatedAt: now,
          })
        } else if (args.kind === "ai-chat") {
          await tx.mutate.resourceAiChat.insert({
            id: args.id,
            model: "openrouter/free",
            agentId: null,
            messages: [],
            createdAt: now,
            updatedAt: now,
          })
        } else if (args.kind === "chat") {
          await tx.mutate.resourceChat.insert({
            id: args.id,
            type: "channel",
            targetResourceId: null,
            directKey: null,
            createdAt: now,
            updatedAt: now,
          })
          for (const participant of args.channelParticipants ?? []) {
            await tx.mutate.chatParticipant.insert({
              id: participant.id,
              chatId: args.id,
              userId: participant.userId,
              joinedAt: now,
            })
          }
        }
        await recordAuditEvent(tx, ctx, {
          workspaceId: args.workspaceId,
          action: "resource.created",
          targetType: "resource",
          targetId: args.id,
          targetLabel: args.name,
          metadata: { kind: args.kind, parentId: args.parentId },
        })
      }
    ),
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(240).optional(),
        parentId: z.string().min(1).nullable().optional(),
        description: z.string().nullable().optional(),
        icon: z.string().max(64).nullable().optional(),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        if (resource.kind === "chat") {
          await assertHumanChatAccess(tx, ctx, resource.id)
          const chat = await tx.run(
            zql.resourceChat.where("id", resource.id).one()
          )
          if (!chat || chat.type === "dm") {
            throw new Error("Direct messages do not have editable settings")
          }
          if (chat.type === "thread" && args.parentId) {
            throw new Error("Attached threads cannot move into folders")
          }
        }

        if (tx.location === "server" && args.parentId) {
          const parent = await tx.run(
            zql.resource.where("id", args.parentId).one()
          )
          if (
            !parent ||
            parent.workspaceId !== resource.workspaceId ||
            parent.kind !== "folder"
          ) {
            throw new Error("Parent must be a folder in the same workspace")
          }
          const visited = new Set<string>()
          let current = parent
          while (current) {
            if (current.id === resource.id || visited.has(current.id)) {
              throw new Error("A folder cannot be moved into its descendant")
            }
            visited.add(current.id)
            if (!current.parentId) break
            const next = await tx.run(
              zql.resource.where("id", current.parentId).one()
            )
            if (!next) break
            current = next
          }
        }

        await tx.mutate.resource.update({
          id: args.id,
          name: args.name,
          parentId: args.parentId,
          description:
            args.description === undefined
              ? undefined
              : args.description?.trim() || null,
          icon: args.icon === undefined ? undefined : args.icon?.trim() || null,
          updatedAt: timestamp(tx, args.now),
        })
        if (args.name !== undefined && args.name !== resource.name) {
          await recordAuditEvent(tx, ctx, {
            workspaceId: resource.workspaceId,
            action: "resource.renamed",
            targetType: "resource",
            targetId: resource.id,
            targetLabel: args.name,
            changes: { name: { from: resource.name, to: args.name } },
            metadata: { kind: resource.kind },
          })
        }
        if (
          args.parentId !== undefined &&
          args.parentId !== resource.parentId
        ) {
          await recordAuditEvent(tx, ctx, {
            workspaceId: resource.workspaceId,
            action: "resource.moved",
            targetType: "resource",
            targetId: resource.id,
            targetLabel: args.name ?? resource.name,
            changes: {
              parentId: { from: resource.parentId, to: args.parentId },
            },
            metadata: { kind: resource.kind },
          })
        }
        const metadataFields = [
          args.description !== undefined ? "description" : null,
          args.icon !== undefined ? "icon" : null,
        ].filter((field): field is string => field !== null)
        if (metadataFields.length > 0) {
          await recordAuditEvent(tx, ctx, {
            workspaceId: resource.workspaceId,
            action: "resource.metadata_changed",
            targetType: "resource",
            targetId: resource.id,
            targetLabel: args.name ?? resource.name,
            metadata: { kind: resource.kind, fields: metadataFields },
          })
        }
      }
    ),
  },
  documents: {
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        content: z.string().max(2_000_000),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        if (resource.kind !== "doc") throw new Error("Not a document")
        const document = await tx.run(
          zql.resourceDocument.where("id", args.id).one()
        )
        if (!document) throw new Error("Document content not found")
        const now = timestamp(tx, args.now)
        await tx.mutate.resourceDocument.update({
          id: args.id,
          content: args.content,
          updatedAt: now,
        })
        await touchResource(tx, args.id, now)
      }
    ),
  },
  tables: {
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        data: tableData,
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        if (resource.kind !== "table") throw new Error("Not a table")
        const table = await tx.run(zql.resourceTable.where("id", args.id).one())
        if (!table) throw new Error("Table content not found")
        const now = timestamp(tx, args.now)
        await tx.mutate.resourceTable.update({
          id: args.id,
          data: args.data,
          updatedAt: now,
        })
        await touchResource(tx, args.id, now)
      }
    ),
  },
  projects: {
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        status: projectStatus,
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        if (resource.kind !== "project") throw new Error("Not a project")
        const project = await tx.run(
          zql.resourceProject.where("id", args.id).one()
        )
        if (!project) throw new Error("Project content not found")
        const now = timestamp(tx, args.now)
        await tx.mutate.resourceProject.update({
          id: args.id,
          status: args.status,
          updatedAt: now,
        })
        await touchResource(tx, args.id, now)
        if (project.status !== args.status) {
          await recordAuditEvent(tx, ctx, {
            workspaceId: resource.workspaceId,
            action: "project.status_changed",
            targetType: "resource",
            targetId: resource.id,
            targetLabel: resource.name,
            changes: { status: { from: project.status, to: args.status } },
          })
        }
      }
    ),
  },
  tasks: {
    create: defineMutator(
      z.object({
        id: z.string().min(1),
        projectId: z.string().min(1),
        title: z.string().trim().min(1).max(500),
        description: z.string().nullable(),
        status: taskStatus,
        position: z.number().int().nonnegative(),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        const resource = await getAuthorizedResource(tx, ctx, args.projectId)
        if (resource.kind !== "project") throw new Error("Not a project")
        const now = timestamp(tx, args.now)
        await tx.mutate.projectTask.insert({
          id: args.id,
          projectId: args.projectId,
          title: args.title,
          description: args.description?.trim() || null,
          status: args.status,
          position: args.position,
          createdBy: userID,
          createdAt: now,
          updatedAt: now,
        })
        await touchResource(tx, args.projectId, now)
        await recordAuditEvent(tx, ctx, {
          workspaceId: resource.workspaceId,
          action: "task.created",
          targetType: "task",
          targetId: args.id,
          targetLabel: args.title,
          metadata: { projectId: args.projectId, status: args.status },
        })
      }
    ),
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(500).optional(),
        description: z.string().nullable().optional(),
        status: taskStatus.optional(),
        position: z.number().int().nonnegative().optional(),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const task = await tx.run(zql.projectTask.where("id", args.id).one())
        if (!task) throw new Error("Task not found")
        const resource = await getAuthorizedResource(tx, ctx, task.projectId)
        const now = timestamp(tx, args.now)
        await tx.mutate.projectTask.update({
          id: args.id,
          title: args.title,
          description:
            args.description === undefined
              ? undefined
              : args.description?.trim() || null,
          status: args.status,
          position: args.position,
          updatedAt: now,
        })
        await touchResource(tx, task.projectId, now)
        if (args.status !== undefined && args.status !== task.status) {
          await recordAuditEvent(tx, ctx, {
            workspaceId: resource.workspaceId,
            action: "task.status_changed",
            targetType: "task",
            targetId: task.id,
            targetLabel: args.title ?? task.title,
            changes: { status: { from: task.status, to: args.status } },
            metadata: { projectId: task.projectId },
          })
        }
      }
    ),
    delete: defineMutator(
      z.object({ id: z.string().min(1), now: z.number().int().nonnegative() }),
      async ({ tx, ctx, args }) => {
        const task = await tx.run(zql.projectTask.where("id", args.id).one())
        if (!task) throw new Error("Task not found")
        const resource = await getAuthorizedResource(tx, ctx, task.projectId)
        await tx.mutate.projectTask.delete({ id: args.id })
        await touchResource(tx, task.projectId, timestamp(tx, args.now))
        await recordAuditEvent(tx, ctx, {
          workspaceId: resource.workspaceId,
          action: "task.deleted",
          targetType: "task",
          targetId: task.id,
          targetLabel: task.title,
          metadata: { projectId: task.projectId },
        })
      }
    ),
  },
  bookmarks: {
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        target: bookmarkTarget,
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        if (resource.kind !== "bookmark") throw new Error("Not a bookmark")
        const bookmark = await tx.run(
          zql.resourceBookmark.where("id", args.id).one()
        )
        if (!bookmark) throw new Error("Bookmark content not found")
        if (args.target.type === "resource") {
          if (args.target.resourceId === args.id) {
            throw new Error("A bookmark cannot target itself")
          }
          if (tx.location === "server") {
            const target = await tx.run(
              zql.resource.where("id", args.target.resourceId).one()
            )
            if (!target || target.workspaceId !== resource.workspaceId) {
              throw new Error("Bookmark target must be in the same workspace")
            }
          }
        }
        const now = timestamp(tx, args.now)
        await tx.mutate.resourceBookmark.update({
          id: args.id,
          targetResourceId:
            args.target.type === "resource" ? args.target.resourceId : null,
          externalUrl: args.target.type === "url" ? args.target.url : null,
          updatedAt: now,
        })
        await touchResource(tx, args.id, now)
        await recordAuditEvent(tx, ctx, {
          workspaceId: resource.workspaceId,
          action: "bookmark.target_changed",
          targetType: "resource",
          targetId: resource.id,
          targetLabel: resource.name,
          changes: {
            targetType: {
              from: bookmark.targetResourceId ? "resource" : "url",
              to: args.target.type,
            },
          },
        })
      }
    ),
  },
  agents: {
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        model: z.string().min(1).optional(),
        persona: z.string().nullable().optional(),
        systemPrompt: z.string().nullable().optional(),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        if (resource.kind !== "agent") throw new Error("Not an agent")
        const agent = await tx.run(zql.resourceAgent.where("id", args.id).one())
        if (!agent) throw new Error("Agent content not found")
        const now = timestamp(tx, args.now)
        await tx.mutate.resourceAgent.update({
          id: args.id,
          model: args.model,
          persona:
            args.persona === undefined
              ? undefined
              : args.persona?.trim() || null,
          systemPrompt:
            args.systemPrompt === undefined
              ? undefined
              : args.systemPrompt?.trim() || null,
          updatedAt: now,
        })
        await touchResource(tx, args.id, now)
        const fields = [
          args.model !== undefined && args.model !== agent.model
            ? "model"
            : null,
          args.persona !== undefined ? "persona" : null,
          args.systemPrompt !== undefined ? "systemPrompt" : null,
        ].filter((field): field is string => field !== null)
        if (fields.length > 0) {
          await recordAuditEvent(tx, ctx, {
            workspaceId: resource.workspaceId,
            action: "agent.configuration_changed",
            targetType: "resource",
            targetId: resource.id,
            targetLabel: resource.name,
            changes:
              args.model !== undefined && args.model !== agent.model
                ? { model: { from: agent.model, to: args.model } }
                : {},
            metadata: { fields },
          })
        }
      }
    ),
  },
  chats: {
    updateTarget: defineMutator(
      z.object({
        id: z.string().min(1),
        target: z.discriminatedUnion("type", [
          z.object({ type: z.literal("model"), model: z.string().min(1) }),
          z.object({ type: z.literal("agent"), agentId: z.string().min(1) }),
        ]),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        if (resource.kind !== "ai-chat") throw new Error("Not an AI chat")
        const chat = await tx.run(zql.resourceAiChat.where("id", args.id).one())
        if (!chat) throw new Error("AI chat content not found")
        if (tx.location === "server" && args.target.type === "agent") {
          const agent = await tx.run(
            zql.resource.where("id", args.target.agentId).one()
          )
          if (
            !agent ||
            agent.kind !== "agent" ||
            agent.workspaceId !== resource.workspaceId
          ) {
            throw new Error("Agent must be in the same workspace")
          }
        }
        const now = timestamp(tx, args.now)
        await tx.mutate.resourceAiChat.update({
          id: args.id,
          model: args.target.type === "model" ? args.target.model : undefined,
          agentId: args.target.type === "agent" ? args.target.agentId : null,
          updatedAt: now,
        })
        await touchResource(tx, args.id, now)
        await recordAuditEvent(tx, ctx, {
          workspaceId: resource.workspaceId,
          action: "ai_chat.target_changed",
          targetType: "resource",
          targetId: resource.id,
          targetLabel: resource.name,
          changes: {
            target: {
              from: chat.agentId
                ? { type: "agent", id: chat.agentId }
                : { type: "model", id: chat.model },
              to:
                args.target.type === "agent"
                  ? { type: "agent", id: args.target.agentId }
                  : { type: "model", id: args.target.model },
            },
          },
        })
      }
    ),
  },
  humanChats: {
    updateChannelParticipants: defineMutator(
      z.object({
        id: z.string().min(1),
        participants: z.array(channelParticipant).min(2),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        await assertHumanChatAccess(tx, ctx, args.id)
        const chat = await tx.run(zql.resourceChat.where("id", args.id).one())
        if (!chat || chat.type !== "channel") {
          throw new Error("Only channel membership can be updated")
        }

        const desiredByUser = new Map(
          args.participants.map((participant) => [
            participant.userId,
            participant,
          ])
        )
        if (
          desiredByUser.size !== args.participants.length ||
          !desiredByUser.has(resource.createdBy) ||
          !desiredByUser.has(userID)
        ) {
          throw new Error(
            "Channel membership must include its creator and current editor"
          )
        }

        if (tx.location === "server") {
          for (const participant of args.participants) {
            const membership = await tx.run(
              zql.workspaceMember
                .where("workspaceId", resource.workspaceId)
                .where("userId", participant.userId)
                .one()
            )
            if (!membership) {
              throw new Error("Channel members must belong to the workspace")
            }
          }
        }

        const existing = await tx.run(
          zql.chatParticipant.where("chatId", args.id)
        )
        const existingByUser = new Map(
          existing.map((participant) => [participant.userId, participant])
        )
        for (const participant of existing) {
          if (!desiredByUser.has(participant.userId)) {
            await tx.mutate.chatParticipant.delete({ id: participant.id })
          }
        }
        const now = timestamp(tx, args.now)
        for (const participant of args.participants) {
          if (!existingByUser.has(participant.userId)) {
            await tx.mutate.chatParticipant.insert({
              id: participant.id,
              chatId: args.id,
              userId: participant.userId,
              joinedAt: now,
            })
          }
        }
        await tx.mutate.resourceChat.update({ id: args.id, updatedAt: now })
        await touchResource(tx, args.id, now)
        const addedUserIds = args.participants
          .map((participant) => participant.userId)
          .filter((userId) => !existingByUser.has(userId))
        const removedUserIds = existing
          .map((participant) => participant.userId)
          .filter((userId) => !desiredByUser.has(userId))
        if (addedUserIds.length > 0 || removedUserIds.length > 0) {
          await recordAuditEvent(tx, ctx, {
            workspaceId: resource.workspaceId,
            action: "channel.participants_changed",
            targetType: "resource",
            targetId: resource.id,
            targetLabel: resource.name,
            changes: { addedUserIds, removedUserIds },
          })
        }
      }
    ),
    createDM: defineMutator(
      z.object({
        id: z.string().min(1),
        selfParticipantId: z.string().min(1),
        otherParticipantId: z.string().min(1),
        workspaceId: z.string().min(1),
        otherUserId: z.string().min(1),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        if (args.otherUserId === userID) {
          throw new Error("Choose another workspace member")
        }
        await assertWorkspaceAccess(tx, ctx, args.workspaceId)

        if (tx.location === "server") {
          const otherMembership = await tx.run(
            zql.workspaceMember
              .where("workspaceId", args.workspaceId)
              .where("userId", args.otherUserId)
              .one()
          )
          if (!otherMembership) {
            throw new Error("DM participant must be in the same workspace")
          }
          const existing = await tx.run(
            zql.resourceChat
              .where(
                "directKey",
                directChatKey(args.workspaceId, userID, args.otherUserId)
              )
              .one()
          )
          if (existing) throw new Error("Direct message already exists")
        }

        const now = timestamp(tx, args.now)
        await tx.mutate.resource.insert({
          id: args.id,
          workspaceId: args.workspaceId,
          parentId: null,
          kind: "chat",
          name: "Direct message",
          description: null,
          icon: null,
          createdBy: userID,
          createdAt: now,
          updatedAt: now,
        })
        await tx.mutate.resourceChat.insert({
          id: args.id,
          type: "dm",
          targetResourceId: null,
          directKey: directChatKey(args.workspaceId, userID, args.otherUserId),
          createdAt: now,
          updatedAt: now,
        })
        await tx.mutate.chatParticipant.insert({
          id: args.selfParticipantId,
          chatId: args.id,
          userId: userID,
          joinedAt: now,
        })
        await recordAuditEvent(tx, ctx, {
          workspaceId: args.workspaceId,
          action: "resource.created",
          targetType: "resource",
          targetId: args.id,
          targetLabel: "Direct message",
          metadata: { kind: "chat", chatType: "dm" },
        })
        await tx.mutate.chatParticipant.insert({
          id: args.otherParticipantId,
          chatId: args.id,
          userId: args.otherUserId,
          joinedAt: now,
        })
      }
    ),
    createThread: defineMutator(
      z.object({
        id: z.string().min(1),
        targetResourceId: z.string().min(1),
        name: z.string().trim().min(1).max(240),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        const target = await getAuthorizedResource(
          tx,
          ctx,
          args.targetResourceId
        )
        if (target.kind === "chat") {
          throw new Error("Chats cannot have attached discussions")
        }
        const now = timestamp(tx, args.now)
        await tx.mutate.resource.insert({
          id: args.id,
          workspaceId: target.workspaceId,
          parentId: null,
          kind: "chat",
          name: args.name,
          description: null,
          icon: null,
          createdBy: userID,
          createdAt: now,
          updatedAt: now,
        })
        await tx.mutate.resourceChat.insert({
          id: args.id,
          type: "thread",
          targetResourceId: target.id,
          directKey: null,
          createdAt: now,
          updatedAt: now,
        })
        await recordAuditEvent(tx, ctx, {
          workspaceId: target.workspaceId,
          action: "resource.created",
          targetType: "resource",
          targetId: args.id,
          targetLabel: args.name,
          metadata: {
            kind: "chat",
            chatType: "thread",
            targetResourceId: target.id,
          },
        })
      }
    ),
    sendMessage: defineMutator(
      z.object({
        id: z.string().min(1),
        chatId: z.string().min(1),
        body: z.string().trim().min(1).max(20_000),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        await assertHumanChatAccess(tx, ctx, args.chatId)
        const now = timestamp(tx, args.now)
        await tx.mutate.chatMessage.insert({
          id: args.id,
          chatId: args.chatId,
          authorId: userID,
          body: args.body,
          createdAt: now,
          editedAt: null,
          deletedAt: null,
        })
        await tx.mutate.resourceChat.update({
          id: args.chatId,
          updatedAt: now,
        })
        await touchResource(tx, args.chatId, now)
      }
    ),
    editMessage: defineMutator(
      z.object({
        id: z.string().min(1),
        body: z.string().trim().min(1).max(20_000),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        const message = await tx.run(zql.chatMessage.where("id", args.id).one())
        if (!message) throw new Error("Message not found")
        await assertHumanChatAccess(tx, ctx, message.chatId)
        if (message.authorId !== userID) {
          throw new Error("Only the author can edit this message")
        }
        const now = timestamp(tx, args.now)
        await tx.mutate.chatMessage.update({
          id: args.id,
          body: args.body,
          editedAt: now,
        })
        await tx.mutate.resourceChat.update({
          id: message.chatId,
          updatedAt: now,
        })
      }
    ),
    deleteMessage: defineMutator(
      z.object({
        id: z.string().min(1),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        const message = await tx.run(zql.chatMessage.where("id", args.id).one())
        if (!message) throw new Error("Message not found")
        await assertHumanChatAccess(tx, ctx, message.chatId)
        if (message.authorId !== userID) {
          throw new Error("Only the author can delete this message")
        }
        const now = timestamp(tx, args.now)
        await tx.mutate.chatMessage.update({
          id: args.id,
          body: "",
          deletedAt: now,
        })
        await tx.mutate.resourceChat.update({
          id: message.chatId,
          updatedAt: now,
        })
        const chatResource = await tx.run(
          zql.resource.where("id", message.chatId).one()
        )
        if (chatResource) {
          await recordAuditEvent(tx, ctx, {
            workspaceId: chatResource.workspaceId,
            action: "message.deleted",
            targetType: "message",
            targetId: message.id,
            metadata: { chatId: message.chatId },
          })
        }
      }
    ),
    markRead: defineMutator(
      z.object({
        id: z.string().min(1),
        chatId: z.string().min(1),
        messageId: z.string().min(1),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const userID = requireUser(ctx)
        await assertHumanChatAccess(tx, ctx, args.chatId)
        if (tx.location === "server") {
          const message = await tx.run(
            zql.chatMessage.where("id", args.messageId).one()
          )
          if (!message || message.chatId !== args.chatId) {
            throw new Error("Read marker must reference this chat")
          }
        }

        const existing = await tx.run(
          zql.chatReadState
            .where("chatId", args.chatId)
            .where("userId", userID)
            .one()
        )
        const now = timestamp(tx, args.now)
        if (existing) {
          await tx.mutate.chatReadState.update({
            id: existing.id,
            lastReadMessageId: args.messageId,
            updatedAt: now,
          })
        } else {
          await tx.mutate.chatReadState.insert({
            id: args.id,
            chatId: args.chatId,
            userId: userID,
            lastReadMessageId: args.messageId,
            updatedAt: now,
          })
        }
      }
    ),
  },
  whiteboards: {
    update: defineMutator(
      z.object({
        id: z.string().min(1),
        expectedRevision: z.number().int().nonnegative(),
        scene: z.object({
          elements: z.array(z.any()),
          appState: z.record(z.string(), z.any()),
        }),
        now: z.number().int().nonnegative(),
      }),
      async ({ tx, ctx, args }) => {
        const resource = await getAuthorizedResource(tx, ctx, args.id)
        if (resource.kind !== "whiteboard") throw new Error("Not a whiteboard")
        const whiteboard = await tx.run(
          zql.resourceWhiteboard.where("id", args.id).one()
        )
        if (!whiteboard) throw new Error("Whiteboard not found")
        if (whiteboard.revision !== args.expectedRevision) {
          throw new Error("Whiteboard changed in another session")
        }
        const now = timestamp(tx, args.now)
        await tx.mutate.resourceWhiteboard.update({
          id: args.id,
          scene: args.scene,
          revision: args.expectedRevision + 1,
          updatedAt: now,
        })
        await touchResource(tx, args.id, now)
      }
    ),
  },
})
