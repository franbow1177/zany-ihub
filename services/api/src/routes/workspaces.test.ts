import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { db, schema } from "@workspace/db"
import { eq } from "drizzle-orm"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { testUtils } from "better-auth/plugins"
import type { TestHelpers } from "better-auth/plugins"
import { app } from "../index"
import { hashInvitationToken } from "../lib/invitations"

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
let candidateHeaders: Headers
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
  ;[ownerHeaders, memberHeaders, candidateHeaders] = await Promise.all([
    helpers.getAuthHeaders({ userId: owner.id }),
    helpers.getAuthHeaders({ userId: member.id }),
    helpers.getAuthHeaders({ userId: candidate.id }),
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

  test("exposes append-only audit history to owners only", async () => {
    const workspace = await createWorkspace("Audited Team")
    const memberId = crypto.randomUUID()
    await db.insert(schema.workspaceMember).values({
      id: memberId,
      workspaceId: workspace.id,
      userId: member.id,
      role: "member",
    })

    const forbidden = await request(
      `/workspaces/${workspace.id}/audit-events`,
      {},
      memberHeaders
    )
    expect(forbidden.status).toBe(403)

    const response = await request(
      `/workspaces/${workspace.id}/audit-events`,
      {},
      ownerHeaders
    )
    expect(response.status).toBe(200)
    const page = (await response.json()) as {
      events: Array<{
        action: string
        actorId: string
        targetId: string
        targetLabel: string
        source: string
      }>
      nextCursor: string | null
    }
    expect(page.events[0]).toMatchObject({
      action: "workspace.created",
      actorId: owner.id,
      targetId: workspace.id,
      targetLabel: "Audited Team",
      source: "api",
    })
    expect(page.nextCursor).toBeNull()

    await db
      .delete(schema.workspaceMember)
      .where(eq(schema.workspaceMember.id, memberId))

    let mutationError: unknown
    try {
      await db
        .update(schema.auditEvent)
        .set({ targetLabel: "tampered" })
        .where(eq(schema.auditEvent.workspaceId, workspace.id))
    } catch (error) {
      mutationError = error
    }
    expect(mutationError).toBeDefined()
    expect(String((mutationError as { cause?: unknown }).cause)).toContain(
      "audit_event is append-only"
    )
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

  test("only owners can create invitations", async () => {
    const workspace = await createWorkspace("Team")
    await db.insert(schema.workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      userId: member.id,
      role: "member",
    })

    const forbidden = await request(
      `/workspaces/${workspace.id}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email }),
      },
      memberHeaders
    )
    expect(forbidden.status).toBe(403)

    const created = await request(
      `/workspaces/${workspace.id}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email }),
      },
      ownerHeaders
    )
    expect(created.status).toBe(200)
    const body = (await created.json()) as {
      id: string
      email: string
      status: string
      inviteUrl: string
    }
    expect(body).toMatchObject({
      email: candidate.email,
      status: "pending",
    })
    expect(body.inviteUrl).toContain("/invite/")

    const token = new URL(body.inviteUrl).pathname.split("/").at(-1)!
    const stored = await db.query.workspaceInvitation.findFirst({
      where: (row, { eq }) => eq(row.id, body.id),
    })
    expect(stored?.tokenHash).toBe(await hashInvitationToken(token))
    expect(stored?.tokenHash).not.toBe(token)

    const forbiddenList = await request(
      `/workspaces/${workspace.id}/invitations`,
      {},
      memberHeaders
    )
    expect(forbiddenList.status).toBe(403)
  })

  test("invites an email that has never signed in", async () => {
    const workspace = await createWorkspace("Future Collaborator")
    const email = `future-${crypto.randomUUID()}@example.com`

    const response = await request(
      `/workspaces/${workspace.id}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
      ownerHeaders
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ email, status: "pending" })
  })

  test("accepts an invitation with the matching Google account", async () => {
    const workspace = await createWorkspace("Joinable Team")

    const inviteResponse = await request(
      `/workspaces/${workspace.id}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email }),
      },
      ownerHeaders
    )
    const invitation = (await inviteResponse.json()) as { inviteUrl: string }
    const token = new URL(invitation.inviteUrl).pathname.split("/").at(-1)!

    const preview = await request(`/invitations/${token}`)
    expect(preview.status).toBe(200)
    expect(await preview.json()).toMatchObject({
      workspaceName: "Joinable Team",
      inviterName: owner.name,
      status: "pending",
    })

    const unsigned = await request(`/invitations/${token}/accept`, {
      method: "POST",
    })
    expect(unsigned.status).toBe(401)

    const wrongAccount = await request(
      `/invitations/${token}/accept`,
      { method: "POST" },
      memberHeaders
    )
    expect(wrongAccount.status).toBe(403)

    const accepted = await request(
      `/invitations/${token}/accept`,
      { method: "POST" },
      candidateHeaders
    )
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toEqual(workspace)

    const repeated = await request(
      `/invitations/${token}/accept`,
      { method: "POST" },
      candidateHeaders
    )
    expect(repeated.status).toBe(200)

    const membership = await db.query.workspaceMember.findFirst({
      where: (row, { and, eq }) =>
        and(eq(row.workspaceId, workspace.id), eq(row.userId, candidate.id)),
    })
    expect(membership?.role).toBe("member")

    const pending = await request(
      `/workspaces/${workspace.id}/invitations`,
      {},
      ownerHeaders
    )
    expect(await pending.json()).toEqual([])

    await db
      .delete(schema.workspaceMember)
      .where(eq(schema.workspaceMember.id, membership!.id))
    const removedMemberRetry = await request(
      `/invitations/${token}/accept`,
      { method: "POST" },
      candidateHeaders
    )
    expect(removedMemberRetry.status).toBe(410)
  })

  test("rotates invitation tokens when resent", async () => {
    const workspace = await createWorkspace("Resend Team")
    const created = await request(
      `/workspaces/${workspace.id}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email }),
      },
      ownerHeaders
    )
    const first = (await created.json()) as { id: string; inviteUrl: string }
    const firstToken = new URL(first.inviteUrl).pathname.split("/").at(-1)!

    const resent = await request(
      `/workspaces/${workspace.id}/invitations/${first.id}/resend`,
      { method: "POST" },
      ownerHeaders
    )
    expect(resent.status).toBe(200)
    const second = (await resent.json()) as { inviteUrl: string }
    expect(second.inviteUrl).not.toBe(first.inviteUrl)

    expect((await request(`/invitations/${firstToken}`)).status).toBe(404)
    const secondToken = new URL(second.inviteUrl).pathname.split("/").at(-1)!
    expect((await request(`/invitations/${secondToken}`)).status).toBe(200)
  })

  test("revokes a pending invitation", async () => {
    const workspace = await createWorkspace("Revoked Team")
    const created = await request(
      `/workspaces/${workspace.id}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email }),
      },
      ownerHeaders
    )
    const invitation = (await created.json()) as {
      id: string
      inviteUrl: string
    }
    const token = new URL(invitation.inviteUrl).pathname.split("/").at(-1)!

    const revoked = await request(
      `/workspaces/${workspace.id}/invitations/${invitation.id}`,
      { method: "DELETE" },
      ownerHeaders
    )
    expect(revoked.status).toBe(204)

    const accept = await request(
      `/invitations/${token}/accept`,
      { method: "POST" },
      candidateHeaders
    )
    expect(accept.status).toBe(410)
  })

  test("does not accept an expired invitation", async () => {
    const workspace = await createWorkspace("Expired Team")
    const created = await request(
      `/workspaces/${workspace.id}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email }),
      },
      ownerHeaders
    )
    const invitation = (await created.json()) as {
      id: string
      inviteUrl: string
    }
    const token = new URL(invitation.inviteUrl).pathname.split("/").at(-1)!
    await db
      .update(schema.workspaceInvitation)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.workspaceInvitation.id, invitation.id))

    const response = await request(
      `/invitations/${token}/accept`,
      { method: "POST" },
      candidateHeaders
    )
    expect(response.status).toBe(410)
    expect(
      await db.query.workspaceMember.findFirst({
        where: (row, { and, eq }) =>
          and(eq(row.workspaceId, workspace.id), eq(row.userId, candidate.id)),
      })
    ).toBeUndefined()
  })

  test("returns conflict when inviting an existing workspace member", async () => {
    const workspace = await createWorkspace("Duplicate Invite")
    await db.insert(schema.workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      userId: candidate.id,
      role: "member",
    })

    const response = await request(
      `/workspaces/${workspace.id}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email: candidate.email.toUpperCase() }),
      },
      ownerHeaders
    )

    expect(response.status).toBe(409)
  })

  test("lets owners manage members without removing the last owner", async () => {
    const workspace = await createWorkspace("Managed Team")
    const memberId = crypto.randomUUID()
    const ownerMembership = await db.query.workspaceMember.findFirst({
      where: (row, { and, eq }) =>
        and(eq(row.workspaceId, workspace.id), eq(row.userId, owner.id)),
    })
    await db.insert(schema.workspaceMember).values({
      id: memberId,
      workspaceId: workspace.id,
      userId: member.id,
      role: "member",
    })

    const forbidden = await request(
      `/workspaces/${workspace.id}/members/${ownerMembership!.id}`,
      { method: "DELETE" },
      memberHeaders
    )
    expect(forbidden.status).toBe(403)

    const lastOwnerDemotion = await request(
      `/workspaces/${workspace.id}/members/${ownerMembership!.id}`,
      { method: "PATCH", body: JSON.stringify({ role: "member" }) },
      ownerHeaders
    )
    expect(lastOwnerDemotion.status).toBe(409)

    const promoted = await request(
      `/workspaces/${workspace.id}/members/${memberId}`,
      { method: "PATCH", body: JSON.stringify({ role: "owner" }) },
      ownerHeaders
    )
    expect(promoted.status).toBe(200)
    expect(await promoted.json()).toMatchObject({ id: memberId, role: "owner" })

    const demoted = await request(
      `/workspaces/${workspace.id}/members/${ownerMembership!.id}`,
      { method: "PATCH", body: JSON.stringify({ role: "member" }) },
      memberHeaders
    )
    expect(demoted.status).toBe(200)

    const removed = await request(
      `/workspaces/${workspace.id}/members/${ownerMembership!.id}`,
      { method: "DELETE" },
      memberHeaders
    )
    expect(removed.status).toBe(204)

    const lastOwnerRemoval = await request(
      `/workspaces/${workspace.id}/members/${memberId}`,
      { method: "DELETE" },
      memberHeaders
    )
    expect(lastOwnerRemoval.status).toBe(409)
  })
})
