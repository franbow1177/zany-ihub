import { useState, type MouseEvent, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card"

import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import { authClient } from "@/lib/auth-client"
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
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams()
  const zero = useZero()
  const { data: session } = authClient.useSession()
  const [opening, setOpening] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [chats = []] = useQuery(
    queries.humanChats.byWorkspace({
      workspaceId: workspaceId || "__none__",
    }),
    { enabled: Boolean(session && workspaceId && entity.type === "member") }
  )

  const isResource = entity.type === "resource" && entity.resourceKind
  const resourceKind = isResource ? entity.resourceKind : null
  const isSelf =
    entity.type === "member" &&
    Boolean(entity.userId) &&
    entity.userId === session?.user.id
  const canOpenResource = Boolean(workspaceId && entity.type === "resource")
  const canMessage =
    Boolean(workspaceId && entity.type === "member" && entity.userId) && !isSelf
  const showAction = canOpenResource || canMessage
  const footer = resourceKind
    ? [RESOURCE_KIND_CONFIG[resourceKind].label, updatedLabel(entity.updatedAt)]
        .filter(Boolean)
        .join(" · ")
    : `Workspace ${entity.memberRole ?? "member"}`

  const dmByUserId = new Map<string, (typeof chats)[number]>()
  for (const chat of chats) {
    if (chat.type !== "dm") continue
    const other = chat.participants.find(
      (participant) => participant.userId !== session?.user.id
    )
    if (other) dmByUserId.set(other.userId, chat)
  }

  async function openDirectMessage(now: number) {
    if (!workspaceId || !entity.userId || opening || isSelf) return

    const existing = dmByUserId.get(entity.userId)
    if (existing) {
      navigate(`/workspace/${workspaceId}/resource/${existing.id}`)
      return
    }

    const id = crypto.randomUUID()
    setOpening(true)
    setActionError(null)
    try {
      const result = zero.mutate(
        mutators.humanChats.createDM({
          id,
          selfParticipantId: crypto.randomUUID(),
          otherParticipantId: crypto.randomUUID(),
          workspaceId,
          otherUserId: entity.userId,
          now,
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      navigate(`/workspace/${workspaceId}/resource/${id}`)
    } catch (openError) {
      setActionError(
        openError instanceof Error
          ? openError.message
          : "Could not open direct message"
      )
    } finally {
      setOpening(false)
    }
  }

  function handleAction(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setActionError(null)

    if (canOpenResource) {
      navigate(`/workspace/${workspaceId}/resource/${entity.id}`)
      return
    }

    if (canMessage) {
      void openDirectMessage(
        Math.round(performance.timeOrigin + event.timeStamp)
      )
    }
  }

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
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {footer}
          </p>
          {showAction && (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              disabled={opening}
              onClick={handleAction}
            >
              {canOpenResource ? "Open" : opening ? "Opening…" : "Message"}
            </Button>
          )}
        </div>
        {actionError && (
          <p className="border-t px-4 py-2 text-xs text-destructive" role="alert">
            {actionError}
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
