import { db, schema } from "@workspace/db"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { serverEnv } from "../env"
import { recordAuditEvent, requestId } from "../lib/audit"
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  invitationStatus,
  maskInvitationEmail,
  normalizeInvitationEmail,
} from "../lib/invitations"
import { newId } from "../lib/ids"
import { getSessionUser } from "../lib/session"

type ResponseSet = { status?: number | string }

function unauthorized(set: ResponseSet) {
  set.status = 401
  return { error: "Unauthorized" }
}

function notFound(set: ResponseSet) {
  set.status = 404
  return { error: "Invitation not found" }
}

function unavailable(set: ResponseSet, message: string) {
  set.status = 410
  return { error: message }
}

async function findMembership(workspaceId: string, userId: string) {
  return db.query.workspaceMember.findFirst({
    where: (row, { and, eq }) =>
      and(eq(row.workspaceId, workspaceId), eq(row.userId, userId)),
  })
}

async function requireOwner(
  workspaceId: string,
  userId: string,
  set: ResponseSet
) {
  const membership = await findMembership(workspaceId, userId)
  if (!membership) {
    set.status = 404
    return { error: "Workspace not found" } as const
  }
  if (membership.role !== "owner") {
    set.status = 403
    return { error: "Only workspace owners can manage invitations" } as const
  }
  return membership
}

function invitationView(
  invitation: typeof schema.workspaceInvitation.$inferSelect
) {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    status: invitationStatus(invitation),
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  }
}

function inviteUrl(token: string) {
  return `${serverEnv.WEB_ORIGIN.replace(/\/$/, "")}/invite/${token}`
}

