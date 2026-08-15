import { useEffect, useMemo } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  Bookmark01Icon,
  File01Icon,
  Folder01Icon,
  Note01Icon,
  Table01Icon,
  Task01Icon,
  WhiteboardIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ResourceFormSheet } from "@/components/resource/resource-form-sheet"
import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { useWorkspaceShellData } from "@/hooks/use-workspace-shell-data"
import type { Resource, ResourceKind } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

const KIND_CONFIG: Record<
  ResourceKind,
  { label: string; singular: string; icon: IconSvgElement }
> = {
  folder: { label: "Folders", singular: "Folder", icon: Folder01Icon },
  file: { label: "Files", singular: "File", icon: File01Icon },
  doc: { label: "Docs", singular: "Doc", icon: Note01Icon },
  table: { label: "Tables", singular: "Table", icon: Table01Icon },
  whiteboard: {
    label: "Whiteboards",
    singular: "Whiteboard",
    icon: WhiteboardIcon,
  },
  project: { label: "Projects", singular: "Project", icon: Task01Icon },
  bookmark: {
    label: "Bookmarks",
    singular: "Bookmark",
    icon: Bookmark01Icon,
  },
}

const KINDS = Object.keys(KIND_CONFIG) as ResourceKind[]

function ResourceCard({
  resource,
  workspaceId,
}: {
  resource: Resource
  workspaceId: string
}) {
  const config = KIND_CONFIG[resource.kind]

  return (
    <Link
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      to={`/workspace/${workspaceId}/resource/${resource.id}`}
    >
      <Card className="h-full transition-colors group-hover:bg-muted/40">
        <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
          <span className="row-span-2 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground">
            <ResourceKindIcon kind={resource.kind} icon={resource.icon} />
          </span>
          <CardTitle className="truncate">{resource.name}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <span>{config.singular}</span>
            <span aria-hidden="true">·</span>
            <span>
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
              }).format(new Date(resource.updatedAt))}
            </span>
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

function ResourceGrid({
  resources,
  workspaceId,
}: {
  resources: Resource[]
  workspaceId: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {resources.map((resource) => (
        <ResourceCard
          key={resource.id}
          resource={resource}
          workspaceId={workspaceId}
        />
      ))}
    </div>
  )
}

export function WorkspacePage() {
  const { workspaceId = "" } = useParams()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const shell = useWorkspaceShellData(workspaceId, Boolean(session))

  const recentResources = useMemo(
    () =>
      [...shell.resources]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .slice(0, 6),
    [shell.resources]
  )

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {shell.workspace?.name ?? "Overview"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {shell.workspace && (
              <Badge variant="secondary">
                {shell.resources.length} resources
              </Badge>
            )}
            <ResourceFormSheet
              workspaceId={workspaceId}
              resources={shell.resources}
              onCreated={(resource) =>
                navigate(`/workspace/${workspaceId}/resource/${resource.id}`)
              }
            />
          </div>
        </div>

        {shell.error && (
          <p className="text-sm text-destructive" role="alert">
            {shell.error}
          </p>
        )}

        {shell.isLoading && shell.resources.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton className="h-20 rounded-xl" key={index} />
              ))}
            </div>
          </div>
        ) : shell.resources.length === 0 ? (
          <Empty className="min-h-64 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>This workspace is ready</EmptyTitle>
              <EmptyDescription>
                Create the first resource to start organizing your work.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <section className="space-y-3" aria-labelledby="recent-heading">
              <div className="flex items-center justify-between">
                <h2 id="recent-heading" className="text-lg font-semibold">
                  Recent
                </h2>
                <span className="text-xs text-muted-foreground">
                  Latest updates
                </span>
              </div>
              <ResourceGrid
                resources={recentResources}
                workspaceId={workspaceId}
              />
            </section>

            <section className="space-y-5" aria-labelledby="kinds-heading">
              <h2 id="kinds-heading" className="text-lg font-semibold">
                Resources by kind
              </h2>
              {KINDS.map((resourceKind) => {
                const items = shell.resources
                  .filter((resource) => resource.kind === resourceKind)
                  .sort((a, b) => a.name.localeCompare(b.name))
                if (items.length === 0) return null

                return (
                  <div className="space-y-3" key={resourceKind}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HugeiconsIcon
                        icon={KIND_CONFIG[resourceKind].icon}
                        strokeWidth={2}
                        className="text-muted-foreground"
                      />
                      <h3>{KIND_CONFIG[resourceKind].label}</h3>
                      <Badge variant="outline" className="ml-1">
                        {items.length}
                      </Badge>
                    </div>
                    <ResourceGrid resources={items} workspaceId={workspaceId} />
                  </div>
                )
              })}
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
  )
}
