import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import { SearchIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
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
} from "@workspace/ui/components/command"
import { Kbd } from "@workspace/ui/components/kbd"

import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import type { Resource, WorkspaceMember } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
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

function matchesQuery(keywords: string[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
}

type SearchHit =
  | {
      type: "resource"
      key: string
      resource: Resource
      keywords: string[]
    }
  | {
      type: "dm"
      key: string
      member: WorkspaceMember
      keywords: string[]
    }
  | {
      type: "member"
      key: string
      member: WorkspaceMember
      keywords: string[]
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
  const zero = useZero()
  const { data: session } = authClient.useSession()
  const [chats = []] = useQuery(
    queries.humanChats.byWorkspace({ workspaceId }),
    { enabled: Boolean(session && workspaceId) }
  )
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [openingUserId, setOpeningUserId] = useState<string | null>(null)
  const [dmError, setDmError] = useState<string | null>(null)

  const sortedResources = useMemo(
    () => [...resources].sort((a, b) => a.name.localeCompare(b.name)),
    [resources]
  )
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        (a.name || a.email).localeCompare(b.name || b.email)
      ),
    [members]
  )
  const directMessageMembers = useMemo(
    () => sortedMembers.filter((member) => member.userId !== session?.user.id),
    [session?.user.id, sortedMembers]
  )

  const dmByUserId = useMemo(() => {
    const map = new Map<string, (typeof chats)[number]>()
    for (const chat of chats) {
      if (chat.type !== "dm") continue
      const other = chat.participants.find(
        (participant) => participant.userId !== session?.user.id
      )
      if (other) map.set(other.userId, chat)
    }
    return map
  }, [chats, session?.user])

  const hits = useMemo<SearchHit[]>(() => {
    const next: SearchHit[] = []

    for (const resource of sortedResources) {
      next.push({
        type: "resource",
        key: `resource:${resource.id}`,
        resource,
        keywords: [resource.name, RESOURCE_KIND_CONFIG[resource.kind].label],
      })
    }

    for (const member of directMessageMembers) {
      next.push({
        type: "dm",
        key: `dm:${member.id}`,
        member,
        keywords: [member.name, member.email, "direct message", "dm"],
      })
    }

    for (const member of sortedMembers) {
      next.push({
        type: "member",
        key: `member:${member.id}`,
        member,
        keywords: [member.name, member.email, member.role],
      })
    }

    return next
  }, [directMessageMembers, sortedMembers, sortedResources])

  const filteredHits = useMemo(
    () => hits.filter((hit) => matchesQuery(hit.keywords, query)),
    [hits, query]
  )

  const shortcutByKey = useMemo(() => {
    const map = new Map<string, number>()
    filteredHits.slice(0, 9).forEach((hit, index) => {
      map.set(hit.key, index + 1)
    })
    return map
  }, [filteredHits])

  const resourceHits = filteredHits.filter(
    (hit): hit is Extract<SearchHit, { type: "resource" }> =>
      hit.type === "resource"
  )
  const dmHits = filteredHits.filter(
    (hit): hit is Extract<SearchHit, { type: "dm" }> => hit.type === "dm"
  )
  const memberHits = filteredHits.filter(
    (hit): hit is Extract<SearchHit, { type: "member" }> =>
      hit.type === "member"
  )

  function openResource(resourceId: string) {
    setOpen(false)
    setQuery("")
    navigate(`/workspace/${workspaceId}/resource/${resourceId}`)
  }

  async function openDirectMessage(member: WorkspaceMember, now: number) {
    const existing = dmByUserId.get(member.userId)
    if (existing) {
      setOpen(false)
      setQuery("")
      navigate(`/workspace/${workspaceId}/resource/${existing.id}`)
      return
    }
    if (openingUserId) return

    const id = crypto.randomUUID()
    setOpeningUserId(member.userId)
    setDmError(null)
    try {
      const result = zero.mutate(
        mutators.humanChats.createDM({
          id,
          selfParticipantId: crypto.randomUUID(),
          otherParticipantId: crypto.randomUUID(),
          workspaceId,
          otherUserId: member.userId,
          now,
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      setOpen(false)
      setQuery("")
      navigate(`/workspace/${workspaceId}/resource/${id}`)
    } catch (openError) {
      setDmError(
        openError instanceof Error
          ? openError.message
          : "Could not open direct message"
      )
    } finally {
      setOpeningUserId(null)
    }
  }

  function activateHit(hit: SearchHit | undefined) {
    if (!hit) return
    if (hit.type === "resource") {
      openResource(hit.resource.id)
      return
    }
    if (hit.type === "dm") {
      void openDirectMessage(
        hit.member,
        Math.round(performance.timeOrigin + performance.now())
      )
      return
    }
    setOpen(false)
    setQuery("")
  }

  useHotkeys(
    "mod+k",
    (event) => {
      event.preventDefault()
      setOpen((current) => {
        const next = !current
        if (!next) setQuery("")
        return next
      })
    },
    { enableOnFormTags: true, preventDefault: true },
    []
  )

  useHotkeys(
    "ctrl+1,ctrl+2,ctrl+3,ctrl+4,ctrl+5,ctrl+6,ctrl+7,ctrl+8,ctrl+9",
    (event) => {
      if (!/^[1-9]$/.test(event.key)) return
      event.preventDefault()
      activateHit(filteredHits[Number(event.key) - 1])
    },
    {
      enabled: open,
      enableOnFormTags: true,
      preventDefault: true,
    },
    [filteredHits, open, openingUserId, dmByUserId]
  )

  function shortcutLabel(key: string) {
    const index = shortcutByKey.get(key)
    if (!index) return null
    return (
      <Kbd className="ml-auto shrink-0 bg-muted/70 text-[10px]">{index}</Kbd>
    )
  }

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
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
        title="Search workspace"
        description="Search workspace resources, direct messages, and members"
        className="sm:max-w-xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search resources, DMs, and members…"
          />
          <CommandList>
            <CommandEmpty>No workspace results found.</CommandEmpty>

            {resourceHits.length > 0 && (
              <CommandGroup heading="Resources">
                {resourceHits.map((hit) => (
                  <CommandItem
                    key={hit.key}
                    value={hit.key}
                    onSelect={() => openResource(hit.resource.id)}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ResourceKindIcon
                        kind={hit.resource.kind}
                        icon={hit.resource.icon}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {hit.resource.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {RESOURCE_KIND_CONFIG[hit.resource.kind].label}
                    </span>
                    {shortcutLabel(hit.key)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {dmHits.length > 0 && (
              <CommandGroup heading="Direct messages">
                {dmHits.map((hit) => (
                  <CommandItem
                    key={hit.key}
                    value={hit.key}
                    disabled={openingUserId === hit.member.userId}
                    onSelect={() =>
                      void openDirectMessage(
                        hit.member,
                        Math.round(performance.timeOrigin + performance.now())
                      )
                    }
                  >
                    <Avatar className="size-7">
                      {hit.member.image && (
                        <AvatarImage src={hit.member.image} alt="" />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {initials(hit.member.name, hit.member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">
                      {hit.member.name || hit.member.email}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {dmByUserId.has(hit.member.userId) ? "Open" : "Start"}
                    </span>
                    {shortcutLabel(hit.key)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {dmError && (
              <p className="px-3 py-2 text-xs text-destructive" role="alert">
                {dmError}
              </p>
            )}

            {memberHits.length > 0 && (
              <CommandGroup heading="Members">
                {memberHits.map((hit) => (
                  <CommandItem
                    key={hit.key}
                    value={hit.key}
                    onSelect={() => {
                      setOpen(false)
                      setQuery("")
                    }}
                  >
                    <Avatar className="size-7">
                      {hit.member.image && (
                        <AvatarImage src={hit.member.image} alt="" />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {initials(hit.member.name, hit.member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {hit.member.name || hit.member.email}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.member.email}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground capitalize">
                      {hit.member.role}
                    </span>
                    {shortcutLabel(hit.key)}
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
