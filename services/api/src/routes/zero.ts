import { mustGetMutator, mustGetQuery } from "@rocicorp/zero"
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { schema } from "@workspace/zero/schema"
import { Elysia } from "elysia"

import { isKnownAiModel } from "../lib/ai-models"
import { requestId } from "../lib/audit"
import { getSessionUser } from "../lib/session"
import { dbProvider } from "../zero/db-provider"

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}

function assertKnownModel(name: string, args: unknown) {
  if (!args || typeof args !== "object") return
  const value = args as Record<string, unknown>

  if (
    name === "agents.update" &&
    typeof value.model === "string" &&
    !isKnownAiModel(value.model)
  ) {
    throw new Error("Unknown AI model")
  }

  if (name === "chats.updateTarget") {
    const target = value.target
    if (
      target &&
      typeof target === "object" &&
      (target as Record<string, unknown>).type === "model"
    ) {
      const model = (target as Record<string, unknown>).model
      if (typeof model !== "string" || !isKnownAiModel(model)) {
        throw new Error("Unknown AI model")
      }
    }
  }
}

export const zeroRoutes = new Elysia({ name: "zero-routes" })
  .post("/api/zero/query", async ({ request }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized()
    const ctx = { userID: sessionUser.id, requestID: requestId(request) }

    const result = await handleQueryRequest({
      handler: (name, args) => {
        const query = mustGetQuery(queries, name)
        return query.fn({ args, ctx })
      },
      request,
      schema,
      userID: sessionUser.id,
    })

    return Response.json(result)
  })
  .post("/api/zero/mutate", async ({ request }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized()
    const ctx = { userID: sessionUser.id, requestID: requestId(request) }

    const result = await handleMutateRequest({
      dbProvider,
      handler: (transact) =>
        transact((tx, name, args) => {
          assertKnownModel(name, args)
          const mutator = mustGetMutator(mutators, name)
          return mutator.fn({ args, ctx, tx })
        }),
      request,
      userID: sessionUser.id,
    })

    return Response.json(result)
  })
