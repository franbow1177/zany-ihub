import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { db, schema } from "@workspace/db"
import { eq } from "drizzle-orm"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { testUtils } from "better-auth/plugins"
import type { TestHelpers } from "better-auth/plugins"
import { app } from "../index"

type TestUser = ReturnType<TestHelpers["createUser"]>

const testAuth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [testUtils()],
})

let helpers: TestHelpers
let owner: TestUser
let outsider: TestUser
let ownerHeaders: Headers
let outsiderHeaders: Headers
const workspaceIds: string[] = []

async function request(
  path: string,
  init: RequestInit = {},
  headers?: Headers
) {
  const requestHeaders = new Headers(headers)
  if (init.body) requestHeaders.set("content-type", "application/json")

  return app.handle(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: requestHeaders,
    })
  )
}

async function createWorkspace(name: string) {
  const response = await request(
    "/workspaces",
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
    ownerHeaders
  )
  expect(response.status).toBe(200)
  const workspace = (await response.json()) as { id: string }
  workspaceIds.push(workspace.id)
  return workspace
}

async function createResource(
  workspaceId: string,
  input: {
    name: string
    kind: "folder" | "file" | "doc" | "table"
    parentId?: string
  }
) {
  const response = await request(
    `/workspaces/${workspaceId}/resources`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    ownerHeaders
  )
  expect(response.status).toBe(200)
  return (await response.json()) as {
    id: string
    workspaceId: string
    parentId: string | null
    name: string
    kind: string
  }
}

beforeAll(async () => {
  helpers = (await testAuth.$context).test
  const suffix = crypto.randomUUID()
  owner = helpers.createUser({
    name: "Resource Owner",
    email: `resource-owner-${suffix}@example.com`,
  })
  outsider = helpers.createUser({
    name: "Resource Outsider",
    email: `resource-outsider-${suffix}@example.com`,
  })

  await Promise.all([helpers.saveUser(owner), helpers.saveUser(outsider)])
  ;[ownerHeaders, outsiderHeaders] = await Promise.all([
    helpers.getAuthHeaders({ userId: owner.id }),
    helpers.getAuthHeaders({ userId: outsider.id }),
  ])
})

afterAll(async () => {
  for (const workspaceId of workspaceIds) {
    await db
      .delete(schema.workspace)
      .where(eq(schema.workspace.id, workspaceId))
  }
  await Promise.all([
    helpers.deleteUser(owner.id),
    helpers.deleteUser(outsider.id),
  ])
})

describe("resource routes", () => {
  test("creates a folder at the workspace root", async () => {
    const workspace = await createWorkspace("Root Resources")

    const folder = await createResource(workspace.id, {
      name: "Projects",
      kind: "folder",
    })

    expect(folder).toMatchObject({
      workspaceId: workspace.id,
      parentId: null,
      name: "Projects",
      kind: "folder",
    })
  })

  test("creates and lists a doc under a folder", async () => {
    const workspace = await createWorkspace("Nested Resources")
    const folder = await createResource(workspace.id, {
      name: "Projects",
      kind: "folder",
    })
    const doc = await createResource(workspace.id, {
      name: "Roadmap",
      kind: "doc",
      parentId: folder.id,
    })

    expect(doc.parentId).toBe(folder.id)

    const response = await request(
      `/workspaces/${workspace.id}/resources?parentId=${folder.id}`,
      {},
      ownerHeaders
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([doc])
  })

  test("rejects a parent that is not a folder", async () => {
    const workspace = await createWorkspace("Invalid Parent")
    const doc = await createResource(workspace.id, {
      name: "Not a folder",
      kind: "doc",
    })

    const response = await request(
      `/workspaces/${workspace.id}/resources`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Child",
          kind: "file",
          parentId: doc.id,
        }),
      },
      ownerHeaders
    )

    expect(response.status).toBe(400)
  })

  test("rejects listing beneath a resource that is not a folder", async () => {
    const workspace = await createWorkspace("Invalid List Parent")
    const doc = await createResource(workspace.id, {
      name: "Not a folder",
      kind: "doc",
    })

    const response = await request(
      `/workspaces/${workspace.id}/resources?parentId=${doc.id}`,
      {},
      ownerHeaders
    )

    expect(response.status).toBe(400)
  })

  test("moves a resource only beneath a folder", async () => {
    const workspace = await createWorkspace("Move Resources")
    const folder = await createResource(workspace.id, {
      name: "Destination",
      kind: "folder",
    })
    const doc = await createResource(workspace.id, {
      name: "Draft",
      kind: "doc",
    })

    const response = await request(
      `/resources/${doc.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Final", parentId: folder.id }),
      },
      ownerHeaders
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: doc.id,
      name: "Final",
      parentId: folder.id,
    })
  })

  test("returns conflict when deleting a folder with children", async () => {
    const workspace = await createWorkspace("Protected Folder")
    const folder = await createResource(workspace.id, {
      name: "Projects",
      kind: "folder",
    })
    await createResource(workspace.id, {
      name: "Child",
      kind: "table",
      parentId: folder.id,
    })

    const response = await request(
      `/resources/${folder.id}`,
      { method: "DELETE" },
      ownerHeaders
    )

    expect(response.status).toBe(409)
  })

  test("forbids non-members from listing resources", async () => {
    const workspace = await createWorkspace("Private Resources")

    const response = await request(
      `/workspaces/${workspace.id}/resources`,
      {},
      outsiderHeaders
    )

    expect(response.status).toBe(403)
  })
})
