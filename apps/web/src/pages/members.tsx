import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { InviteMemberDialog } from "@/components/workspace/workspace-members"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { PageHeader } from "@/components/page-header"
import { useWorkspaceShellData } from "@/hooks/use-workspace-shell-data"
import { apiFetch, type WorkspaceMember } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { WORKSPACE_NAV_CONFIG } from "@/lib/resource-kind"

function initials(name: string, email: string) {
  return (name.trim() || email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

export function MembersPage() {
  const { workspaceId = "" } = useParams()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const shell = useWorkspaceShellData(workspaceId, Boolean(session))
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [removeMember, setRemoveMember] = useState<WorkspaceMember | null>(null)
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())
  const [roles, setRoles] = useState<Record<string, "owner" | "member">>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPending && !session) navigate("/", { replace: true })
  }, [isPending, session, navigate])

  if (isPending || !session) {
    return (
      <main className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">
        Loading session…
      </main>
    )
  }

  const members = shell.members.filter((member) => !removedIds.has(member.id))
  const currentMember = members.find(
    (member) => member.userId === session.user.id
  )
  const canManage =
    (roles[currentMember?.id ?? ""] ?? currentMember?.role) === "owner"

  async function changeRole(member: WorkspaceMember, role: "owner" | "member") {
    const previousRole = roles[member.id] ?? member.role
    if (previousRole === role) return
    setBusyMemberId(member.id)
    setRoles((current) => ({ ...current, [member.id]: role }))
    setError(null)
    try {
      await apiFetch(`/workspaces/${workspaceId}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      })
    } catch (roleError) {
      setRoles((current) => ({ ...current, [member.id]: previousRole }))
      setError(
        roleError instanceof Error
          ? roleError.message
          : "Could not update member role"
      )
    } finally {
      setBusyMemberId(null)
    }
  }

  async function remove() {
    if (!removeMember) return
    setBusyMemberId(removeMember.id)
    setError(null)
    try {
      await apiFetch<void>(
        `/workspaces/${workspaceId}/members/${removeMember.id}`,
        { method: "DELETE" }
      )
      setRemovedIds((current) => new Set(current).add(removeMember.id))
      setRemoveMember(null)
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove member"
      )
    } finally {
      setBusyMemberId(null)
    }
  }

  return (
    <WorkspaceShell
      workspace={shell.workspace}
      workspaces={shell.workspaces}
      resources={shell.resources}
      members={shell.members}
      isLoading={shell.isLoading}
    >
      <div className="space-y-6">
        <PageHeader
          icon={
            <HugeiconsIcon
              icon={WORKSPACE_NAV_CONFIG.members.icon}
              strokeWidth={2}
            />
          }
          title={WORKSPACE_NAV_CONFIG.members.label}
          actions={
            canManage && (
              <>
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to={`/workspace/${workspaceId}/audit`}
                >
                  Audit log
                </Link>
                <InviteMemberDialog workspaceId={workspaceId} />
              </>
            )
          }
        />

        {(error || shell.error) && (
          <p
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error ?? shell.error}
          </p>
        )}

        {shell.isLoading && members.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <section className="space-y-2" aria-labelledby="member-list-title">
            <div className="flex items-center gap-2">
              <h2 id="member-list-title" className="text-lg font-semibold">
                People
              </h2>
              <Badge variant="secondary">{members.length}</Badge>
            </div>
            <div className="space-y-2">
              {members.map((member) => {
                const isSelf = member.userId === session.user.id
                const role = roles[member.id] ?? member.role
                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 rounded-lg bg-secondary px-3 py-3 sm:flex-row sm:items-center"
                  >
                    <Avatar className="size-9">
                      {member.image && (
                        <AvatarImage src={member.image} alt="" />
                      )}
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
                    {canManage && !isSelf ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={role}
                          disabled={busyMemberId === member.id}
                          onValueChange={(value) =>
                            void changeRole(member, value as "owner" | "member")
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-28 border-0 bg-background"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={busyMemberId === member.id}
                          aria-label={`Remove ${member.name || member.email}`}
                          onClick={() => setRemoveMember(member)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="capitalize">
                        {role}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      <AlertDialog
        open={Boolean(removeMember)}
        onOpenChange={(open) => !open && setRemoveMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon
                icon={WORKSPACE_NAV_CONFIG.members.icon}
                strokeWidth={2}
              />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Remove {removeMember?.name || removeMember?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this workspace and its resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={busyMemberId === removeMember?.id}
              onClick={() => void remove()}
            >
              {busyMemberId === removeMember?.id
                ? "Removing…"
                : "Remove member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  )
}
