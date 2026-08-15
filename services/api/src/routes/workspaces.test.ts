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
let member: TestUser
let candidate: TestUser
let ownerHeaders: Headers
let memberHeaders: Headers
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
  const body = (await response.json()) as {
    id: string
    name: string
    slug: string
  }
  workspaceIds.push(body.id)
  return body
}

beforeAll(async () => {
  helpers = (await testAuth.$context).test
  const suffix = crypto.randomUUID()
  owner = helpers.createUser({
    name: "Workspace Owner",
    email: `owner-${suffix}@example.com`,
  })
  member = helpers.createUser({
    name: "Workspace Member",
    email: `member-${suffix}@example.com`,
  })
  candidate = helpers.createUser({
    name: "Candidate Member",
    email: `candidate-${suffix}@example.com`,
  })

  await Promise.all([
    helpers.saveUser(owner),
    helpers.saveUser(member),
    helpers.saveUser(candidate),
  ])
  ;[ownerHeaders, memberHeaders] = await Promise.all([
    helpers.getAuthHeaders({ userId: owner.id }),
    helpers.getAuthHeaders({ userId: member.id }),
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
    helpers.deleteUser(member.id),
    helpers.deleteUser(candidate.id),
  ])
})

describe("workspace routes", () => {
  test("rejects unauthenticated workspace creation", async () => {
    const response = await request("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Private" }),
    })

    expect(response.status).toBe(401)
  })

  test("creates a workspace with its creator as owner", async () => {
    const body = await createWorkspace("Acme Research")

    expect(body.name).toBe("Acme Research")
    expect(body.slug).toMatch(/^acme-research-[a-f0-9]{8}$/)

    const membership = await db.query.workspaceMember.findFirst({
      where: (row, { and, eq }) =>
        and(eq(row.workspaceId, body.id), eq(row.userId, owner.id)),
    })
    expect(membership?.role).toBe("owner")
  })

  test("lists and returns only workspaces the user belongs to", async () => {
    const visible = await createWorkspace("Visible")
    await createWorkspace("Owner Only")
    await db.insert(schema.workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: visible.id,
      userId: member.id,
      role: "member",
    })

    const listResponse = await request("/workspaces", {}, memberHeaders)
    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toEqual([visible])

    const detailResponse = await request(
      `/workspaces/${visible.id}`,
      {},
      memberHeaders
    )
    expect(detailResponse.status).toBe(200)
    expect(await detailResponse.json()).toEqual(visible)

    const hiddenResponse = await request(
      `/workspaces/${workspaceIds.at(-1)}`,
      {},
      memberHeaders
    )
    expect(hiddenResponse.status).toBe(404)
  })

  test("only owners can add members and the role defaults to member", async () => {
    const workspace = await createWorkspace("Team")
    await db.insert(schema.workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      userId: member.id,
      role: "member",
    })

    const forbidden = await request(
      `/workspaces/${workspace.id}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email }),
      },
      memberHeaders
    )
    expect(forbidden.status).toBe(403)

    const added = await request(
      `/workspaces/${workspace.id}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email }),
      },
      ownerHeaders
    )
    expect(added.status).toBe(200)
    expect(await added.json()).toMatchObject({
      userId: candidate.id,
      email: candidate.email,
      role: "member",
    })

    const members = await request(
      `/workspaces/${workspace.id}/members`,
      {},
      memberHeaders
    )
    expect(members.status).toBe(200)
    expect(await members.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: owner.id, role: "owner" }),
        expect.objectContaining({ userId: member.id, role: "member" }),
        expect.objectContaining({ userId: candidate.id, role: "member" }),
      ])
    )
  })

  test("does not allow owners to be added through the member endpoint", async () => {
    const workspace = await createWorkspace("No Co-owners")

    const response = await request(
      `/workspaces/${workspace.id}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email, role: "owner" }),
      },
      ownerHeaders
    )

    expect(response.status).toBe(422)
  })
})
