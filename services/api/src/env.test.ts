import { describe, expect, test } from "bun:test"
import { readServerEnv } from "./env"

const completeEnv = {
  DATABASE_URL: "postgres://localhost/test",
  BETTER_AUTH_SECRET: "test-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:5173",
}

describe("server environment", () => {
  test.each([
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "WEB_ORIGIN",
  ] as const)("rejects a missing %s", (name) => {
    expect(() =>
      readServerEnv({
        ...completeEnv,
        [name]: "",
      })
    ).toThrow(`Missing required environment variable: ${name}`)
  })

  test("allows Google OAuth credentials to be omitted", () => {
    expect(readServerEnv(completeEnv)).toEqual({
      ...completeEnv,
      S3_ENDPOINT: "http://localhost:9000",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
      S3_BUCKET: "zany-ihub",
      S3_REGION: "us-east-1",
      OPENROUTER_API_KEY: undefined,
    })
  })
})
