import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { WorkspaceDirectMessages } from "@/components/chat/workspace-direct-messages"
import { ResourcesView } from "@/components/resource/resources-view"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { useWorkspaceShellData } from "@/hooks/use-workspace-shell-data"
import { authClient } from "@/lib/auth-client"

export function WorkspacePage() {
  const { workspaceId = "" } = useParams()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const shell = useWorkspaceShellData(workspaceId, Boolean(session))

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

  return (
    <WorkspaceShell
      workspace={shell.workspace}
      workspaces={shell.workspaces}
      resources={shell.resources}
      members={shell.members}
      isLoading={shell.isLoading}
    >
      <div className="space-y-8">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {shell.workspace?.name ?? "Overview"}
          </h1>
        </div>

        {shell.error && (
          <p className="text-sm text-destructive" role="alert">
            {shell.error}
          </p>
        )}

        <WorkspaceDirectMessages
          workspaceId={workspaceId}
          members={shell.members}
        />

        {shell.isLoading && shell.resources.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton className="h-24 rounded-xl" key={index} />
              ))}
            </div>
          </div>
        ) : (
          <ResourcesView
            resources={shell.resources}
            members={shell.members}
            workspaceId={workspaceId}
          />
        )}
      </div>
    </WorkspaceShell>
  )
}
