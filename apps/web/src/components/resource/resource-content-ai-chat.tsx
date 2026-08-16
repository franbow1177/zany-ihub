import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { AiUserIcon, ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { JSONContent } from "@tiptap/core"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { DefaultChatTransport, type UIMessage } from "ai"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import {
  API_URL,
  apiFetch,
  type AiModelOption,
  type AiChatContent,
  type Resource,
  type WorkspaceMember,
} from "@/lib/api"
import { RESOURCE_KIND_CONFIG } from "@/lib/resource-kind"
import { buildWorkspaceMentionItems } from "@/lib/workspace-mentions"
import {
  ResourceChatComposer,
  ResourceChatEditor,
  type ResourceChatEditorHandle,
  ResourceChatMessage,
} from "./resource-chat-rich-text"
import { messageMetadataRichText } from "./resource-chat-rich-text-utils"
import { ResourcePageHeader } from "./resource-page-header"

type AiChatMessage = UIMessage<{ richText?: JSONContent }>

function messageText(message: AiChatMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}

function ChatSession({
  resource,
  content,
  resources,
  members,
  compact = false,
}: {
  resource: Resource
  content: AiChatContent
  resources: Resource[]
  members: WorkspaceMember[]
  compact?: boolean
}) {
  const zero = useZero()
  const [inputEmpty, setInputEmpty] = useState(true)
  const [isChangingTarget, setIsChangingTarget] = useState(false)
  const [targetError, setTargetError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const editorRef = useRef<ResourceChatEditorHandle | null>(null)
  const mentionItems = useMemo(
    () => buildWorkspaceMentionItems(resources, members),
    [resources, members]
  )
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/resources/${resource.id}/ai-chat/messages`,
        credentials: "include",
      }),
    [resource.id]
  )
  const { messages, sendMessage, status, error, stop } = useChat<AiChatMessage>(
    {
      id: resource.id,
      messages: content.chat.messages as AiChatMessage[],
      transport,
    }
  )
  const isStreaming = status === "submitted" || status === "streaming"
  const targetValue = content.chat.agentId
    ? `agent:${content.chat.agentId}`
    : `model:${content.chat.model}`
  const selectedAgent = content.chat.agentId
    ? content.agents.find((agent) => agent.id === content.chat.agentId)
    : null
  const activeModelId = selectedAgent?.model ?? content.chat.model
  const activeModel = content.models.find((model) => model.id === activeModelId)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  async function changeTarget(value: string) {
    setIsChangingTarget(true)
    setTargetError(null)
    try {
      const target = value.startsWith("agent:")
        ? { type: "agent" as const, agentId: value.slice("agent:".length) }
        : { type: "model" as const, model: value.slice("model:".length) }
      const result = zero.mutate(
        mutators.chats.updateTarget({
          id: resource.id,
          target,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
    } catch (changeError) {
      setTargetError(
        changeError instanceof Error
          ? changeError.message
          : "Could not change chat target"
      )
    } finally {
      setIsChangingTarget(false)
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = editorRef.current?.getValue()
    if (!value?.text || isStreaming || isChangingTarget) return

    editorRef.current?.clear()
    setSubmitError(null)
    try {
      await sendMessage({
        text: value.text,
        metadata: { richText: value.content },
      })
    } catch (sendError) {
      editorRef.current?.setContent(value.content)
      setSubmitError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send message"
      )
    }
  }

  return (
    <div
      className={
        compact
          ? "flex h-full min-h-0 flex-col gap-3"
          : "flex min-h-0 flex-1 flex-col gap-4"
      }
    >
      {!compact && (
        <ResourcePageHeader resource={resource} className="shrink-0" />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="grid h-full min-h-64 place-items-center text-center">
              <div className="max-w-sm space-y-3">
                <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <HugeiconsIcon
                    icon={RESOURCE_KIND_CONFIG["ai-chat"].icon}
                    className="size-6"
                    strokeWidth={1.8}
                  />
                </span>
                <div>
                  <h2 className="font-medium">Start a conversation</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a model or workspace agent below, then send a
                    message.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message) => {
                const text = messageText(message)
                if (!text) return null
                const isUser = message.role === "user"
                const richText = messageMetadataRichText(message.metadata)
                return (
                  <div
                    key={message.id}
                    className={cn("flex gap-3", isUser && "justify-end")}
                  >
                    {!isUser && (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        {selectedAgent ? (
                          <ResourceKindIcon
                            kind="agent"
                            icon={selectedAgent.icon}
                            className="size-4"
                          />
                        ) : (
                          <HugeiconsIcon
                            icon={RESOURCE_KIND_CONFIG["ai-chat"].icon}
                            className="size-4"
                            strokeWidth={2}
                          />
                        )}
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
                        isUser
                          ? "rounded-br-md bg-primary/25 text-foreground"
                          : "rounded-bl-md bg-muted"
                      )}
                    >
                      <ResourceChatMessage
                        content={richText ?? text}
                        contentType={richText ? "json" : "markdown"}
                        mentionItems={mentionItems}
                        className={isUser ? "chat-tiptap-user" : undefined}
                      />
                    </div>
                  </div>
                )
              })}
              {status === "submitted" && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                    <HugeiconsIcon
                      icon={RESOURCE_KIND_CONFIG["ai-chat"].icon}
                      className="size-4 animate-pulse"
                      strokeWidth={2}
                    />
                  </span>
                  Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="shrink-0">
          <form
            ref={formRef}
            className="mx-auto max-w-3xl space-y-2"
            onSubmit={submit}
          >
            <div className="flex items-center gap-2">
              <Select
                value={targetValue}
                disabled={isStreaming || isChangingTarget}
                onValueChange={(value) => void changeTarget(String(value))}
              >
                <SelectTrigger className="h-8 w-auto max-w-48 gap-1.5 border-0 bg-muted/70 px-2.5 text-xs shadow-none">
                  <SelectValue>
                    {selectedAgent?.name ?? activeModel?.label ?? activeModelId}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" className="min-w-48">
                  <SelectGroup>
                    <SelectLabel>Models</SelectLabel>
                    {content.models.map((model) => (
                      <SelectItem key={model.id} value={`model:${model.id}`}>
                        <span className="truncate">{model.label}</span>
                        {!model.available && (
                          <span className="text-muted-foreground"> · key</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {content.agents.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Agents</SelectLabel>
                        {content.agents.map((agent) => (
                          <SelectItem
                            key={agent.id}
                            value={`agent:${agent.id}`}
                          >
                            <HugeiconsIcon icon={AiUserIcon} strokeWidth={2} />
                            <span className="truncate">{agent.name}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <ResourceChatComposer>
              <ResourceChatEditor
                ref={editorRef}
                mentionItems={mentionItems}
                placeholder={
                  activeModel?.available
                    ? "Message the model, or press '/' for commands…"
                    : "Configure OPENROUTER_API_KEY to chat"
                }
                disabled={!activeModel?.available || isChangingTarget}
                onEmptyChange={setInputEmpty}
                onSubmit={() => formRef.current?.requestSubmit()}
              />
              {isStreaming ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Stop response"
                  onClick={() => void stop()}
                >
                  <HugeiconsIcon icon={StopIcon} strokeWidth={2} />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={
                    inputEmpty || !activeModel?.available || isChangingTarget
                  }
                >
                  <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
                </Button>
              )}
            </ResourceChatComposer>
            {(targetError || submitError || error) && (
              <p className="text-xs text-destructive" role="alert">
                {targetError ?? submitError ?? error?.message}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export function ResourceContentAiChat({
  resource,
  resources,
  members,
  compact = false,
}: {
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
  compact?: boolean
}) {
  const [chat, chatState] = useQuery(queries.chats.byID({ id: resource.id }))
  const [agentRows = [], agentsState] = useQuery(
    queries.agents.byWorkspace({ workspaceId: resource.workspaceId })
  )
  const [models, setModels] = useState<AiModelOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const content: AiChatContent | null = chat
    ? {
        chat: {
          id: chat.id,
          model: chat.model ?? "openrouter/free",
          agentId: chat.agentId ?? null,
          messages: (chat.messages ?? []) as UIMessage[],
          createdAt: chat.createdAt ?? 0,
          updatedAt: chat.updatedAt ?? 0,
        },
        models,
        agents: agentRows.flatMap((agent) =>
          agent.resource
            ? [
                {
                  id: agent.id,
                  name: agent.resource.name,
                  icon: agent.resource.icon ?? null,
                  description: agent.resource.description ?? null,
                  model: agent.model ?? "openrouter/free",
                },
              ]
            : []
        ),
      }
    : null

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const next = await apiFetch<AiModelOption[]>("/ai/models", {
          signal: controller.signal,
        })
        setModels(next)
        setError(null)
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load AI chat"
        )
      }
    }

    void load()
    return () => controller.abort()
  }, [resource.id])

  const queryError =
    chatState.type === "error"
      ? chatState.error.message
      : agentsState.type === "error"
        ? agentsState.error.message
        : null

  if (!content && !error && !queryError) {
    return (
      <Skeleton
        className={
          compact ? "h-full min-h-64 rounded-xl" : "min-h-0 flex-1 rounded-xl"
        }
      />
    )
  }

  if (!content) {
    return <p className="text-sm text-destructive">{error || queryError}</p>
  }

  return (
    <ChatSession
      key={resource.id}
      resource={resource}
      content={content}
      resources={resources}
      members={members}
      compact={compact}
    />
  )
}
