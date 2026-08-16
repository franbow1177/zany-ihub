import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ResourceContent } from "@/components/resource/resource-content"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { useWorkspaceShellData } from "@/hooks/use-workspace-shell-data"
import { apiFetch, type Resource } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

export function ResourcePage() {
  const { workspaceId = "", resourceId = "" } = useParams()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const shell = useWorkspaceShellData(workspaceId, Boolean(session))
  const [resource, setResource] = useState<Resource | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !workspaceId || !resourceId) return

    const controller = new AbortController()

    async function load() {
      try {
        const item = await apiFetch<Resource>(`/resources/${resourceId}`, {
          signal: controller.signal,
        })

        if (item.workspaceId !== workspaceId) {
          throw new Error("Resource does not belong to this workspace")
        }

        setResource(item)
        setError(null)
      } catch (requestError) {
        if (
          requestError instanceof Error &&
          requestError.name === "AbortError"
        ) {
          return
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load resource"
        )
      }
    }

    void load()
    return () => controller.abort()
  }, [session, workspaceId, resourceId])

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

  const activeResource = resource?.id === resourceId ? resource : null

  return (
    <WorkspaceShell
      workspace={shell.workspace}
      workspaces={shell.workspaces}
      resources={shell.resources}
      members={shell.members}
      activeResourceId={resourceId}
      isLoading={shell.isLoading}
      onResourceUpdated={(updated) => {
        setResource(updated)
        shell.reload()
      }}
      onResourceDeleted={() => {
        shell.reload()
        navigate(`/workspace/${workspaceId}`, { replace: true })
      }}
    >
      {(error || shell.error) && (
        <p className="mb-6 text-sm text-destructive" role="alert">
          {error ?? shell.error}
        </p>
      )}

      {!activeResource && !error ? (
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
