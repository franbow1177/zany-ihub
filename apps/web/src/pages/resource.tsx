import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@rocicorp/zero/react"
import { queries } from "@workspace/zero/queries"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ResourceContent } from "@/components/resource/resource-content"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { useWorkspaceShellData } from "@/hooks/use-workspace-shell-data"
import type { Resource } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

export function ResourcePage() {
  const { workspaceId = "", resourceId = "" } = useParams()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const shell = useWorkspaceShellData(workspaceId, Boolean(session))
  const [resource, resourceState] = useQuery(
    queries.resources.byID({ id: resourceId }),
    { enabled: Boolean(session && resourceId) }
  )
  const [file, fileState] = useQuery(queries.files.byID({ id: resourceId }), {
    enabled: Boolean(session && resource?.kind === "file"),
  })

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

  const resourceError =
    resourceState.type === "error"
      ? resourceState.error.message
      : fileState.type === "error"
        ? fileState.error.message
        : null
  const activeResource: Resource | null =
    resource?.id === resourceId && resource.workspaceId === workspaceId
      ? ({
          ...resource,
          ...(resource.kind === "file"
            ? {
                file: file
                  ? {
                      mimeType: file.mimeType ?? null,
                      sizeBytes: file.sizeBytes ?? null,
                      originalName: file.originalName ?? null,
                      uploaded: Boolean(
                        file.mimeType || file.sizeBytes || file.originalName
                      ),
                    }
                  : null,
              }
            : {}),
        } as Resource)
      : null

  return (
    <WorkspaceShell
      workspace={shell.workspace}
      workspaces={shell.workspaces}
      resources={shell.resources}
      members={shell.members}
      activeResourceId={resourceId}
      discussionResource={
        activeResource?.kind !== "chat" ? activeResource ?? undefined : undefined
      }
      isLoading={shell.isLoading}
      onResourceUpdated={() => shell.reload()}
      onResourceDeleted={() => {
        shell.reload()
        navigate(`/workspace/${workspaceId}`, { replace: true })
      }}
    >
      {(resourceError || shell.error) && (
        <p className="mb-6 text-sm text-destructive" role="alert">
          {resourceError ?? shell.error}
        </p>
      )}

      {!activeResource && !resourceError ? (
        <div className="space-y-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : activeResource ? (
        <div>
          <ResourceContent
            resource={activeResource}
            resources={shell.resources}
            workspaceId={workspaceId}
            members={shell.members}
          />
        </div>
      ) : null}
    </WorkspaceShell>
  )
}
