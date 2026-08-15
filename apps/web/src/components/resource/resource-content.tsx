import { lazy, Suspense } from "react"

import type { Resource } from "@/lib/api"
import { ResourceContentBookmark } from "./resource-content-bookmark"
import { ResourceContentDoc } from "./resource-content-doc"
import { ResourceContentFile } from "./resource-content-file"
import { ResourceContentFolder } from "./resource-content-folder"
import { ResourceContentProject } from "./resource-content-project"
import { ResourceContentTable } from "./resource-content-table"

const ResourceContentWhiteboard = lazy(() =>
  import("./resource-content-whiteboard").then((module) => ({
    default: module.ResourceContentWhiteboard,
  }))
)

export function ResourceContent({
  resource,
  resources,
  workspaceId,
}: {
  resource: Resource
  resources: Resource[]
  workspaceId: string
}) {
  switch (resource.kind) {
    case "folder":
      return (
        <ResourceContentFolder
          key={resource.id}
          resource={resource}
          children={resources.filter((item) => item.parentId === resource.id)}
          workspaceId={workspaceId}
        />
      )
    case "file":
      return <ResourceContentFile key={resource.id} resource={resource} />
    case "doc":
      return <ResourceContentDoc key={resource.id} resource={resource} />
    case "table":
      return <ResourceContentTable key={resource.id} resource={resource} />
    case "whiteboard":
      return (
        <Suspense
          fallback={
            <div className="h-[70vh] min-h-[34rem] animate-pulse rounded-xl bg-muted" />
          }
        >
          <ResourceContentWhiteboard key={resource.id} resource={resource} />
        </Suspense>
      )
    case "project":
      return <ResourceContentProject key={resource.id} resource={resource} />
    case "bookmark":
      return (
        <ResourceContentBookmark
          key={resource.id}
          resource={resource}
          resources={resources}
          workspaceId={workspaceId}
        />
      )
  }
}
