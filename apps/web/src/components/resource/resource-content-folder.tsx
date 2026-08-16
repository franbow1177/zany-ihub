import type { Resource, WorkspaceMember } from "@/lib/api"
import { ResourcePageHeader } from "./resource-page-header"
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
  return (
    <div className="space-y-6">
      <ResourcePageHeader resource={resource} />

      <ResourcesView
        resources={resources}
        members={members}
        workspaceId={workspaceId}
        parentId={resource.id}
      />
    </div>
  )
}
