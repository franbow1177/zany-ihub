import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Add01Icon,
  BubbleChatIcon,
  Delete02Icon,
  Link01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Skeleton } from "@workspace/ui/components/skeleton"

import {
  apiFetch,
  type WorkspaceInvitation,
  type WorkspaceMember,
} from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { WORKSPACE_NAV_CONFIG } from "@/lib/resource-kind"

function initials(name: string, email: string) {
  const value = name.trim() || email.trim()
  const parts = value.split(/[\s@]+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

function MemberAvatar({ member }: { member: WorkspaceMember }) {
  return (
    <Avatar title={member.name || member.email}>
      {member.image && <AvatarImage src={member.image} alt="" />}
      <AvatarFallback>{initials(member.name, member.email)}</AvatarFallback>
    </Avatar>
  )
}

export function InviteMemberDialog({
  workspaceId,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: {
  workspaceId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement | null
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = controlledOpen ?? internalOpen

  async function loadInvitations() {
    try {
      const result = await apiFetch<WorkspaceInvitation[]>(
        `/workspaces/${workspaceId}/invitations`
      )
      setInvitations(result)
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load invitations"
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
    if (nextOpen) {
      setIsLoading(true)
      void loadInvitations()
    }
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const invitedEmail = email.trim()
    if (!invitedEmail) return

    setIsSubmitting(true)
    setError(null)
    setCopied(false)
    try {
      const created = await apiFetch<WorkspaceInvitation>(
        `/workspaces/${workspaceId}/invitations`,
        {
          method: "POST",
          body: JSON.stringify({ email: invitedEmail }),
        }
      )
      setEmail("")
      setInviteUrl(created.inviteUrl ?? null)
      await loadInvitations()
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Could not create invitation"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resend(invitation: WorkspaceInvitation) {
    setError(null)
    setCopied(false)
    try {
      const updated = await apiFetch<WorkspaceInvitation>(
        `/workspaces/${workspaceId}/invitations/${invitation.id}/resend`,
        { method: "POST" }
      )
      setInviteUrl(updated.inviteUrl ?? null)
      await loadInvitations()
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Could not renew invitation"
      )
    }
  }

  async function revoke(invitation: WorkspaceInvitation) {
    setError(null)
    try {
      await apiFetch<void>(
        `/workspaces/${workspaceId}/invitations/${invitation.id}`,
        { method: "DELETE" }
      )
      await loadInvitations()
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Could not revoke invitation"
      )
    }
  }

  async function copyInviteUrl(url = inviteUrl) {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setError("Could not copy the link. Select and copy it manually.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null && (
        <DialogTrigger render={trigger ?? <Button />}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Invite
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a workspace member</DialogTitle>
          <DialogDescription>
            Create a seven-day link tied to their Google account email.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={invite}>
          <div className="space-y-2">
            <Label htmlFor="workspace-invite-email">Email address</Label>
            <div className="flex gap-2">
              <Input
                id="workspace-invite-email"
                type="email"
                autoComplete="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button disabled={isSubmitting || !email.trim()} type="submit">
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                {isSubmitting ? "Creating…" : "Invite"}
              </Button>
            </div>
          </div>
        </form>

        {inviteUrl && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm font-medium">Invitation link ready</p>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly aria-label="Invitation link" />
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyInviteUrl()}
              >
                <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with the invited person. It only works for the
              email above.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <section className="space-y-2" aria-labelledby="pending-invites-title">
          <div className="flex items-center justify-between">
            <h3 id="pending-invites-title" className="text-sm font-medium">
              Pending invitations
            </h3>
            {isLoading && (
              <span className="text-xs text-muted-foreground">Loading…</span>
            )}
          </div>
          {!isLoading && invitations.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              No pending invitations.
            </p>
          ) : (
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center gap-2 rounded-lg border p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invitation.status === "expired"
                        ? "Expired"
                        : `Expires ${new Intl.DateTimeFormat(undefined, {
                            month: "short",
                            day: "numeric",
                          }).format(new Date(invitation.expiresAt))}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void resend(invitation)}
                  >
                    {invitation.status === "expired" ? "Renew" : "New link"}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Revoke invitation for ${invitation.email}`}
                    title="Revoke invitation"
                    onClick={() => void revoke(invitation)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}

export function WorkspaceMembers({
  workspaceId,
  members,
  isLoading,
}: {
  workspaceId?: string
  members: WorkspaceMember[]
  isLoading: boolean
}) {
  const navigate = useNavigate()
  const zero = useZero()
  const { data: session } = authClient.useSession()
  const [chats = []] = useQuery(
    queries.humanChats.byWorkspace({
      workspaceId: workspaceId ?? "__none__",
    }),
    { enabled: Boolean(session && workspaceId) }
  )
  const [openingUserId, setOpeningUserId] = useState<string | null>(null)
  const [dmError, setDmError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const isOwner = members.some(
    (member) => member.userId === session?.user.id && member.role === "owner"
  )
  const dmByUserId = new Map<string, (typeof chats)[number]>()
  for (const chat of chats) {
    if (chat.type !== "dm") continue
    const other = chat.participants.find(
      (participant) => participant.userId !== session?.user.id
    )
    if (other) dmByUserId.set(other.userId, chat)
  }

  async function openDirectMessage(member: WorkspaceMember, now: number) {
    if (!workspaceId || openingUserId) return
    const existing = dmByUserId.get(member.userId)
    if (existing) {
      setOpen(false)
      navigate(`/workspace/${workspaceId}/resource/${existing.id}`)
      return
    }

    const id = crypto.randomUUID()
    setOpeningUserId(member.userId)
    setDmError(null)
    try {
      const result = zero.mutate(
        mutators.humanChats.createDM({
          id,
          selfParticipantId: crypto.randomUUID(),
          otherParticipantId: crypto.randomUUID(),
          workspaceId,
          otherUserId: member.userId,
          now,
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      setOpen(false)
      navigate(`/workspace/${workspaceId}/resource/${id}`)
    } catch (openError) {
      setDmError(
        openError instanceof Error
          ? openError.message
          : "Could not open direct message"
      )
    } finally {
      setOpeningUserId(null)
    }
  }

  if (isLoading && members.length === 0) {
    return <Skeleton className="h-7 w-20 rounded-full" />
  }

  const visibleMembers = members.slice(0, 4)
  const hiddenCount = Math.max(0, members.length - visibleMembers.length)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className="h-8 rounded-full px-1.5"
            aria-label="View workspace members"
          />
        }
      >
        {members.length > 0 ? (
          <AvatarGroup>
            {visibleMembers.map((member) => (
              <MemberAvatar member={member} key={member.id} />
            ))}
            {hiddenCount > 0 && (
              <AvatarGroupCount className="size-6 text-xs">
                +{hiddenCount}
              </AvatarGroupCount>
            )}
          </AvatarGroup>
        ) : (
          <HugeiconsIcon
            icon={WORKSPACE_NAV_CONFIG.members.icon}
            strokeWidth={2}
          />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto gap-3 p-3">
        <PopoverHeader>
          <div className="flex items-center justify-between gap-3">
            <PopoverTitle>Workspace members</PopoverTitle>
            {isOwner && workspaceId && (
              <InviteMemberDialog workspaceId={workspaceId} />
            )}
          </div>
        </PopoverHeader>
        <ScrollArea className="max-h-72">
          <div className="grid gap-1 pr-2">
            {members.map((member) => {
              const isSelf = member.userId === session?.user.id
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60"
                >
                  <Avatar>
                    {member.image && <AvatarImage src={member.image} alt="" />}
                    <AvatarFallback>
                      {initials(member.name, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.name || member.email}
                      {isSelf ? " (you)" : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  {!isSelf && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={openingUserId === member.userId}
                      aria-label={`Message ${member.name || member.email}`}
                      onClick={(event) =>
                        void openDirectMessage(
                          member,
                          Math.round(performance.timeOrigin + event.timeStamp)
                        )
                      }
                    >
                      <HugeiconsIcon icon={BubbleChatIcon} strokeWidth={2} />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
        {dmError && (
          <p className="text-xs text-destructive" role="alert">
            {dmError}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
