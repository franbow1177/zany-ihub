import type { ReactNode } from "react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card"

import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import { RESOURCE_KIND_CONFIG } from "@/lib/resource-kind"
import type { WorkspaceMentionItem } from "@/lib/workspace-mentions"

function initials(label: string) {
  return label
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

function updatedLabel(value?: number) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date)}`
}

export function EntityHoverCard({
  entity,
  children,
}: {
  entity: WorkspaceMentionItem
  children: ReactNode
}) {
  const isResource = entity.type === "resource" && entity.resourceKind
  const resourceKind = isResource ? entity.resourceKind : null
  const footer = resourceKind
    ? [RESOURCE_KIND_CONFIG[resourceKind].label, updatedLabel(entity.updatedAt)]
        .filter(Boolean)
        .join(" · ")
    : `Workspace ${entity.memberRole ?? "member"}`

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={350}
        closeDelay={150}
        render={<span className="workspace-mention" />}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-80 overflow-hidden p-0"
      >
        <div className="flex items-start gap-3 p-4">
          {resourceKind ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-5">
              <ResourceKindIcon
                kind={resourceKind}
                icon={entity.resourceIcon}
              />
            </span>
          ) : (
            <Avatar className="size-10 shrink-0">
              {entity.image && <AvatarImage src={entity.image} alt="" />}
              <AvatarFallback className="text-xs">
                {initials(entity.label)}
              </AvatarFallback>
            </Avatar>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate font-semibold">{entity.label}</p>
              <Badge variant="secondary" className="shrink-0 capitalize">
                {resourceKind ?? entity.memberRole ?? entity.type}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-3 text-sm leading-5 text-muted-foreground">
              {resourceKind
                ? entity.resourceDescription || "No description provided."
                : entity.description}
            </p>
          </div>
        </div>
        <div className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          {footer}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
