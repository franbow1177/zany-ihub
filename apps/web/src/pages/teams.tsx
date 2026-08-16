import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
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
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"

import { PageHeader } from "@/components/page-header"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { useWorkspaceShellData } from "@/hooks/use-workspace-shell-data"
import type { WorkspaceMember } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { WORKSPACE_NAV_CONFIG } from "@/lib/resource-kind"

type TeamListItem = {
  id: string
  name: string
  description?: string | null
  updatedAt?: number | null
  members: ReadonlyArray<{ id: string; userId: string }>
}

function initials(name: string, email: string) {
  return (name.trim() || email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

function TeamFormDialog({
  workspaceId,
  members,
  team,
  open,
  onOpenChange,
}: {
  workspaceId: string
  members: WorkspaceMember[]
  team: TeamListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const zero = useZero()
  const [name, setName] = useState(team?.name ?? "")
  const [description, setDescription] = useState(team?.description ?? "")
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(team?.members.map((member) => member.userId) ?? [])
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleMember(userId: string, checked: boolean) {
    setSelectedUserIds((current) => {
      const next = new Set(current)
      if (checked) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || isSaving) return
    setIsSaving(true)
    setError(null)

    const existingMemberIds = new Map(
      team?.members.map((member) => [member.userId, member.id]) ?? []
    )
    const selectedMembers = members
      .filter((member) => selectedUserIds.has(member.userId))
      .map((member) => ({
        id: existingMemberIds.get(member.userId) ?? crypto.randomUUID(),
        userId: member.userId,
      }))
    const now = Date.now()

    try {
      const mutation = team
        ? zero.mutate(
            mutators.teams.update({
              id: team.id,
              name,
              description: description || null,
              members: selectedMembers,
              now,
            })
          )
        : zero.mutate(
            mutators.teams.create({
              id: crypto.randomUUID(),
              workspaceId,
              name,
              description: description || null,
              members: selectedMembers,
              now,
            })
          )
      const result = await mutation.server
      if (result.type === "error") throw new Error(result.error.message)
      onOpenChange(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save team"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const sortedMembers = [...members].sort((a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void save(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{team ? "Edit team" : "Create team"}</DialogTitle>
            <DialogDescription>
              Group workspace members without changing what they can access.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={name}
              maxLength={160}
              autoFocus
              placeholder="Design"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team-description">Description</Label>
            <Textarea
              id="team-description"
              value={description}
              placeholder="What this team works on"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Members</Label>
              <span className="text-xs text-muted-foreground">
                {selectedUserIds.size} selected
              </span>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
              {sortedMembers.map((member) => (
                <label
                  key={member.userId}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={selectedUserIds.has(member.userId)}
                    onCheckedChange={(checked) =>
                      toggleMember(member.userId, checked)
                    }
                  />
                  <Avatar className="size-8">
                    {member.image && <AvatarImage src={member.image} alt="" />}
                    <AvatarFallback className="text-xs">
                      {initials(member.name, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {member.name || member.email}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving}>
              {isSaving ? "Saving…" : team ? "Save changes" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsPage() {
  const { workspaceId = "" } = useParams()
  const navigate = useNavigate()
  const zero = useZero()
  const { data: session, isPending } = authClient.useSession()
  const shell = useWorkspaceShellData(workspaceId, Boolean(session))
  const [teams = [], teamsResult] = useQuery(
    queries.teams.byWorkspace({ workspaceId: workspaceId || "__none__" }),
    { enabled: Boolean(session && workspaceId) }
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamListItem | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<TeamListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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

  function openCreate() {
    setEditingTeam(null)
    setFormOpen(true)
  }

  function openEdit(team: TeamListItem) {
    setEditingTeam(team)
    setFormOpen(true)
  }

  async function removeTeam() {
    if (!deletingTeam || isDeleting) return
    setIsDeleting(true)
    setError(null)
    try {
      const result = await zero.mutate(
        mutators.teams.delete({ id: deletingTeam.id })
      ).server
      if (result.type === "error") throw new Error(result.error.message)
      setDeletingTeam(null)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete team"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const membersByUserId = new Map(
    shell.members.map((member) => [member.userId, member])
  )
  const isLoading = shell.isLoading || teamsResult.type === "unknown"

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
              icon={WORKSPACE_NAV_CONFIG.teams.icon}
              strokeWidth={2}
            />
          }
          title={WORKSPACE_NAV_CONFIG.teams.label}
          actions={
            <Button type="button" onClick={openCreate}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Create team
            </Button>
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

        {isLoading && teams.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Updated
                  </TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-28 text-center">
                      <p className="font-medium">No teams yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Create a team to group workspace members.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  teams.map((team) => {
                    const teamMembers = team.members
                      .map((member) => membersByUserId.get(member.userId))
                      .filter((member): member is WorkspaceMember =>
                        Boolean(member)
                      )
                    return (
                      <TableRow key={team.id}>
                        <TableCell className="min-w-56 py-3 whitespace-normal">
                          <p className="font-medium">{team.name}</p>
                          {team.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {team.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                              {teamMembers.slice(0, 4).map((member) => (
                                <Avatar
                                  key={member.userId}
                                  className="size-7 border-2 border-background"
                                  title={member.name || member.email}
                                >
                                  {member.image && (
                                    <AvatarImage src={member.image} alt="" />
                                  )}
                                  <AvatarFallback className="text-[10px]">
                                    {initials(member.name, member.email)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                            <Badge variant="secondary">
                              {team.members.length}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {team.updatedAt
                            ? new Intl.DateTimeFormat(undefined, {
                                dateStyle: "medium",
                              }).format(new Date(team.updatedAt))
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${team.name}`}
                              onClick={() => openEdit(team)}
                            >
                              <HugeiconsIcon
                                icon={Edit02Icon}
                                strokeWidth={2}
                              />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${team.name}`}
                              onClick={() => setDeletingTeam(team)}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                strokeWidth={2}
                              />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) 
                  })
                )}
              </TableBody>
            </Table>
        )}
      </div>

      {formOpen && (
        <TeamFormDialog
          workspaceId={workspaceId}
          members={shell.members}
          team={editingTeam}
          open
          onOpenChange={setFormOpen}
        />
      )}

      <AlertDialog
        open={Boolean(deletingTeam)}
        onOpenChange={(open) => !open && setDeletingTeam(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon
                icon={WORKSPACE_NAV_CONFIG.teams.icon}
                strokeWidth={2}
              />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete {deletingTeam?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the team and its member list. Workspace members and
              their access will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void removeTeam()}
            >
              {isDeleting ? "Deleting…" : "Delete team"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  )
}
