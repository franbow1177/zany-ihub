import { useMemo, useState } from "react"
import {
  Add01Icon,
  Comment01Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import type { Resource, WorkspaceMember } from "@/lib/api"
import { RESOURCE_KIND_CONFIG } from "@/lib/resource-kind"
import { ChatConversation } from "./resource-content-chat"
import { ResourceContentAiChat } from "./resource-content-ai-chat"
import { ResourceFormSheet } from "./resource-form-sheet"
import { ResourceKindIcon } from "./resource-kind-icon"
import { ResourcePicker } from "./resource-picker"

export type DiscussionMode = "threads" | "ai"

const AI_ABOUT_PREFIX = "about:"
const AI_WORKSPACE_ABOUT_PREFIX = "about:workspace:"

function aiAboutDescription(resourceId: string) {
  return `${AI_ABOUT_PREFIX}${resourceId}`
}

function aiWorkspaceAboutDescription(workspaceId: string) {
  return `${AI_WORKSPACE_ABOUT_PREFIX}${workspaceId}`
}

function ThreadTab({
  thread,
  workspaceId,
  resources,
  members,
}: {
  thread: Resource
  workspaceId: string
  resources: Resource[]
  members: WorkspaceMember[]
}) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="group/thread-tab relative min-w-0 shrink-0">
      <TabsTrigger value={thread.id} className="max-w-44 gap-1.5">
        <span className="relative grid size-4 shrink-0 place-items-center">
          <ResourceKindIcon
            kind={thread.kind}
            icon={thread.icon}
            className="size-4 transition-opacity group-hover/thread-tab:pointer-events-none group-hover/thread-tab:opacity-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={`Edit ${thread.name}`}
            aria-label={`Edit ${thread.name}`}
            className="absolute inset-0 size-4 rounded-sm p-0 opacity-0 transition-opacity group-hover/thread-tab:opacity-100 focus-visible:opacity-100"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setEditOpen(true)
            }}
          >
            <HugeiconsIcon
              icon={Edit02Icon}
              className="size-3.5"
              strokeWidth={2}
            />
          </Button>
        </span>
        <span className="truncate">{thread.name}</span>
      </TabsTrigger>
      <ResourceFormSheet
        workspaceId={workspaceId}
        resources={resources}
        members={members}
        resource={thread}
        trigger={null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  )
}