async function findUserByEmail(email: string) {
  const [target] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = ${email}`)
    .limit(1)
  return target
}

export const invitationRoutes = new Elysia({ name: "invitation-routes" })
  .post(
    "/workspaces/:id/invitations",
    async ({ body, params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)
      const auditRequestId = requestId(request)

      const owner = await requireOwner(params.id, sessionUser.id, set)
      if ("error" in owner) return owner

      const email = normalizeInvitationEmail(body.email)
      const target = await findUserByEmail(email)
      if (target && (await findMembership(params.id, target.id))) {
        set.status = 409
        return { error: "User is already a workspace member" }
      }

      const token = generateInvitationToken()
      const tokenHash = await hashInvitationToken(token)
      const expiresAt = invitationExpiresAt()
      const existing = await db.query.workspaceInvitation.findFirst({
        where: (row, { and, eq }) =>
          and(eq(row.workspaceId, params.id), eq(row.email, email)),
      })
      const invitation = await db.transaction(async (tx) => {
        const [written] = await tx
          .insert(schema.workspaceInvitation)
          .values({
            id: newId(),
            workspaceId: params.id,
            email,
            tokenHash,
            invitedBy: sessionUser.id,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: [
              schema.workspaceInvitation.workspaceId,
              schema.workspaceInvitation.email,
            ],
            set: {
              tokenHash,
              invitedBy: sessionUser.id,
              expiresAt,
              acceptedAt: null,
              acceptedBy: null,
              revokedAt: null,
              updatedAt: new Date(),
            },
          })
          .returning()
        if (!written) throw new Error("Invitation write returned no row")
        await recordAuditEvent(tx, {
          workspaceId: params.id,
          actorId: sessionUser.id,
          action: existing ? "invitation.resent" : "invitation.created",
          targetType: "invitation",
          targetId: written.id,
          targetLabel: email,
          metadata: { expiresAt: written.expiresAt.toISOString() },
          requestId: auditRequestId,
        })
        return written
      })

      return { ...invitationView(invitation), inviteUrl: inviteUrl(token) }
    },
    {
      body: t.Object({ email: t.String({ format: "email" }) }),
    }
  )
  .get("/workspaces/:id/invitations", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)

    const owner = await requireOwner(params.id, sessionUser.id, set)
    if ("error" in owner) return owner

    const invitations = await db
      .select()
      .from(schema.workspaceInvitation)
      .where(
        and(
          eq(schema.workspaceInvitation.workspaceId, params.id),
          isNull(schema.workspaceInvitation.acceptedAt),
          isNull(schema.workspaceInvitation.revokedAt)
        )
      )
      .orderBy(desc(schema.workspaceInvitation.updatedAt))

    return invitations.map(invitationView)
  })
  .post(
    "/workspaces/:id/invitations/:invitationId/resend",
    async ({ params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)
      const auditRequestId = requestId(request)

      const owner = await requireOwner(params.id, sessionUser.id, set)
      if ("error" in owner) return owner

      const invitation = await db.query.workspaceInvitation.findFirst({
        where: (row, { and, eq }) =>
          and(eq(row.id, params.invitationId), eq(row.workspaceId, params.id)),
      })
      if (!invitation) return notFound(set)
      if (invitation.acceptedAt) {
        set.status = 409
        return { error: "Invitation has already been accepted" }
      }

      const token = generateInvitationToken()
      const updated = await db.transaction(async (tx) => {
        const [written] = await tx
          .update(schema.workspaceInvitation)
          .set({
            tokenHash: await hashInvitationToken(token),
            invitedBy: sessionUser.id,
            expiresAt: invitationExpiresAt(),
            revokedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workspaceInvitation.id, invitation.id))
          .returning()
        if (!written) throw new Error("Invitation update returned no row")
        await recordAuditEvent(tx, {
          workspaceId: params.id,
          actorId: sessionUser.id,
          action: "invitation.resent",
          targetType: "invitation",
          targetId: written.id,
          targetLabel: written.email,
          metadata: { expiresAt: written.expiresAt.toISOString() },
          requestId: auditRequestId,
        })
        return written
      })

      return { ...invitationView(updated), inviteUrl: inviteUrl(token) }
    }
  )
  .delete(
    "/workspaces/:id/invitations/:invitationId",
    async ({ params, request, set }) => {
      const sessionUser = await getSessionUser(request)
      if (!sessionUser) return unauthorized(set)
      const auditRequestId = requestId(request)

      const owner = await requireOwner(params.id, sessionUser.id, set)
      if ("error" in owner) return owner

      const revoked = await db.transaction(async (tx) => {
        const [written] = await tx
          .update(schema.workspaceInvitation)
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(schema.workspaceInvitation.id, params.invitationId),
              eq(schema.workspaceInvitation.workspaceId, params.id),
              isNull(schema.workspaceInvitation.acceptedAt)
            )
          )
          .returning({
            id: schema.workspaceInvitation.id,
            email: schema.workspaceInvitation.email,
          })
        if (!written) return null
        await recordAuditEvent(tx, {
          workspaceId: params.id,
          actorId: sessionUser.id,
          action: "invitation.revoked",
          targetType: "invitation",
          targetId: written.id,
          targetLabel: written.email,
          requestId: auditRequestId,
        })
        return written
      })

      if (!revoked) return notFound(set)
      set.status = 204
    }
  )
  .get("/invitations/:token", async ({ params, set }) => {
    const tokenHash = await hashInvitationToken(params.token)
    const [result] = await db
      .select({
        invitation: schema.workspaceInvitation,
        workspaceName: schema.workspace.name,
        inviterName: schema.user.name,
      })
      .from(schema.workspaceInvitation)
      .innerJoin(
        schema.workspace,
        eq(schema.workspaceInvitation.workspaceId, schema.workspace.id)
      )
      .innerJoin(
        schema.user,
        eq(schema.workspaceInvitation.invitedBy, schema.user.id)
      )
      .where(eq(schema.workspaceInvitation.tokenHash, tokenHash))
      .limit(1)

    if (!result) return notFound(set)
    return {
      workspaceName: result.workspaceName,
      inviterName: result.inviterName,
      invitedEmail: maskInvitationEmail(result.invitation.email),
      status: invitationStatus(result.invitation),
      expiresAt: result.invitation.expiresAt,
    }
  })
  .post("/invitations/:token/accept", async ({ params, request, set }) => {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) return unauthorized(set)
    const auditRequestId = requestId(request)

    const tokenHash = await hashInvitationToken(params.token)
    const result = await db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(schema.workspaceInvitation)
        .where(eq(schema.workspaceInvitation.tokenHash, tokenHash))
        .limit(1)
        .for("update")

      if (!invitation) return { failure: "not-found" as const }
      if (invitation.revokedAt) return { failure: "revoked" as const }
      if (invitation.expiresAt <= new Date()) {
        return { failure: "expired" as const }
      }
      if (normalizeInvitationEmail(sessionUser.email) !== invitation.email) {
        return { failure: "email-mismatch" as const }
      }
      const existingMembership = await tx.query.workspaceMember.findFirst({
        where: (row, { and, eq }) =>
          and(
            eq(row.workspaceId, invitation.workspaceId),
            eq(row.userId, sessionUser.id)
          ),
      })

      if (invitation.acceptedAt) {
        if (invitation.acceptedBy !== sessionUser.id || !existingMembership) {
          return { failure: "accepted" as const }
        }
      } else {
        if (!existingMembership) {
          await tx.insert(schema.workspaceMember).values({
            id: newId(),
            workspaceId: invitation.workspaceId,
            userId: sessionUser.id,
            role: "member",
          })
        }
        await tx
          .update(schema.workspaceInvitation)
          .set({
            acceptedAt: new Date(),
            acceptedBy: sessionUser.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.workspaceInvitation.id, invitation.id))
        await recordAuditEvent(tx, {
          workspaceId: invitation.workspaceId,
          actorId: sessionUser.id,
          action: "invitation.accepted",
          targetType: "invitation",
          targetId: invitation.id,
          targetLabel: invitation.email,
          requestId: auditRequestId,
        })
      }

      const [workspace] = await tx
        .select({
          id: schema.workspace.id,
          name: schema.workspace.name,
          slug: schema.workspace.slug,
        })
        .from(schema.workspace)
        .where(eq(schema.workspace.id, invitation.workspaceId))
        .limit(1)

      if (!workspace) throw new Error("Invitation workspace not found")
      return { workspace }
    })

    if ("workspace" in result) return result.workspace
    if (result.failure === "not-found") return notFound(set)
    if (result.failure === "email-mismatch") {
      set.status = 403
      return {
        error: "Sign in with the Google account that received this invitation",
      }
    }
    if (result.failure === "expired") {
      return unavailable(set, "Invitation has expired")
    }
    if (result.failure === "revoked") {
      return unavailable(set, "Invitation has been revoked")
    }
    return unavailable(set, "Invitation has already been accepted")
  })
