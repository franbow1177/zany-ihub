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
let nonParticipant: TestUser
let ownerHeaders: Headers
let outsiderHeaders: Headers
let nonParticipantHeaders: Headers
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
    kind:
      | "folder"
      | "file"
      | "doc"
      | "table"
      | "whiteboard"
      | "project"
      | "bookmark"
      | "agent"
      | "ai-chat"
      | "chat"
    parentId?: string
    description?: string | null
    icon?: string | null
    bookmark?:
      | { type: "resource"; resourceId: string }
      | { type: "url"; url: string }
    chatMemberIds?: string[]
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
    description: string | null
    icon: string | null
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
  nonParticipant = helpers.createUser({
    name: "Channel Nonparticipant",
    email: `channel-nonparticipant-${suffix}@example.com`,
  })

  await Promise.all([
    helpers.saveUser(owner),
    helpers.saveUser(outsider),
    helpers.saveUser(nonParticipant),
  ])
  ;[ownerHeaders, outsiderHeaders, nonParticipantHeaders] = await Promise.all([
    helpers.getAuthHeaders({ userId: owner.id }),
    helpers.getAuthHeaders({ userId: outsider.id }),
    helpers.getAuthHeaders({ userId: nonParticipant.id }),
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
    helpers.deleteUser(nonParticipant.id),
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

  test("creates and updates shared resource description and icon", async () => {
    const workspace = await createWorkspace("Resource Metadata")
    const resource = await createResource(workspace.id, {
      name: "Launch plan",
      kind: "project",
      description: "Ship the next release",
      icon: "🚀",
    })

    expect(resource).toMatchObject({
      description: "Ship the next release",
      icon: "🚀",
    })

    const response = await request(
      `/resources/${resource.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          description: "Updated plan",
          icon: null,
        }),
      },
      ownerHeaders
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      description: "Updated plan",
      icon: null,
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

  test("creates database content rows for documents and tables", async () => {
    const workspace = await createWorkspace("Persistent Content")
    const document = await createResource(workspace.id, {
      name: "Notes",
      kind: "doc",
    })
    const table = await createResource(workspace.id, {
      name: "Tracker",
      kind: "table",
    })

    const [documentContent] = await db
      .select()
      .from(schema.resourceDocument)
      .where(eq(schema.resourceDocument.id, document.id))
      .limit(1)
    const [tableContent] = await db
      .select()
      .from(schema.resourceTable)
      .where(eq(schema.resourceTable.id, table.id))
      .limit(1)

    expect(documentContent).toMatchObject({ id: document.id, content: "" })
    expect(tableContent?.id).toBe(table.id)
    expect(tableContent?.data.columns).toHaveLength(4)
    expect(tableContent?.data.rows).toHaveLength(1)
  })

  test("lists every resource in a workspace for shell navigation", async () => {
    const workspace = await createWorkspace("All Resources")
    const folder = await createResource(workspace.id, {
      name: "Projects",
      kind: "folder",
    })
    const doc = await createResource(workspace.id, {
      name: "Nested roadmap",
      kind: "doc",
      parentId: folder.id,
    })

    const response = await request(
      `/workspaces/${workspace.id}/resources?scope=all`,
      {},
      ownerHeaders
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: folder.id }),
        expect.objectContaining({ id: doc.id, parentId: folder.id }),
      ])
    )
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

  test("rejects moving a folder beneath one of its descendants", async () => {
    const workspace = await createWorkspace("Cycle Prevention")
    const parent = await createResource(workspace.id, {
      name: "Parent",
      kind: "folder",
    })
    const child = await createResource(workspace.id, {
      name: "Child",
      kind: "folder",
      parentId: parent.id,
    })
    const grandchild = await createResource(workspace.id, {
      name: "Grandchild",
      kind: "folder",
      parentId: child.id,
    })

    const response = await request(
      `/resources/${parent.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ parentId: grandchild.id }),
      },
      ownerHeaders
    )

    expect(response.status).toBe(400)
  })

  test("rejects an empty parent id when moving a resource", async () => {
    const workspace = await createWorkspace("Empty Parent")
    const folder = await createResource(workspace.id, {
      name: "Folder",
      kind: "folder",
    })

    const response = await request(
      `/resources/${folder.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ parentId: "" }),
      },
      ownerHeaders
    )

    expect(response.status).toBe(422)
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

  test("returns a single resource for members", async () => {
    const workspace = await createWorkspace("Resource Detail")
    const resource = await createResource(workspace.id, {
      name: "Notes",
      kind: "doc",
    })

    const response = await request(
      `/resources/${resource.id}`,
      {},
      ownerHeaders
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: resource.id,
      name: "Notes",
      kind: "doc",
      workspaceId: workspace.id,
    })
  })

  test("creates a resource_file row for file kind resources", async () => {
    const workspace = await createWorkspace("File Resource")
    const resource = await createResource(workspace.id, {
      name: "Upload me",
      kind: "file",
    })

    const response = await request(
      `/resources/${resource.id}`,
      {},
      ownerHeaders
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: resource.id,
      kind: "file",
      file: { uploaded: false },
    })
  })

  test("creates a channel for chat resources and exposes it in navigation", async () => {
    const workspace = await createWorkspace("Chat Channel")
    const missingMembersResponse = await request(
      `/workspaces/${workspace.id}/resources`,
      {
        method: "POST",
        body: JSON.stringify({ name: "Empty channel", kind: "chat" }),
      },
      ownerHeaders
    )
    expect(missingMembersResponse.status).toBe(400)

    await db.insert(schema.workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      userId: outsider.id,
      role: "member",
    })
    await db.insert(schema.workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      userId: nonParticipant.id,
      role: "member",
    })
    const resource = await createResource(workspace.id, {
      name: "General",
      kind: "chat",
      chatMemberIds: [outsider.id],
    })

    const chat = await db.query.resourceChat.findFirst({
      where: (row, { eq }) => eq(row.id, resource.id),
    })
    expect(chat).toMatchObject({
      id: resource.id,
      type: "channel",
      targetResourceId: null,
      directKey: null,
    })
    const participants = await db.query.chatParticipant.findMany({
      where: (row, { eq }) => eq(row.chatId, resource.id),
    })
    expect(
      participants.map((participant) => participant.userId).sort()
    ).toEqual([owner.id, outsider.id].sort())

    const response = await request(
      `/workspaces/${workspace.id}/resources?scope=all`,
      {},
      ownerHeaders
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: resource.id,
          name: "General",
          kind: "chat",
        }),
      ])
    )

    const hiddenListResponse = await request(
      `/workspaces/${workspace.id}/resources?scope=all`,
      {},
      nonParticipantHeaders
    )
    expect(hiddenListResponse.status).toBe(200)
    expect(await hiddenListResponse.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: resource.id })])
    )

    const hiddenDetailResponse = await request(
      `/resources/${resource.id}`,
      {},
      nonParticipantHeaders
    )
    expect(hiddenDetailResponse.status).toBe(404)
  })

  test("supports multiple editable threads attached to one resource", async () => {
    const workspace = await createWorkspace("Resource Threads")
    const target = await createResource(workspace.id, {
      name: "Launch plan",
      kind: "doc",
    })
    const firstThreadId = crypto.randomUUID()
    const secondThreadId = crypto.randomUUID()

    await db.transaction(async (tx) => {
      await tx.insert(schema.resource).values([
        {
          id: firstThreadId,
          workspaceId: workspace.id,
          kind: "chat",
          name: "Decisions",
          createdBy: owner.id,
        },
        {
          id: secondThreadId,
          workspaceId: workspace.id,
          kind: "chat",
          name: "Open questions",
          createdBy: owner.id,
        },
      ])
      await tx.insert(schema.resourceChat).values([
        {
          id: firstThreadId,
          type: "thread",
          targetResourceId: target.id,
        },
        {
          id: secondThreadId,
          type: "thread",
          targetResourceId: target.id,
        },
      ])
    })

    const updateResponse = await request(
      `/resources/${firstThreadId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Final decisions", icon: "bubble-chat" }),
      },
      ownerHeaders
    )
    expect(updateResponse.status).toBe(200)
    expect(await updateResponse.json()).toMatchObject({
      id: firstThreadId,
      name: "Final decisions",
      icon: "bubble-chat",
    })

    const deleteResponse = await request(
      `/resources/${target.id}`,
      { method: "DELETE" },
      ownerHeaders
    )
    expect(deleteResponse.status).toBe(200)
    const remainingThreads = await db.query.resource.findMany({
      where: (row, { inArray }) =>
        inArray(row.id, [firstThreadId, secondThreadId]),
    })
    expect(remainingThreads).toEqual([])
  })

  test("creates and saves a whiteboard with optimistic revisions", async () => {
    const workspace = await createWorkspace("Whiteboard Resource")
    const resource = await createResource(workspace.id, {
      name: "Ideas",
      kind: "whiteboard",
    })

    const initialResponse = await request(
      `/resources/${resource.id}/whiteboard`,
      {},
      ownerHeaders
    )
    expect(initialResponse.status).toBe(200)
    expect(await initialResponse.json()).toMatchObject({
      revision: 0,
      scene: { elements: [], appState: {} },
      assets: [],
    })

    const scene = {
      elements: [{ id: "shape-1", type: "rectangle" }],
      appState: { viewBackgroundColor: "#ffffff" },
    }
    const saveResponse = await request(
      `/resources/${resource.id}/whiteboard`,
      {
        method: "PATCH",
        body: JSON.stringify({ revision: 0, scene }),
      },
      ownerHeaders
    )
    expect(saveResponse.status).toBe(200)
    expect(await saveResponse.json()).toMatchObject({ revision: 1, scene })

    const staleResponse = await request(
      `/resources/${resource.id}/whiteboard`,
      {
        method: "PATCH",
        body: JSON.stringify({ revision: 0, scene }),
      },
      ownerHeaders
    )
    expect(staleResponse.status).toBe(409)
  })

  test("creates a project and manages its tasks", async () => {
    const workspace = await createWorkspace("Project Resource")
    const resource = await createResource(workspace.id, {
      name: "Launch",
      kind: "project",
    })

    const createTaskResponse = await request(
      `/resources/${resource.id}/tasks`,
      {
        method: "POST",
        body: JSON.stringify({ title: "Ship the first release" }),
      },
      ownerHeaders
    )
    expect(createTaskResponse.status).toBe(200)
    const task = (await createTaskResponse.json()) as { id: string }

    const updateTaskResponse = await request(
      `/tasks/${task.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      },
      ownerHeaders
    )
    expect(updateTaskResponse.status).toBe(200)
    expect(await updateTaskResponse.json()).toMatchObject({
      id: task.id,
      status: "done",
    })

    const projectResponse = await request(
      `/resources/${resource.id}/project`,
      {},
      ownerHeaders
    )
    expect(projectResponse.status).toBe(200)
    expect(await projectResponse.json()).toMatchObject({
      project: { id: resource.id, status: "active" },
      tasks: [{ id: task.id, status: "done" }],
    })
  })

  test("creates agents and selects them from persistent AI chats", async () => {
    const workspace = await createWorkspace("AI Resources")
    const agent = await createResource(workspace.id, {
      name: "Product coach",
      kind: "agent",
    })
    const chat = await createResource(workspace.id, {
      name: "Planning chat",
      kind: "ai-chat",
    })

    const updateAgentResponse = await request(
      `/resources/${agent.id}/agent`,
      {
        method: "PATCH",
        body: JSON.stringify({
          model: "anthropic/claude-haiku-4.5",
          persona: "A pragmatic product coach",
          systemPrompt: "Ask one clarifying question at a time.",
        }),
      },
      ownerHeaders
    )
    expect(updateAgentResponse.status).toBe(200)
    expect(await updateAgentResponse.json()).toMatchObject({
      id: agent.id,
      model: "anthropic/claude-haiku-4.5",
      persona: "A pragmatic product coach",
    })

    const updateChatResponse = await request(
      `/resources/${chat.id}/ai-chat`,
      {
        method: "PATCH",
        body: JSON.stringify({
          target: { type: "agent", agentId: agent.id },
        }),
      },
      ownerHeaders
    )
    expect(updateChatResponse.status).toBe(200)
    expect(await updateChatResponse.json()).toMatchObject({
      id: chat.id,
      agentId: agent.id,
      messages: [],
    })

    const chatResponse = await request(
      `/resources/${chat.id}/ai-chat`,
      {},
      ownerHeaders
    )
    expect(chatResponse.status).toBe(200)
    expect(await chatResponse.json()).toMatchObject({
      chat: { id: chat.id, agentId: agent.id, messages: [] },
      agents: [{ id: agent.id, name: "Product coach" }],
    })
  })

  test("creates bookmarks for external URLs and workspace resources", async () => {
    const workspace = await createWorkspace("Bookmark Resource")
    const target = await createResource(workspace.id, {
      name: "Target document",
      kind: "doc",
    })
    const external = await createResource(workspace.id, {
      name: "Example",
      kind: "bookmark",
      bookmark: { type: "url", url: "https://example.com" },
    })
    const internal = await createResource(workspace.id, {
      name: "Document shortcut",
      kind: "bookmark",
      bookmark: { type: "resource", resourceId: target.id },
    })

    const externalResponse = await request(
      `/resources/${external.id}/bookmark`,
      {},
      ownerHeaders
    )
    expect(externalResponse.status).toBe(200)
    expect(await externalResponse.json()).toMatchObject({
      target: { type: "url", url: "https://example.com/" },
    })

    const internalResponse = await request(
      `/resources/${internal.id}/bookmark`,
      {},
      ownerHeaders
    )
    expect(internalResponse.status).toBe(200)
    expect(await internalResponse.json()).toMatchObject({
      target: {
        type: "resource",
        resourceId: target.id,
        resource: { id: target.id, name: "Target document", kind: "doc" },
      },
    })
  })

  test("requires a valid target when creating a bookmark", async () => {
    const workspace = await createWorkspace("Invalid Bookmark")

    const missingResponse = await request(
      `/workspaces/${workspace.id}/resources`,
      {
        method: "POST",
        body: JSON.stringify({ name: "Missing", kind: "bookmark" }),
      },
      ownerHeaders
    )
    expect(missingResponse.status).toBe(400)

    const unsafeResponse = await request(
      `/workspaces/${workspace.id}/resources`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Unsafe",
          kind: "bookmark",
          bookmark: { type: "url", url: "javascript:alert(1)" },
        }),
      },
      ownerHeaders
    )
    expect(unsafeResponse.status).toBe(400)
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
