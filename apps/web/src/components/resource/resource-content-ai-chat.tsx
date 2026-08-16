import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import {
  AiChat02Icon,
  AiUserIcon,
  ArrowUp02Icon,
  StopIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { DefaultChatTransport, type UIMessage } from "ai"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import {
  API_URL,
  apiFetch,
  type AiModelOption,
  type AiChatContent,
  type Resource,
} from "@/lib/api"

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}

function ChatSession({
  resource,
  content,
}: {
  resource: Resource
  content: AiChatContent
}) {
  const zero = useZero()
  const [input, setInput] = useState("")
  const [isChangingTarget, setIsChangingTarget] = useState(false)
  const [targetError, setTargetError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/resources/${resource.id}/ai-chat/messages`,
        credentials: "include",
      }),
    [resource.id]
  )
  const { messages, sendMessage, status, error, stop } = useChat({
    id: resource.id,
    messages: content.chat.messages,
    transport,
  })
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
    const text = input.trim()
    if (!text || isStreaming || isChangingTarget) return
    setInput("")
    await sendMessage({ text })
  }

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-[30rem] flex-col gap-4 sm:h-[calc(100svh-6.5rem)] lg:h-[calc(100svh-7.5rem)]">
      <div className="flex shrink-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-sm text-muted-foreground">AI chat</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {resource.name}
          </h1>
          {resource.description && (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {resource.description}
            </p>
          )}
        </div>
        <Badge variant={activeModel?.available ? "secondary" : "outline"}>
          {activeModel?.available ? "OpenRouter ready" : "OpenRouter key required"}
        </Badge>
      </div>

      <Card className="min-h-0 flex-1 gap-0 py-0">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {messages.length === 0 ? (
            <div className="grid h-full min-h-64 place-items-center text-center">
              <div className="max-w-sm space-y-3">
                <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <HugeiconsIcon icon={AiChat02Icon} className="size-6" strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="font-medium">Start a conversation</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a model or workspace agent below, then send a message.
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
                          <HugeiconsIcon icon={AiChat02Icon} className="size-4" strokeWidth={2} />
                        )}
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap",
                        isUser
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md bg-muted"
                      )}
                    >
                      {text}
                    </div>
                  </div>
                )
              })}
              {status === "submitted" && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                    <HugeiconsIcon icon={AiChat02Icon} className="size-4 animate-pulse" strokeWidth={2} />
                  </span>
                  Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-background p-3 sm:p-4">
          <form className="mx-auto max-w-3xl space-y-2" onSubmit={submit}>
            <div className="flex items-center gap-2">
              <Select
                value={targetValue}
                disabled={isStreaming || isChangingTarget}
                onValueChange={(value) => void changeTarget(String(value))}
              >
                <SelectTrigger className="h-8 max-w-64 border-0 bg-muted/70 text-xs shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Models</SelectLabel>
                    {content.models.map((model) => (
                      <SelectItem key={model.id} value={`model:${model.id}`}>
                        <span className="flex min-w-0 flex-col">
                          <span>{model.label} · {model.tier}</span>
                          <span className="text-xs text-muted-foreground">
                            {model.pricing}
                            {!model.available ? " · key required" : ""}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {content.agents.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Workspace agents</SelectLabel>
                        {content.agents.map((agent) => (
                          <SelectItem key={agent.id} value={`agent:${agent.id}`}>
                            <HugeiconsIcon icon={AiUserIcon} strokeWidth={2} />
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
              <span className="truncate text-xs text-muted-foreground">
                {selectedAgent?.name ?? activeModel?.label ?? activeModelId}
                {activeModel ? ` · ${activeModel.pricing}` : ""}
              </span>
            </div>

            <div className="flex items-end gap-2 rounded-xl border bg-background p-2 shadow-xs focus-within:ring-3 focus-within:ring-ring/20">
              <Textarea
                value={input}
                rows={1}
                className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                placeholder={
                  activeModel?.available
                    ? "Message the model…"
                    : "Configure OPENROUTER_API_KEY to chat"
                }
                disabled={!activeModel?.available || isChangingTarget}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
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
                  disabled={!input.trim() || !activeModel?.available || isChangingTarget}
                >
                  <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
                </Button>
              )}
            </div>
            {(targetError || error) && (
              <p className="text-xs text-destructive" role="alert">
                {targetError ?? error?.message}
              </p>
            )}
          </form>
        </div>
      </Card>
    </div>
  )
}

export function ResourceContentAiChat({ resource }: { resource: Resource }) {
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
        if (loadError instanceof Error && loadError.name === "AbortError") return
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
    return <Skeleton className="h-[calc(100svh-7.5rem)] min-h-[30rem] rounded-xl" />
  }

  if (!content) {
    return <p className="text-sm text-destructive">{error || queryError}</p>
  }

  return <ChatSession key={resource.id} resource={resource} content={content} />
}
