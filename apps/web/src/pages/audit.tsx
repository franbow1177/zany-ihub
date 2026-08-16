import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { PageHeader } from "@/components/page-header"
import { useWorkspaceShellData } from "@/hooks/use-workspace-shell-data"
import { apiFetch, type AuditEvent, type AuditEventPage } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { WORKSPACE_NAV_CONFIG } from "@/lib/resource-kind"

const ACTION_LABELS: Record<string, string> = {
  "workspace.created": "created the workspace",
  "invitation.created": "created an invitation for",
  "invitation.resent": "resent an invitation to",
  "invitation.revoked": "revoked an invitation for",
  "invitation.accepted": "accepted an invitation for",
  "member.role_changed": "changed the role of",
  "member.removed": "removed",
  "resource.created": "created",
  "resource.renamed": "renamed",
  "resource.moved": "moved",
  "resource.metadata_changed": "updated",
  "resource.deleted": "deleted",
  "file.uploaded": "uploaded a file to",
  "file.replaced": "replaced the file in",
  "project.status_changed": "changed project status for",
  "task.created": "created task",
  "task.status_changed": "changed task status for",
  "task.deleted": "deleted task",
  "bookmark.target_changed": "changed the bookmark target for",
  "agent.configuration_changed": "changed agent configuration for",
  "ai_chat.target_changed": "changed the AI target for",
  "channel.participants_changed": "changed channel participants for",
  "message.deleted": "deleted a message",
}

function actorLabel(event: AuditEvent) {
  return (
    event.actorName ||
    event.actorEmail ||
    (event.actorId ? "Former user" : "System")
  )
}

function changedSummary(event: AuditEvent) {
  const role = event.changes.role
  if (role && typeof role === "object" && "from" in role && "to" in role) {
    const value = role as { from: unknown; to: unknown }
    return `${String(value.from)} → ${String(value.to)}`
  }
  const status = event.changes.status
  if (
    status &&
    typeof status === "object" &&
    "from" in status &&
    "to" in status
  ) {
    const value = status as { from: unknown; to: unknown }
    return `${String(value.from)} → ${String(value.to)}`
  }
  return null
}

export function AuditPage() {
  const { workspaceId = "" } = useParams()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const shell = useWorkspaceShellData(workspaceId, Boolean(session))
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(
    null
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPending && !session) navigate("/", { replace: true })
  }, [isPending, session, navigate])

  useEffect(() => {
    if (!session || !workspaceId) return
    let active = true
    apiFetch<AuditEventPage>(`/workspaces/${workspaceId}/audit-events`)
      .then((page) => {
        if (!active) return
        setEvents(page.events)
        setNextCursor(page.nextCursor)
        setLoadedWorkspaceId(workspaceId)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setEvents([])
        setNextCursor(null)
        setLoadedWorkspaceId(workspaceId)
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load audit history"
        )
      })
    return () => {
      active = false
    }
  }, [session, workspaceId])

  const loading = loadedWorkspaceId !== workspaceId

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await apiFetch<AuditEventPage>(
        `/workspaces/${workspaceId}/audit-events?cursor=${encodeURIComponent(nextCursor)}`
      )
      setEvents((current) => [...current, ...page.events])
      setNextCursor(page.nextCursor)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load more audit history"
      )
    } finally {
      setLoadingMore(false)
    }
  }

  if (isPending || !session) {
    return (
      <main className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">
        Loading session…
      </main>
    )
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
              icon={WORKSPACE_NAV_CONFIG.audit.icon}
              strokeWidth={2}
            />
          }
          title={WORKSPACE_NAV_CONFIG.audit.label}
          actions={<Badge variant="secondary">Owners only</Badge>}
        />

        {(error || shell.error) && (
          <p
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error ?? shell.error}
          </p>
        )}

        <section className="space-y-3" aria-label="Audit events">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead className="w-20">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {error
                        ? "Audit history is unavailable."
                        : "No audit events yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => {
                    const summary = changedSummary(event)
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(event.occurredAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {actorLabel(event)}
                        </TableCell>
                        <TableCell>
                          <span title={event.action}>
                            {ACTION_LABELS[event.action] ?? event.action}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {event.targetType}
                            </Badge>
                            <span className="max-w-52 truncate">
                              {event.targetLabel || event.targetId || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {summary ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.source}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          {!loading && events.length > 0 && (
            <div className="flex justify-end">
              {nextCursor && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  )
}
