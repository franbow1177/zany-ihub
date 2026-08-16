import { Badge } from "@workspace/ui/components/badge"

import type { Resource, WorkspaceMember } from "@/lib/api"
import { ResourcesView } from "./resources-view"

export function ResourceContentFolder({
  resource,
  resources,
  members,
  workspaceId,
}: {
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
  workspaceId: string
}) {
  const children = resources.filter((item) => item.parentId === resource.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Folder</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {resource.name}
          </h1>
        </div>
        <Badge variant="secondary">
          {children.length} {children.length === 1 ? "item" : "items"}
        </Badge>
      </div>

      <ResourcesView
        resources={resources}
        members={members}
        workspaceId={workspaceId}
        parentId={resource.id}
      />
    </div>
  )
}
