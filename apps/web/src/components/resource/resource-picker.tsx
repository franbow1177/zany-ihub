import { useMemo, useState } from "react"
import {
  ArrowDown01Icon,
  FolderRootIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

import type { Resource, ResourceKind } from "@/lib/api"
import { RESOURCE_KIND_CONFIG, RESOURCE_KINDS } from "@/lib/resource-kind"
import { ResourceKindIcon } from "./resource-kind-icon"

type ResourceOption = {
  resource: Resource
  path: string
  parentPath: string
}

type KindFilter = ResourceKind | "all"

function buildResourcePath(
  resource: Resource,
  resourcesById: Map<string, Resource>
) {
  const path = [resource]
  const visited = new Set([resource.id])
  let parentId = resource.parentId

  while (parentId) {
    const parent = resourcesById.get(parentId)
    if (!parent || visited.has(parent.id)) break
    path.unshift(parent)
    visited.add(parent.id)
    parentId = parent.parentId
  }

  return path
}

export function ResourcePicker({
  resources,
  value,
  onValueChange,
  allowedKinds,
  showKindFilter,
  includeWorkspaceRoot = false,
  excludeIds,
  placeholder = "Choose a resource",
  searchPlaceholder = "Search resources…",
  groupHeading = "Resources",
  disabled = false,
  id,
  size = "default",
  className,
}: {
  resources: Resource[]
  value: string | null
  onValueChange: (value: string | null) => void
  allowedKinds?: ResourceKind[]
  showKindFilter?: boolean
  includeWorkspaceRoot?: boolean
  excludeIds?: ReadonlySet<string>
  placeholder?: string
  searchPlaceholder?: string
  groupHeading?: string
  disabled?: boolean
  id?: string
  size?: "default" | "sm"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const kindChoices = allowedKinds?.length ? allowedKinds : RESOURCE_KINDS
  const canFilterKinds = kindChoices.length > 1
  const kindFilterEnabled = showKindFilter ?? canFilterKinds
  const [kindFilter, setKindFilter] = useState<KindFilter>(
    canFilterKinds ? "all" : kindChoices[0]!
  )

  const resourcesById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources]
  )
  const allowedKindSet = useMemo(
    () => new Set<ResourceKind>(kindChoices),
    [kindChoices]
  )
  const activeKind =
    kindFilterEnabled && kindFilter !== "all" ? kindFilter : null

  const options = useMemo<ResourceOption[]>(
    () =>
      resources
        .filter(
          (resource) =>
            allowedKindSet.has(resource.kind) &&
            (!activeKind || resource.kind === activeKind) &&
            !excludeIds?.has(resource.id)
        )
        .map((resource) => {
          const path = buildResourcePath(resource, resourcesById)
          return {
            resource,
            path: path.map((item) => item.name).join(" / "),
            parentPath: path
              .slice(0, -1)
              .map((item) => item.name)
              .join(" / "),
          }
        })
        .sort((a, b) => a.path.localeCompare(b.path)),
    [activeKind, allowedKindSet, excludeIds, resources, resourcesById]
  )
  const selected = value ? resourcesById.get(value) : null
  const selectedPath = selected
    ? buildResourcePath(selected, resourcesById)
        .slice(0, -1)
        .map((resource) => resource.name)
        .join(" / ")
    : ""

  function choose(nextValue: string | null) {
    onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            size={size === "sm" ? "sm" : "default"}
            className={cn(
              "w-full justify-start font-normal",
              size === "default" && "h-10 px-3",
              className
            )}
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            aria-label="Choose resource"
          />
        }
      >
        {selected ? (
          <ResourceKindIcon
            kind={selected.kind}
            icon={selected.icon}
            className="size-4 shrink-0"
          />
        ) : (
          <HugeiconsIcon
            icon={FolderRootIcon}
            className="size-4 shrink-0"
            strokeWidth={2}
          />
        )}
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">
            {selected
              ? selected.name
              : includeWorkspaceRoot && value === null
                ? "Workspace root"
                : placeholder}
          </span>
          {selectedPath && size !== "sm" && (
            <span className="block truncate text-xs text-muted-foreground">
              {selectedPath}
            </span>
          )}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-4 shrink-0 text-muted-foreground"
          strokeWidth={2}
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-96 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        {kindFilterEnabled && canFilterKinds && (
          <div className="border-b p-2">
            <Select
              value={kindFilter}
              onValueChange={(next) => {
                if (next == null) return
                setKindFilter(next as KindFilter)
              }}
            >
              <SelectTrigger size="sm" className="w-full" aria-label="Filter by kind">
                <SelectValue placeholder="All kinds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                {kindChoices.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {RESOURCE_KIND_CONFIG[kind].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Command>
          <CommandInput autoFocus placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No matching resources.</CommandEmpty>
            <CommandGroup heading={groupHeading}>
              {includeWorkspaceRoot && (
                <CommandItem
                  value="workspace-root"
                  keywords={["workspace", "root"]}
                  data-checked={value === null}
                  onSelect={() => choose(null)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={FolderRootIcon} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    Workspace root
                  </span>
                </CommandItem>
              )}

              {options.map(({ resource, path, parentPath }) => (
                <CommandItem
                  key={resource.id}
                  value={`resource:${resource.id}`}
                  keywords={[
                    resource.name,
                    path,
                    RESOURCE_KIND_CONFIG[resource.kind].label,
                  ]}
                  data-checked={value === resource.id}
                  onSelect={() => choose(resource.id)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ResourceKindIcon
                      kind={resource.kind}
                      icon={resource.icon}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{resource.name}</span>
                    {parentPath && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {parentPath}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
