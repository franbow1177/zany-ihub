import { describe, expect, test } from "bun:test"
import { app } from "./index"

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173"

describe("auth mount", () => {
  test("serves better-auth beneath /api/auth", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/auth/get-session", {
        headers: { Origin: webOrigin },
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toBeNull()
    expect(response.headers.get("access-control-allow-origin")).toBe(webOrigin)
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true"
    )
  })
})
