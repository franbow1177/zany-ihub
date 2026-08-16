import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero"
import { z } from "zod"

import type { ZeroContext } from "./context"
import { type Schema, zql } from "./schema"

const defineQuery = defineQueryWithType<Schema, ZeroContext | undefined>()
const defineQueries = defineQueriesWithType<Schema>()
const idArg = z.object({ id: z.string().min(1) })
const workspaceArg = z.object({ workspaceId: z.string().min(1) })
const chatArg = z.object({ chatId: z.string().min(1) })

function inaccessibleWorkspace() {
  return zql.workspace.where("id", "__unauthenticated__")
}

function inaccessibleResource() {
  return zql.resource.where("id", "__unauthenticated__")
}

function inaccessibleHumanChat() {
  return zql.resourceChat.where("id", "__unauthenticated__")
}

export const queries = defineQueries({
  workspaces: {
    mine: defineQuery(({ ctx }) =>
      ctx
        ? zql.workspace
            .whereExists("members", (members) =>
              members.where("userId", ctx.userID)
            )
            .orderBy("name", "asc")
        : inaccessibleWorkspace()
    ),
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.workspace
            .where("id", args.id)
            .whereExists("members", (members) =>
              members.where("userId", ctx.userID)
            )
            .one()
        : inaccessibleWorkspace().one()
    ),
  },
  members: {
    byWorkspace: defineQuery(workspaceArg, ({ args, ctx }) =>
      ctx
        ? zql.workspaceMember
            .where("workspaceId", args.workspaceId)
            .whereExists("workspace", (workspace) =>
              workspace.whereExists("members", (members) =>
                members.where("userId", ctx.userID)
              )
            )
            .related("user")
            .orderBy("createdAt", "asc")
        : zql.workspaceMember.where("id", "__unauthenticated__").related("user")
    ),
  },
  teams: {
    byWorkspace: defineQuery(workspaceArg, ({ args, ctx }) =>
      ctx
        ? zql.team
            .where("workspaceId", args.workspaceId)
            .whereExists("workspace", (workspace) =>
              workspace.whereExists("members", (members) =>
                members.where("userId", ctx.userID)
              )
            )
            .related("members", (members) =>
              members.related("user").orderBy("createdAt", "asc")
            )
            .orderBy("name", "asc")
        : zql.team
            .where("id", "__unauthenticated__")
            .related("members", (members) => members.related("user"))
    ),
  },
  resources: {
    byWorkspace: defineQuery(workspaceArg, ({ args, ctx }) =>
      ctx
        ? zql.resource
            .where("workspaceId", args.workspaceId)
            .whereExists("workspace", (workspace) =>
              workspace.whereExists("members", (members) =>
                members.where("userId", ctx.userID)
              )
            )
            .where(({ or, cmp, exists }) =>
              or(
                cmp("kind", "!=", "chat"),
                exists("chat", (chat) =>
                  chat
                    .where("type", "channel")
                    .whereExists("participants", (participants) =>
                      participants.where("userId", ctx.userID)
                    )
                )
              )
            )
        : inaccessibleResource()
    ),
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resource
            .where("id", args.id)
            .whereExists("workspace", (workspace) =>
              workspace.whereExists("members", (members) =>
                members.where("userId", ctx.userID)
              )
            )
            .where(({ or, cmp, exists }) =>
              or(
                cmp("kind", "!=", "chat"),
                exists("chat", (chat) =>
                  chat.where(({ or, and, cmp, exists }) =>
                    or(
                      and(
                        cmp("type", "channel"),
                        exists("participants", (participants) =>
                          participants.where("userId", ctx.userID)
                        )
                      ),
                      and(
                        cmp("type", "dm"),
                        exists("participants", (participants) =>
                          participants.where("userId", ctx.userID)
                        )
                      ),
                      cmp("type", "thread")
                    )
                  )
                )
              )
            )
            .one()
        : inaccessibleResource().one()
    ),
  },
  humanChats: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceChat
            .where("id", args.id)
            .where(({ or, and, cmp, exists }) =>
              or(
                and(
                  cmp("type", "channel"),
                  exists("participants", (participants) =>
                    participants.where("userId", ctx.userID)
                  ),
                  exists("resource", (resource) =>
                    resource.whereExists("workspace", (workspace) =>
                      workspace.whereExists("members", (members) =>
                        members.where("userId", ctx.userID)
                      )
                    )
                  )
                ),
                and(
                  cmp("type", "dm"),
                  exists("participants", (participants) =>
                    participants.where("userId", ctx.userID)
                  ),
                  exists("resource", (resource) =>
                    resource.whereExists("workspace", (workspace) =>
                      workspace.whereExists("members", (members) =>
                        members.where("userId", ctx.userID)
                      )
                    )
                  )
                ),
                and(
                  cmp("type", "thread"),
                  exists("target", (target) =>
                    target.whereExists("workspace", (workspace) =>
                      workspace.whereExists("members", (members) =>
                        members.where("userId", ctx.userID)
                      )
                    )
                  )
                )
              )
            )
            .related("resource")
            .related("target")
            .related("participants", (participants) =>
              participants.related("user").orderBy("joinedAt", "asc")
            )
            .related("readStates", (states) =>
              states.where("userId", ctx.userID)
            )
            .one()
        : inaccessibleHumanChat()
            .related("resource")
            .related("target")
            .related("participants", (participants) =>
              participants.related("user").orderBy("joinedAt", "asc")
            )
            .related("readStates", (states) =>
              states.where("userId", "__unauthenticated__")
            )
            .one()
    ),
    byWorkspace: defineQuery(workspaceArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceChat
            .whereExists("resource", (resource) =>
              resource
                .where("workspaceId", args.workspaceId)
                .whereExists("workspace", (workspace) =>
                  workspace.whereExists("members", (members) =>
                    members.where("userId", ctx.userID)
                  )
                )
            )
            .where(({ or, and, cmp, exists }) =>
              or(
                and(
                  cmp("type", "channel"),
                  exists("participants", (participants) =>
                    participants.where("userId", ctx.userID)
                  )
                ),
                and(
                  cmp("type", "dm"),
                  exists("participants", (participants) =>
                    participants.where("userId", ctx.userID)
                  )
                )
              )
            )
            .related("resource")
            .related("participants", (participants) =>
              participants.related("user").orderBy("joinedAt", "asc")
            )
            .related("readStates", (states) =>
              states.where("userId", ctx.userID)
            )
            .orderBy("updatedAt", "desc")
        : inaccessibleHumanChat()
            .related("resource")
            .related("participants", (participants) =>
              participants.related("user").orderBy("joinedAt", "asc")
            )
            .related("readStates", (states) =>
              states.where("userId", "__unauthenticated__")
            )
    ),
    byTarget: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceChat
            .where("type", "thread")
            .where("targetResourceId", args.id)
            .whereExists("target", (target) =>
              target.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .related("resource")
            .orderBy("createdAt", "asc")
        : inaccessibleHumanChat().related("resource")
    ),
    messages: defineQuery(chatArg, ({ args, ctx }) =>
      ctx
        ? zql.chatMessage
            .where("chatId", args.chatId)
            .whereExists("chat", (chat) =>
              chat.where(({ or, and, cmp, exists }) =>
                or(
                  and(
                    cmp("type", "channel"),
                    exists("participants", (participants) =>
                      participants.where("userId", ctx.userID)
                    ),
                    exists("resource", (resource) =>
                      resource.whereExists("workspace", (workspace) =>
                        workspace.whereExists("members", (members) =>
                          members.where("userId", ctx.userID)
                        )
                      )
                    )
                  ),
                  and(
                    cmp("type", "dm"),
                    exists("participants", (participants) =>
                      participants.where("userId", ctx.userID)
                    ),
                    exists("resource", (resource) =>
                      resource.whereExists("workspace", (workspace) =>
                        workspace.whereExists("members", (members) =>
                          members.where("userId", ctx.userID)
                        )
                      )
                    )
                  ),
                  and(
                    cmp("type", "thread"),
                    exists("target", (target) =>
                      target.whereExists("workspace", (workspace) =>
                        workspace.whereExists("members", (members) =>
                          members.where("userId", ctx.userID)
                        )
                      )
                    )
                  )
                )
              )
            )
            .related("author")
            .orderBy("createdAt", "desc")
            .orderBy("id", "desc")
            .limit(200)
        : zql.chatMessage.where("id", "__unauthenticated__").related("author")
    ),
  },
  files: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceFile
            .where("id", args.id)
            .whereExists("resource", (resource) =>
              resource.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .one()
        : zql.resourceFile.where("id", "__unauthenticated__").one()
    ),
  },
  documents: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceDocument
            .where("id", args.id)
            .whereExists("resource", (resource) =>
              resource.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .one()
        : zql.resourceDocument.where("id", "__unauthenticated__").one()
    ),
  },
  tables: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceTable
            .where("id", args.id)
            .whereExists("resource", (resource) =>
              resource.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .one()
        : zql.resourceTable.where("id", "__unauthenticated__").one()
    ),
  },
  projects: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceProject
            .where("id", args.id)
            .whereExists("resource", (resource) =>
              resource.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .related("tasks", (tasks) =>
              tasks.orderBy("position", "asc").orderBy("createdAt", "asc")
            )
            .one()
        : zql.resourceProject
            .where("id", "__unauthenticated__")
            .related("tasks", (tasks) =>
              tasks.orderBy("position", "asc").orderBy("createdAt", "asc")
            )
            .one()
    ),
  },
  bookmarks: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceBookmark
            .where("id", args.id)
            .whereExists("resource", (resource) =>
              resource.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .related("target")
            .one()
        : zql.resourceBookmark
            .where("id", "__unauthenticated__")
            .related("target")
            .one()
    ),
  },
  agents: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceAgent
            .where("id", args.id)
            .whereExists("resource", (resource) =>
              resource.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .one()
        : zql.resourceAgent.where("id", "__unauthenticated__").one()
    ),
    byWorkspace: defineQuery(workspaceArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceAgent
            .whereExists("resource", (resource) =>
              resource
                .where("workspaceId", args.workspaceId)
                .whereExists("workspace", (workspace) =>
                  workspace.whereExists("members", (members) =>
                    members.where("userId", ctx.userID)
                  )
                )
            )
            .related("resource")
        : zql.resourceAgent
            .where("id", "__unauthenticated__")
            .related("resource")
    ),
  },
  chats: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceAiChat
            .where("id", args.id)
            .whereExists("resource", (resource) =>
              resource.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .one()
        : zql.resourceAiChat.where("id", "__unauthenticated__").one()
    ),
  },
  whiteboards: {
    byID: defineQuery(idArg, ({ args, ctx }) =>
      ctx
        ? zql.resourceWhiteboard
            .where("id", args.id)
            .whereExists("resource", (resource) =>
              resource.whereExists("workspace", (workspace) =>
                workspace.whereExists("members", (members) =>
                  members.where("userId", ctx.userID)
                )
              )
            )
            .related("assets")
            .one()
        : zql.resourceWhiteboard
            .where("id", "__unauthenticated__")
            .related("assets")
            .one()
    ),
  },
})
