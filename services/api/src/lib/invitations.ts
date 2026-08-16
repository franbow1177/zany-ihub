const INVITATION_TOKEN_BYTES = 32

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase()
}

export function generateInvitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITATION_TOKEN_BYTES))
  return Buffer.from(bytes).toString("base64url")
}

export async function hashInvitationToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  )

  return Buffer.from(digest).toString("hex")
}

export function invitationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + INVITATION_TTL_MS)
}

export function maskInvitationEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@")
  const visible = localPart.slice(0, 1)
  const hidden = "•".repeat(Math.max(3, localPart.length - visible.length))
  return `${visible}${hidden}@${domain}`
}

export type InvitationLifecycle = {
  acceptedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
}

export function invitationStatus(
  invitation: InvitationLifecycle,
  now = new Date()
) {
  if (invitation.acceptedAt) return "accepted" as const
  if (invitation.revokedAt) return "revoked" as const
  if (invitation.expiresAt <= now) return "expired" as const
  return "pending" as const
}
