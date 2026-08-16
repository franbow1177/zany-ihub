import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { db, schema } from "@workspace/db"
import { eq } from "drizzle-orm"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { testUtils, type TestHelpers } from "better-auth/plugins"
import { app } from "../index"
import {
  createResource,
  createResourceToolInput,
  getResource,
  listMembers,
  listResources,
} from "./ai-workspace-tools"

type TestUser = ReturnType<TestHelpers["createUser"]>

const testAuth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [testUtils()],
})

let helpers: TestHelpers
let owner: TestUser
let ownerHeaders: Headers
let workspaceId: string

beforeAll(async () => {
  helpers = (await testAuth.$context).test
  owner = helpers.createUser({
    name: "AI Tool Owner",
    email: `ai-tool-owner-${crypto.randomUUID()}@example.com`,
  })
  await helpers.saveUser(owner)
  ownerHeaders = await helpers.getAuthHeaders({ userId: owner.id })

  const response = await app.handle(
    new Request("http://localhost/workspaces", {
      method: "POST",
      headers: new Headers({
        ...Object.fromEntries(ownerHeaders),
        "content-type": "application/json",
      }),
      body: JSON.stringify({ name: "AI Tools" }),
    })
  )
  expect(response.status).toBe(200)
  workspaceId = ((await response.json()) as { id: string }).id
})

afterAll(async () => {
  if (workspaceId) {
    await db
      .delete(schema.workspace)
      .where(eq(schema.workspace.id, workspaceId))
  }
  if (owner) await helpers.deleteUser(owner.id)
})

describe("AI workspace tools", () => {
  test("create, list, and inspect a table with initial typed data", async () => {
    const input = createResourceToolInput.parse({
      kind: "table",
      name: "Launch tracker",
      description: "Owned by the AI tool test",
      table: {
        columns: [
          { id: "initiative", name: "Initiative", kind: "text" },
          {
            id: "status",
            name: "Status",
            kind: "select",
            options: ["Planned", "Shipped"],
          },
        ],
        rows: [
          {
            values: { initiative: "Tool support", status: "Shipped" },
          },
        ],
      },
    })

    const created = await createResource(
      {
        workspaceId,
        actorId: owner.id,
        requestId: crypto.randomUUID(),
      },
      input
    )

    expect(created).toMatchObject({
      success: true,
      resource: { kind: "table", name: "Launch tracker" },
      initialized: { table: { columnCount: 2, rowCount: 1 } },
    })

    const listed = await listResources(workspaceId, {
      kind: "table",
      limit: 50,
    })
    expect(listed.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.resource.id }),
      ])
    )

    const detail = await getResource(workspaceId, {
      resourceId: created.resource.id,
      rowLimit: 100,
    })
    expect(detail).toMatchObject({
      resource: { name: "Launch tracker", kind: "table" },
      content: {
        rowCount: 1,
        rows: [
          expect.objectContaining({
            initiative: "Tool support",
            status: "Shipped",
          }),
        ],
      },
    })

    const members = await listMembers(workspaceId, { limit: 50 })
    expect(members.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: owner.id, role: "owner" }),
      ])
    )

    const audit = await db.query.auditEvent.findFirst({
      where: (row, { and, eq }) =>
        and(
          eq(row.workspaceId, workspaceId),
          eq(row.targetId, created.resource.id),
          eq(row.action, "resource.created")
        ),
    })
    expect(audit?.actorId).toBe(owner.id)
  })
})
