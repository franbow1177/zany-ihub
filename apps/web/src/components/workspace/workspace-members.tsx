import { useState } from "react"
import {
  Add01Icon,
  Delete02Icon,
  Link01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
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
  PopoverDescription,
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

function InviteMemberDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setOpen(nextOpen)
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
      <DialogTrigger render={<Button size="sm" />}>
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
        Invite
      </DialogTrigger>
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
                    size="icon-sm"
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
  const { data: session } = authClient.useSession()
  const isOwner = members.some(
    (member) => member.userId === session?.user.id && member.role === "owner"
  )

  if (isLoading && members.length === 0) {
    return <Skeleton className="h-7 w-20 rounded-full" />
  }

  const visibleMembers = members.slice(0, 4)
  const hiddenCount = Math.max(0, members.length - visibleMembers.length)

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className="h-8 gap-2 rounded-full px-1.5"
              aria-label={`View ${members.length} workspace members`}
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
            <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
          )}
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {members.length}
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 gap-3 p-3">
          <PopoverHeader>
            <div className="flex items-center justify-between gap-3">
              <PopoverTitle>Workspace members</PopoverTitle>
              {isOwner && workspaceId && (
                <InviteMemberDialog workspaceId={workspaceId} />
              )}
            </div>
            <PopoverDescription>
              {members.length} {members.length === 1 ? "person" : "people"} in
              this workspace
            </PopoverDescription>
          </PopoverHeader>
          <ScrollArea className="max-h-72">
            <div className="grid gap-1 pr-2">
              {members.map((member) => (
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
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  )
}
