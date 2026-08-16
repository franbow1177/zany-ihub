import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import type { WorkspaceMentionItem } from "@/lib/workspace-mentions"

function initials(label: string) {
  return label
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

export function WorkspaceMentionMenu({
  items,
  selectedIndex,
  onSelect,
}: {
  items: WorkspaceMentionItem[]
  selectedIndex: number
  onSelect: (item: WorkspaceMentionItem) => void
}) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        No workspace results found.
      </p>
    )
  }

  return (
    <div className="max-h-72 overflow-y-auto p-1">
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted data-[selected=true]:bg-muted"
          data-selected={index === selectedIndex}
          onMouseDown={(event) => {
            event.preventDefault()
            onSelect(item)
          }}
        >
          {item.type === "resource" && item.resourceKind ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ResourceKindIcon
                kind={item.resourceKind}
                icon={item.resourceIcon}
              />
            </span>
          ) : (
            <Avatar className="size-7">
              {item.image && <AvatarImage src={item.image} alt="" />}
              <AvatarFallback className="text-[10px]">
                {initials(item.label)}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{item.label}</span>
            <span className="block truncate text-xs text-muted-foreground capitalize">
              {item.description}
            </span>
          </span>
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {item.type}
          </span>
        </button>
      ))}
    </div>
  )
}
