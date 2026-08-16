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
  return (
    <ResourcesView
      resources={resources}
      members={members}
      workspaceId={workspaceId}
      parentId={resource.id}
      headerResource={resource}
    />
  )
}
