import { Link } from "react-router-dom"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ResourceDropdown } from "@/components/resource/resource-dropdown"
import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import type { Resource, Workspace } from "@/lib/api"

function buildResourcePath(resources: Resource[], activeResourceId?: string) {
  if (!activeResourceId) return []

  const byId = new Map(resources.map((resource) => [resource.id, resource]))
  const path: Resource[] = []
  const visited = new Set<string>()
  let current = byId.get(activeResourceId)

  while (current && !visited.has(current.id)) {
    path.unshift(current)
    visited.add(current.id)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  return path
}

export function WorkspaceBreadcrumb({
  workspace,
  resources,
  activeResourceId,
  isLoading,
  onResourceUpdated,
  onResourceDeleted,
}: {
  workspace: Workspace | null
  resources: Resource[]
  activeResourceId?: string
  isLoading: boolean
  onResourceUpdated?: (resource: Resource) => void
  onResourceDeleted?: (resource: Resource) => void
}) {
  if (isLoading && !workspace) {
    return <Skeleton className="h-4 w-36" />
  }

  const resourcePath = buildResourcePath(resources, activeResourceId)

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="min-w-0">
          {resourcePath.length > 0 && workspace ? (
            <BreadcrumbLink
              className="max-w-40 truncate font-medium"
              render={<Link to={`/workspace/${workspace.id}`} />}
            >
              {workspace.name}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="max-w-56 truncate font-medium">
              {workspace?.name ?? "Workspace"}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {resourcePath.map((resource, index) => {
          const isCurrent = index === resourcePath.length - 1
          return (
            <span className="contents" key={resource.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {isCurrent ? (
                  workspace ? (
                    <ResourceDropdown
                      resource={resource}
                      resources={resources}
                      workspaceId={workspace.id}
                      onUpdated={onResourceUpdated}
                      onDeleted={onResourceDeleted}
                    />
                  ) : (
                    <BreadcrumbPage className="flex max-w-48 items-center gap-1.5">
                      <ResourceKindIcon
                        kind={resource.kind}
                        icon={resource.icon}
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">{resource.name}</span>
                    </BreadcrumbPage>
                  )
                ) : (
                  <BreadcrumbLink
                    className="flex max-w-36 items-center gap-1.5"
                    render={
                      <Link
                        to={`/workspace/${workspace?.id}/resource/${resource.id}`}
                      />
                    }
                  >
                    <ResourceKindIcon
                      kind={resource.kind}
                      icon={resource.icon}
                      className="size-3.5 shrink-0"
                    />
                    <span className="truncate">{resource.name}</span>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
