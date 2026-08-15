import { describe, expect, test } from "bun:test"
import { app } from "./index"

describe("auth mount", () => {
  test("serves better-auth beneath /api/auth", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/auth/get-session", {
        headers: { Origin: "http://localhost:5173" },
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toBeNull()
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173"
    )
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true"
    )
  })
})
