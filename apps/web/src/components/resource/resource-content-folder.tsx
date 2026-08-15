import { Link } from "react-router-dom"
import { FolderOpenIcon } from "@hugeicons/core-free-icons"
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

import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import type { Resource } from "@/lib/api"

export function ResourceContentFolder({
  resource,
  children,
  workspaceId,
}: {
  resource: Resource
  children: Resource[]
  workspaceId: string
}) {
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

      {children.length === 0 ? (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>This folder is empty</EmptyTitle>
            <EmptyDescription>
              Move or create resources here to organize this folder.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="space-y-3" aria-labelledby="folder-contents">
          <h2 id="folder-contents" className="text-sm font-medium">
            Contents
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {children.map((child) => (
              <Link
                key={child.id}
                to={`/workspace/${workspaceId}/resource/${child.id}`}
                className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors group-hover:bg-muted/40">
                  <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
                    <span className="row-span-2 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground">
                      <ResourceKindIcon
                        kind={child.kind}
                        icon={child.icon}
                      />
                    </span>
                    <CardTitle className="truncate">{child.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {child.kind}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
