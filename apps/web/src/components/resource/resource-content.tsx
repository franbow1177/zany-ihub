import { lazy, Suspense } from "react"

import type { Resource, WorkspaceMember } from "@/lib/api"
import { ResourceContentAgent } from "./resource-content-agent"
import { ResourceContentAiChat } from "./resource-content-ai-chat"
import { ResourceContentBookmark } from "./resource-content-bookmark"
import { ResourceContentDoc } from "./resource-content-doc"
import { ResourceContentFile } from "./resource-content-file"
import { ResourceContentFolder } from "./resource-content-folder"
import { ResourceContentProject } from "./resource-content-project"
import { ResourceContentTable } from "./resource-content-table"
import { ResourceContentChat } from "./resource-content-chat"

const ResourceContentWhiteboard = lazy(() =>
  import("./resource-content-whiteboard").then((module) => ({
    default: module.ResourceContentWhiteboard,
  }))
)

export function ResourceContent({
  resource,
  resources,
  workspaceId,
  members,
}: {
  resource: Resource
  resources: Resource[]
  workspaceId: string
  members: WorkspaceMember[]
}) {
  switch (resource.kind) {
    case "folder":
      return (
        <ResourceContentFolder
          key={resource.id}
          resource={resource}
          resources={resources}
          members={members}
          workspaceId={workspaceId}
        />
      )
    case "file":
      return <ResourceContentFile key={resource.id} resource={resource} />
    case "doc":
      return (
        <ResourceContentDoc
          key={resource.id}
          resource={resource}
          resources={resources}
          members={members}
        />
      )
    case "table":
      return (
        <ResourceContentTable
          key={resource.id}
          resource={resource}
          resources={resources}
          members={members}
        />
      )
    case "whiteboard":
      return (
        <Suspense
          fallback={
            <div className="h-[calc(100svh-5.5rem)] min-h-[34rem] animate-pulse rounded-xl bg-muted sm:h-[calc(100svh-6.5rem)] lg:h-[calc(100svh-7.5rem)]" />
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
    case "agent":
      return <ResourceContentAgent key={resource.id} resource={resource} />
    case "ai-chat":
      return <ResourceContentAiChat key={resource.id} resource={resource} />
    case "chat":
      return <ResourceContentChat key={resource.id} resource={resource} />
  }
}
