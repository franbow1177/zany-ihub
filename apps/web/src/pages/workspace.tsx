import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Skeleton } from "@workspace/ui/components/skeleton"

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
        {shell.error && (
          <p className="text-sm text-destructive" role="alert">
            {shell.error}
          </p>
        )}

        {shell.isLoading && shell.resources.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
