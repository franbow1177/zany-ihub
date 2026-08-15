import { useMemo, useState } from "react"
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

import type { ResourceKind } from "@/lib/api"
import {
  getResourceIconOption,
  RESOURCE_ICON_OPTIONS,
} from "@/lib/resource-icons"
import { ResourceKindIcon } from "./resource-kind-icon"

export function ResourceIconPicker({
  kind,
  value,
  onValueChange,
}: {
  kind: ResourceKind
  value: string
  onValueChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = getResourceIconOption(value)
  const filteredIcons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return RESOURCE_ICON_OPTIONS
    return RESOURCE_ICON_OPTIONS.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedQuery) ||
        option.name.toLowerCase().includes(normalizedQuery)
    )
  }, [query])

  function choose(nextValue: string) {
    onValueChange(nextValue)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-start px-3 font-normal"
            aria-label="Choose resource icon"
          />
        }
      >
        {selected ? (
          <HugeiconsIcon icon={selected.icon} strokeWidth={2} />
        ) : (
          <ResourceKindIcon kind={kind} />
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          {selected?.label ?? "Default type icon"}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-4 text-muted-foreground"
          strokeWidth={2}
        />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <div className="border-b p-2">
          <Input
            value={query}
            placeholder="Search Hugeicons…"
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
          onClick={() => choose("")}
        >
          <span className="flex size-8 items-center justify-center rounded-md border bg-background">
            <ResourceKindIcon kind={kind} />
          </span>
          <span className="flex-1">Default type icon</span>
          {!value && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />}
        </button>
        <ScrollArea className="h-64">
          {filteredIcons.length > 0 ? (
            <div className="grid grid-cols-6 gap-1 p-2">
              {filteredIcons.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={value === option.name}
                  className="relative flex aspect-square items-center justify-center rounded-md border border-transparent text-muted-foreground outline-none hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary/30 aria-pressed:bg-primary/10 aria-pressed:text-primary"
                  onClick={() => choose(option.name)}
                >
                  <HugeiconsIcon
                    icon={option.icon}
                    className="size-5"
                    strokeWidth={1.8}
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No Hugeicons found.
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
