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
  updateDocument,
  updateDocumentToolInput,
  updateTable,
  updateTableToolInput,
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

  test("appends document content and adds table columns and rows", async () => {
    const context = {
      workspaceId,
      actorId: owner.id,
      requestId: crypto.randomUUID(),
    }
    const document = await createResource(
      context,
      createResourceToolInput.parse({
        kind: "doc",
        name: "AI notes",
        document: { content: "<p>Existing note</p>" },
      })
    )
    const documentUpdate = await updateDocument(
      context,
      updateDocumentToolInput.parse({
        resourceId: document.resource.id,
        content: "<p>Appended by the assistant</p>",
      })
    )

    expect(documentUpdate).toMatchObject({
      success: true,
      resource: { id: document.resource.id, name: "AI notes", kind: "doc" },
      mode: "append",
    })
    const documentDetail = await getResource(workspaceId, {
      resourceId: document.resource.id,
      rowLimit: 100,
    })
    expect(documentDetail.content).toMatchObject({
      html: "<p>Existing note</p><p>Appended by the assistant</p>",
      truncated: false,
    })

    const table = await createResource(
      context,
      createResourceToolInput.parse({
        kind: "table",
        name: "AI tracker",
        table: {
          columns: [{ id: "task", name: "Task", kind: "text" }],
          rows: [{ id: "existing", values: { task: "Existing task" } }],
        },
      })
    )
    const tableUpdate = await updateTable(
      context,
      updateTableToolInput.parse({
        resourceId: table.resource.id,
        columns: [
          {
            id: "priority",
            name: "Priority",
            kind: "select",
            options: ["Low", "High"],
          },
        ],
        rows: [{ values: { task: "New task", priority: "High" } }],
      })
    )

    expect(tableUpdate).toMatchObject({
      success: true,
      resource: { id: table.resource.id, name: "AI tracker", kind: "table" },
      addedColumnCount: 1,
      addedRowCount: 1,
      columnCount: 2,
      rowCount: 2,
    })
    const tableDetail = await getResource(workspaceId, {
      resourceId: table.resource.id,
      rowLimit: 100,
    })
    expect(tableDetail.content).toMatchObject({
      rowCount: 2,
      rows: [
        { id: "existing", task: "Existing task", priority: "Low" },
        expect.objectContaining({ task: "New task", priority: "High" }),
      ],
    })

    const documentAudit = await db.query.auditEvent.findFirst({
      where: (row, { and, eq }) =>
        and(
          eq(row.workspaceId, workspaceId),
          eq(row.targetId, document.resource.id),
          eq(row.action, "document.content_updated")
        ),
    })
    const tableAudit = await db.query.auditEvent.findFirst({
      where: (row, { and, eq }) =>
        and(
          eq(row.workspaceId, workspaceId),
          eq(row.targetId, table.resource.id),
          eq(row.action, "table.data_updated")
        ),
    })
    expect(documentAudit?.actorId).toBe(owner.id)
    expect(tableAudit?.actorId).toBe(owner.id)
  })
})
