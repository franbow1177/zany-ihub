import { describe, expect, test } from "bun:test"
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationStatus,
  maskInvitationEmail,
  normalizeInvitationEmail,
} from "./invitations"

describe("workspace invitation helpers", () => {
  test("normalizes invited emails", () => {
    expect(normalizeInvitationEmail("  Person@Example.COM ")).toBe(
      "person@example.com"
    )
  })

  test("generates opaque tokens and stable hashes", async () => {
    const first = generateInvitationToken()
    const second = generateInvitationToken()
    expect(first).not.toBe(second)
    expect(first.length).toBeGreaterThanOrEqual(40)
    expect(await hashInvitationToken(first)).toHaveLength(64)
    expect(await hashInvitationToken(first)).toBe(
      await hashInvitationToken(first)
    )
  })

  test("derives lifecycle status in terminal-state order", () => {
    const future = new Date(Date.now() + 60_000)
    const past = new Date(Date.now() - 60_000)
    expect(
      invitationStatus({ acceptedAt: null, revokedAt: null, expiresAt: future })
    ).toBe("pending")
    expect(
      invitationStatus({ acceptedAt: null, revokedAt: null, expiresAt: past })
    ).toBe("expired")
    expect(
      invitationStatus({ acceptedAt: null, revokedAt: past, expiresAt: future })
    ).toBe("revoked")
    expect(
      invitationStatus({ acceptedAt: past, revokedAt: null, expiresAt: future })
    ).toBe("accepted")
  })

  test("masks the local part of invited emails", () => {
    expect(maskInvitationEmail("person@example.com")).toBe("p•••••@example.com")
  })
})
