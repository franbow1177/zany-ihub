import { describe, expect, test } from "bun:test"
import { app } from "./index"

describe("health", () => {
  test("GET /health", async () => {
    const response = await app.handle(new Request("http://localhost/health"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
