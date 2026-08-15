import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { SearchIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@workspace/ui/components/command"
import { Kbd } from "@workspace/ui/components/kbd"

import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import type { Resource, WorkspaceMember } from "@/lib/api"
import { RESOURCE_KIND_CONFIG } from "@/lib/resource-kind"

function initials(name: string, email: string) {
  const value = name.trim() || email.trim()
  return value
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

export function WorkspaceSearch({
  workspaceId,
  resources,
  members,
}: {
  workspaceId: string
  resources: Resource[]
  members: WorkspaceMember[]
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  function openResource(resourceId: string) {
    setOpen(false)
    navigate(`/workspace/${workspaceId}/resource/${resourceId}`)
  }

  const sortedResources = [...resources].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const sortedMembers = [...members].sort((a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email)
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-8 w-8 justify-center px-0 text-muted-foreground sm:w-40 sm:justify-start sm:px-2.5"
        aria-label="Search workspace"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={SearchIcon} className="size-4" strokeWidth={2} />
        <span className="hidden flex-1 text-left sm:inline">Search</span>
        <Kbd className="hidden bg-muted/70 md:inline-flex">⌘ K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search workspace"
        description="Search workspace resources and members"
        className="sm:max-w-xl"
      >
        <Command>
          <CommandInput autoFocus placeholder="Search resources and members…" />
          <CommandList>
            <CommandEmpty>No workspace results found.</CommandEmpty>

            {sortedResources.length > 0 && (
              <CommandGroup heading="Resources">
                {sortedResources.map((resource) => (
                  <CommandItem
                    key={resource.id}
                    value={`resource:${resource.id}`}
                    keywords={[
                      resource.name,
                      RESOURCE_KIND_CONFIG[resource.kind].label,
                    ]}
                    onSelect={() => openResource(resource.id)}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ResourceKindIcon
                        kind={resource.kind}
                        icon={resource.icon}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {resource.name}
                    </span>
                    <CommandShortcut>
                      {RESOURCE_KIND_CONFIG[resource.kind].label}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {sortedResources.length > 0 && sortedMembers.length > 0 && (
              <CommandSeparator />
            )}

            {sortedMembers.length > 0 && (
              <CommandGroup heading="Members">
                {sortedMembers.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={`member:${member.id}`}
                    keywords={[member.name, member.email, member.role]}
                    onSelect={() => setOpen(false)}
                  >
                    <Avatar className="size-7">
                      {member.image && (
                        <AvatarImage src={member.image} alt="" />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {initials(member.name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {member.name || member.email}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    </span>
                    <CommandShortcut className="capitalize">
                      {member.role}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
