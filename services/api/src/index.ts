import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"
import { auth } from "./auth"
import { serverEnv } from "./env"
import { resourceContentRoutes } from "./routes/resource-content"
import { resourceRoutes } from "./routes/resources"
import { workspaceRoutes } from "./routes/workspaces"

export const app = new Elysia()
  .use(
    cors({
      origin: serverEnv.WEB_ORIGIN,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  )
  .get("/health", () => ({ ok: true }))
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .use(workspaceRoutes)
  .use(resourceRoutes)
  .use(resourceContentRoutes)

if (import.meta.main) {
  app.listen({ port: 3000, hostname: "0.0.0.0" })
  console.log("api listening on :3000")
}
