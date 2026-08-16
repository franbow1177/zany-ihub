import { db, schema } from "@workspace/db"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"
import { asc, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import {
  isKnownAiModel,
  listAiModels,
  resolveAiModel,
} from "../lib/ai-models"
import { getSessionUser } from "../lib/session"

type StatusSet = { status?: number | string }

function failure(set: StatusSet, status: number, message: string) {
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

async function findAgent(agentId: string) {
  const [agent] = await db
    .select({
      id: schema.resourceAgent.id,
      model: schema.resourceAgent.model,
      persona: schema.resourceAgent.persona,
      systemPrompt: schema.resourceAgent.systemPrompt,
      name: schema.resource.name,
      icon: schema.resource.icon,
      description: schema.resource.description,
      workspaceId: schema.resource.workspaceId,
    })
    .from(schema.resourceAgent)
    .innerJoin(schema.resource, eq(schema.resource.id, schema.resourceAgent.id))
    .where(eq(schema.resourceAgent.id, agentId))
    .limit(1)
  return agent ?? null
}

async function listWorkspaceAgents(workspaceId: string) {
  return db
    .select({
      id: schema.resourceAgent.id,
      name: schema.resource.name,
      icon: schema.resource.icon,
      description: schema.resource.description,
      model: schema.resourceAgent.model,
    })
    .from(schema.resourceAgent)
    .innerJoin(schema.resource, eq(schema.resource.id, schema.resourceAgent.id))
    .where(eq(schema.resource.workspaceId, workspaceId))
    .orderBy(asc(schema.resource.name))
}

async function touchResource(id: string) {
  await db
    .update(schema.resource)
    .set({ updatedAt: new Date() })
    .where(eq(schema.resource.id, id))
}

function agentInstructions(agent: {
  persona: string | null
  systemPrompt: string | null
}) {
  return [
    agent.persona ? `Persona:\n${agent.persona}` : null,
    agent.systemPrompt ? `Instructions:\n${agent.systemPrompt}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")
}

const chatTarget = t.Union([
  t.Object({
    type: t.Literal("model"),
    model: t.String({ minLength: 1 }),
  }),
  t.Object({
    type: t.Literal("agent"),
    agentId: t.String({ minLength: 1 }),
  }),
])

export const aiResourceRoutes = new Elysia({ name: "ai-resource-routes" })
  .get("/ai/models", async ({ request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return failure(set, 401, "Unauthorized")
    return listAiModels()
  })
  .get("/resources/:id/agent", async ({ params, request, set }) => {
    const access = await authorizeResource(request, params.id)
    if (access.failure) {
      return failure(set, access.failure.status, access.failure.message)
    }
    if (access.resource.kind !== "agent") {
      return failure(set, 400, "Resource is not an agent")
    }

    const agent = await findAgent(params.id)
    if (!agent) return failure(set, 404, "Agent content not found")
    return { agent, models: listAiModels() }
  })
  .patch(
    "/resources/:id/agent",
    async ({ body, params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return failure(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "agent") {
        return failure(set, 400, "Resource is not an agent")
      }
      if (body.model !== undefined && !isKnownAiModel(body.model)) {
        return failure(set, 400, "Unknown AI model")
      }

      const changes: {
        model?: string
        persona?: string | null
        systemPrompt?: string | null
        updatedAt: Date
      } = { updatedAt: new Date() }
      if (body.model !== undefined) changes.model = body.model
      if (body.persona !== undefined) {
        changes.persona = body.persona?.trim() || null
      }
      if (body.systemPrompt !== undefined) {
        changes.systemPrompt = body.systemPrompt?.trim() || null
      }

      const [agent] = await db
        .update(schema.resourceAgent)
        .set(changes)
        .where(eq(schema.resourceAgent.id, params.id))
        .returning()
      if (!agent) return failure(set, 404, "Agent content not found")
      await touchResource(params.id)
      return agent
    },
    {
      body: t.Object({
        model: t.Optional(t.String({ minLength: 1 })),
        persona: t.Optional(t.Union([t.String(), t.Null()])),
        systemPrompt: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  )
  .get("/resources/:id/ai-chat", async ({ params, request, set }) => {
    const access = await authorizeResource(request, params.id)
    if (access.failure) {
      return failure(set, access.failure.status, access.failure.message)
    }
    if (access.resource.kind !== "ai-chat") {
      return failure(set, 400, "Resource is not an AI chat")
    }

    const [chat] = await db
      .select()
      .from(schema.resourceAiChat)
      .where(eq(schema.resourceAiChat.id, params.id))
      .limit(1)
    if (!chat) return failure(set, 404, "AI chat content not found")

    return {
      chat,
      models: listAiModels(),
      agents: await listWorkspaceAgents(access.resource.workspaceId),
    }
  })
  .patch(
    "/resources/:id/ai-chat",
    async ({ body, params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return failure(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "ai-chat") {
        return failure(set, 400, "Resource is not an AI chat")
      }

      const changes: { model?: string; agentId?: string | null; updatedAt: Date } =
        { updatedAt: new Date() }
      if (body.target.type === "model") {
        if (!isKnownAiModel(body.target.model)) {
          return failure(set, 400, "Unknown AI model")
        }
        changes.model = body.target.model
        changes.agentId = null
      } else {
        const agent = await findAgent(body.target.agentId)
        if (!agent || agent.workspaceId !== access.resource.workspaceId) {
          return failure(set, 400, "Agent must be in the same workspace")
        }
        changes.agentId = agent.id
      }

      const [chat] = await db
        .update(schema.resourceAiChat)
        .set(changes)
        .where(eq(schema.resourceAiChat.id, params.id))
        .returning()
      if (!chat) return failure(set, 404, "AI chat content not found")
      await touchResource(params.id)
      return chat
    },
    { body: t.Object({ target: chatTarget }) }
  )
  .post(
    "/resources/:id/ai-chat/messages",
    async ({ body, params, request, set }) => {
      const access = await authorizeResource(request, params.id)
      if (access.failure) {
        return failure(set, access.failure.status, access.failure.message)
      }
      if (access.resource.kind !== "ai-chat") {
        return failure(set, 400, "Resource is not an AI chat")
      }

      const [chat] = await db
        .select()
        .from(schema.resourceAiChat)
        .where(eq(schema.resourceAiChat.id, params.id))
        .limit(1)
      if (!chat) return failure(set, 404, "AI chat content not found")

      const validation = await safeValidateUIMessages<UIMessage>({
        messages: body.messages,
      })
      if (!validation.success) {
        return failure(set, 400, "Invalid chat messages")
      }

      let modelId = chat.model
      let instructions: string | undefined
      if (chat.agentId) {
        const agent = await findAgent(chat.agentId)
        if (!agent || agent.workspaceId !== access.resource.workspaceId) {
          return failure(set, 400, "Selected agent is unavailable")
        }
        modelId = agent.model
        instructions = agentInstructions(agent) || undefined
      }

      const resolved = resolveAiModel(modelId)
      if (!resolved.ok) return failure(set, 503, resolved.error)

      const result = streamText({
        model: resolved.model,
        system: instructions,
        messages: await convertToModelMessages(validation.data),
      })
      const stream = toUIMessageStream({
        stream: result.stream,
        originalMessages: validation.data,
        onEnd: async ({ messages }) => {
          await db
            .update(schema.resourceAiChat)
            .set({ messages, updatedAt: new Date() })
            .where(eq(schema.resourceAiChat.id, params.id))
          await touchResource(params.id)
        },
        onError: (streamError) => {
          console.error("AI chat stream failed", streamError)
          return "The model could not complete this response."
        },
      })

      return createUIMessageStreamResponse({ stream })
    },
    {
      body: t.Object({
        id: t.Optional(t.String()),
        messages: t.Array(t.Any(), { maxItems: 200 }),
        trigger: t.Optional(t.String()),
        messageId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  )
