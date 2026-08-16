import { forwardRef, useImperativeHandle, useState } from "react"
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion"

import { WorkspaceMentionMenu } from "@/components/workspace/workspace-mention-menu"
import type { WorkspaceMentionItem } from "@/lib/workspace-mentions"

export type ResourceDocMentionAttrs = {
  id: string
  label: string
}

export type ResourceDocMentionListProps = SuggestionProps<
  WorkspaceMentionItem,
  ResourceDocMentionAttrs
>

export type ResourceDocMentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const ResourceDocMentionList = forwardRef<
  ResourceDocMentionListHandle,
  ResourceDocMentionListProps
>(function ResourceDocMentionList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const safeIndex = items.length ? Math.min(selectedIndex, items.length - 1) : 0

  function selectItem(index: number) {
    const item = items[index]
    if (item) command({ id: item.key, label: item.label })
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((current) =>
          items.length ? (current + items.length - 1) % items.length : 0
        )
        return true
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((current) =>
          items.length ? (current + 1) % items.length : 0
        )
        return true
      }
      if (event.key === "Enter") {
        selectItem(safeIndex)
        return true
      }
      return event.key === "Escape"
    },
  }))

  return (
    <div
      data-suggestion-list
      className="w-80 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
    >
      <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        Mention a resource or member
      </div>
      <WorkspaceMentionMenu
        items={items}
        selectedIndex={safeIndex}
        onSelect={(item) => command({ id: item.key, label: item.label })}
      />
    </div>
  )
})
