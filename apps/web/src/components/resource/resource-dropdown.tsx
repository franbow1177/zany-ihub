import { useState } from "react"
import { ArrowDown01Icon, Edit02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import type { Resource } from "@/lib/api"
import { ResourceKindIcon } from "./resource-kind-icon"
import { ResourceFormSheet } from "./resource-form-sheet"

export function ResourceDropdown({
  resource,
  resources,
  workspaceId,
  onUpdated,
  onDeleted,
}: {
  resource: Resource
  resources: Resource[]
  workspaceId: string
  onUpdated?: (resource: Resource) => void
  onDeleted?: (resource: Resource) => void
}) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex max-w-52 min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
              aria-current="page"
            />
          }
        >
          <ResourceKindIcon
            kind={resource.kind}
            icon={resource.icon}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="truncate">{resource.name}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className="size-3.5 shrink-0 text-muted-foreground"
            strokeWidth={2}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
              Edit resource
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResourceFormSheet
        workspaceId={workspaceId}
        resources={resources}
        resource={resource}
        trigger={null}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
    </>
  )
}
