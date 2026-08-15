import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"
import { auth } from "./auth"
import { serverEnv } from "./env"
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

if (import.meta.main) {
  app.listen(3000)
  console.log("api listening on :3000")
}
