import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion"

import type { SlashCommandItem } from "./resource-doc-slash-command"

export type ResourceDocSlashCommandListProps = SuggestionProps<
  SlashCommandItem,
  SlashCommandItem
>

export type ResourceDocSlashCommandListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const ResourceDocSlashCommandList = forwardRef<
  ResourceDocSlashCommandListHandle,
  ResourceDocSlashCommandListProps
>(function ResourceDocSlashCommandList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const safeIndex = items.length ? Math.min(selectedIndex, items.length - 1) : 0

  useEffect(() => {
    itemRefs.current[safeIndex]?.scrollIntoView({ block: "nearest" })
  }, [safeIndex])

  function selectItem(index: number) {
    const item = items[index]
    if (item) command(item)
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
      <div className="border-b px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Add a block</p>
      </div>
      <div className="max-h-80 overflow-y-auto p-1">
        {items.length ? (
          items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element
              }}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent data-[selected]:bg-accent"
              data-selected={index === safeIndex || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => command(item)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-foreground">
                {item.icon ? (
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                ) : (
                  <span className="h-px w-4 bg-current" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </button>
          ))
        ) : (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No blocks found
          </p>
        )}
      </div>
    </div>
  )
})