export function ResourceDiscussionButtonGroup({
  resource,
  resources,
  workspaceId,
  open,
  mode,
  onOpenChange,
  onModeChange,
  onAiChatIdChange,
}: {
  resource?: Resource
  resources: Resource[]
  workspaceId: string
  open: boolean
  mode: DiscussionMode
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: DiscussionMode) => void
  onAiChatIdChange: (aiChatId: string) => void
}) {
  const zero = useZero()
  const [isCreatingAi, setIsCreatingAi] = useState(false)
  const canUseThreads = Boolean(resource)

  function toggleThreads() {
    if (!resource) return
    if (open && mode === "threads") {
      onOpenChange(false)
      return
    }
    onModeChange("threads")
    onOpenChange(true)
  }

  async function openAiChat() {
    if (open && mode === "ai") {
      onOpenChange(false)
      return
    }
    if (isCreatingAi) return

    const about = resource
      ? aiAboutDescription(resource.id)
      : aiWorkspaceAboutDescription(workspaceId)
    const existing = resources.find(
      (item) => item.kind === "ai-chat" && item.description === about
    )
    if (existing) {
      onAiChatIdChange(existing.id)
      onModeChange("ai")
      onOpenChange(true)
      return
    }

    const id = crypto.randomUUID()
    setIsCreatingAi(true)
    try {
      const result = zero.mutate(
        mutators.resources.create({
          id,
          workspaceId,
          parentId: resource
            ? resource.kind === "folder"
              ? resource.id
              : resource.parentId
            : null,
          kind: "ai-chat",
          name: resource ? `AI · ${resource.name}` : "AI chat",
          description: about,
          icon: null,
          bookmark: null,
          channelParticipants: null,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      onAiChatIdChange(id)
      onModeChange("ai")
      onOpenChange(true)
    } finally {
      setIsCreatingAi(false)
    }
  }

  return (
    <ButtonGroup>
      {canUseThreads && (
        <Button
          type="button"
          variant={open && mode === "threads" ? "default" : "secondary"}
          size="icon"
          aria-label="Threads"
          title="Threads"
          aria-pressed={open && mode === "threads"}
          onClick={toggleThreads}
        >
          <HugeiconsIcon
            icon={Comment01Icon}
            className="size-4"
            strokeWidth={2}
          />
        </Button>
      )}
      <Button
        type="button"
        variant={open && mode === "ai" ? "default" : "secondary"}
        size="icon"
        aria-label="AI chat"
        title="AI chat"
        aria-pressed={open && mode === "ai"}
        disabled={isCreatingAi}
        onClick={() => void openAiChat()}
      >
        <HugeiconsIcon
          icon={RESOURCE_KIND_CONFIG["ai-chat"].icon}
          className="size-4"
          strokeWidth={2}
        />
      </Button>
    </ButtonGroup>
  )
}

function DiscussionAiPanel({
  aiChatId,
  resources,
  members,
  onAiChatIdChange,
}: {
  aiChatId: string
  resources: Resource[]
  members: WorkspaceMember[]
  onAiChatIdChange: (aiChatId: string) => void
}) {
  const aiResource = useMemo(
    () => resources.find((item) => item.id === aiChatId),
    [aiChatId, resources]
  )
  const [resourceRow] = useQuery(queries.resources.byID({ id: aiChatId }), {
    enabled: !aiResource,
  })
  const resource =
    aiResource ??
    (resourceRow
      ? ({
          id: resourceRow.id,
          workspaceId: resourceRow.workspaceId,
          parentId: resourceRow.parentId,
          kind: resourceRow.kind,
          name: resourceRow.name,
          description: resourceRow.description,
          icon: resourceRow.icon,
          createdBy: resourceRow.createdBy,
          createdAt: resourceRow.createdAt,
          updatedAt: resourceRow.updatedAt,
          file: null,
        } as Resource)
      : null)

  if (!resource || resource.kind !== "ai-chat") {
    return (
      <div className="grid h-full min-h-64 place-items-center text-sm text-muted-foreground">
        Starting AI chat…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0">
        <ResourcePicker
          resources={resources}
          value={aiChatId}
          onValueChange={(next) => {
            if (next) onAiChatIdChange(next)
          }}
          allowedKinds={["ai-chat"]}
          placeholder="Choose AI chat"
          searchPlaceholder="Search AI chats…"
          groupHeading="AI chats"
          size="sm"
        />
      </div>
      <div className="min-h-0 flex-1">
        <ResourceContentAiChat
          resource={resource}
          resources={resources}
          members={members}
          compact
        />
      </div>
    </div>
  )
}

export function ResourceDiscussionPanel({
  resource,
  resources,
  members,
  workspaceId,
  mode = "threads",
  aiChatId = null,
  onAiChatIdChange,
}: {
  resource?: Resource
  resources: Resource[]
  members: WorkspaceMember[]
  workspaceId: string
  mode?: DiscussionMode
  aiChatId?: string | null
  onAiChatIdChange?: (aiChatId: string) => void
  onClose?: () => void
}) {
  const zero = useZero()
  const [threads = [], threadsState] = useQuery(
    queries.humanChats.byTarget({ id: resource?.id ?? "__none__" }),
    { enabled: Boolean(resource) && mode === "threads" }
  )
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeThreadId = threads.some(
    (thread) => thread.id === selectedThreadId
  )
    ? selectedThreadId
    : (threads.at(0)?.id ?? null)

  async function createThread() {
    if (!resource || isCreating) return
    const id = crypto.randomUUID()
    const name = `Thread ${threads.length + 1}`
    setSelectedThreadId(id)
    setIsCreating(true)
    setError(null)
    try {
      const result = zero.mutate(
        mutators.humanChats.createThread({
          id,
          targetResourceId: resource.id,
          name,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
    } catch (createError) {
      setSelectedThreadId(null)
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create thread"
      )
    } finally {
      setIsCreating(false)
    }
  }

  const queryError =
    threadsState.type === "error" ? threadsState.error.message : null

  if (mode === "ai") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background p-3">
        {aiChatId && onAiChatIdChange ? (
          <DiscussionAiPanel
            aiChatId={aiChatId}
            resources={resources}
            members={members}
            onAiChatIdChange={onAiChatIdChange}
          />
        ) : (
          <div className="grid h-full min-h-64 place-items-center text-sm text-muted-foreground">
            Starting AI chat…
          </div>
        )}
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="grid h-full min-h-64 place-items-center px-6 text-center text-sm text-muted-foreground">
        Open a resource to use threads.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <Tabs
        value={activeThreadId ?? undefined}
        onValueChange={(value) => setSelectedThreadId(String(value))}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="flex shrink-0 items-center gap-1 px-2 py-1.5">
          <TabsList className="no-scrollbar min-w-0 flex-1 justify-start overflow-x-auto">
            {threads.flatMap((thread) =>
              thread.resource
                ? [
                    <ThreadTab
                      key={thread.id}
                      thread={thread.resource as Resource}
                      workspaceId={workspaceId}
                      resources={resources}
                      members={members}
                    />,
                  ]
                : []
            )}
          </TabsList>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="New thread"
            aria-label="New thread"
            disabled={isCreating}
            onClick={() => void createThread()}
          >
            <HugeiconsIcon
              icon={Add01Icon}
              className="size-4"
              strokeWidth={2}
            />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {threads.length === 0 ? (
            <div className="grid h-full min-h-64 place-items-center px-6 text-center">
              <div>
                <HugeiconsIcon
                  icon={Comment01Icon}
                  className="mx-auto mb-3 size-6 text-muted-foreground"
                  strokeWidth={1.8}
                />
                <p className="font-medium">No threads yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a thread for a focused conversation about this
                  resource.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  disabled={isCreating || threadsState.type === "unknown"}
                  onClick={() => void createThread()}
                >
                  <HugeiconsIcon
                    icon={Add01Icon}
                    className="size-4"
                    strokeWidth={2}
                  />
                  {isCreating ? "Creating…" : "New thread"}
                </Button>
              </div>
            </div>
          ) : (
            threads.flatMap((thread) =>
              thread.resource
                ? [
                    <TabsContent
                      key={thread.id}
                      value={thread.id}
                      className="h-full min-h-0"
                    >
                      <ChatConversation
                        chatId={thread.id}
                        resource={thread.resource as Resource}
                        resources={resources}
                        members={members}
                        compact
                      />
                    </TabsContent>,
                  ]
                : []
            )
          )}
        </div>
      </Tabs>

      {(error || queryError) && (
        <p
          className="shrink-0 border-t px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error || queryError}
        </p>
      )}
    </div>
  )
}
