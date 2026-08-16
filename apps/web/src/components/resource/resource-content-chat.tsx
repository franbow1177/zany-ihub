import { useEffect, useRef, useState } from "react"
import { ArrowUp02Icon, BubbleChatIcon } from "@hugeicons/core-free-icons"
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
import { Card } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"

import type { Resource } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

export function ChatConversation({
  chatId,
  resource,
  compact = false,
}: {
  chatId: string
  resource: Resource
  compact?: boolean
}) {
  const zero = useZero()
  const { data: session } = authClient.useSession()
  const [chat, chatState] = useQuery(queries.humanChats.byID({ id: chatId }))
  const [messages = [], messagesState] = useQuery(
    queries.humanChats.messages({ chatId })
  )
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const orderedMessages = [...messages].reverse()
  const latestMessage = orderedMessages.at(-1)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  useEffect(() => {
    if (
      !chat ||
      !latestMessage ||
      chat.readStates.at(0)?.lastReadMessageId === latestMessage.id
    ) {
      return
    }
    void zero.mutate(
      mutators.humanChats.markRead({
        id: chat.readStates.at(0)?.id ?? crypto.randomUUID(),
        chatId,
        messageId: latestMessage.id,
        now: latestMessage.createdAt ?? 0,
      })
    ).client
  }, [chat, chatId, latestMessage, zero])

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = input.trim()
    if (!body || isSending) return

    setInput("")
    setIsSending(true)
    setError(null)
    try {
      const result = zero.mutate(
        mutators.humanChats.sendMessage({
          id: crypto.randomUUID(),
          chatId,
          body,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
    } catch (sendError) {
      setInput(body)
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send message"
      )
    } finally {
      setIsSending(false)
    }
  }

  const queryError =
    chatState.type === "error"
      ? chatState.error.message
      : messagesState.type === "error"
        ? messagesState.error.message
        : null

  if (!chat && !queryError) {
    return (
      <Skeleton
        className={
          compact
            ? "h-96 rounded-xl"
            : "h-[calc(100svh-7.5rem)] min-h-[30rem] rounded-xl"
        }
      />
    )
  }

  if (!chat) {
    return <p className="text-sm text-destructive">{queryError}</p>
  }

  const otherParticipant =
    chat.type === "dm"
      ? (chat.participants.find(
          (participant) => participant.userId !== session?.user.id
        )?.user ?? chat.participants.at(0)?.user)
      : null
  const title = otherParticipant?.name ?? resource.name
  const eyebrow =
    chat.type === "dm"
      ? "Direct message"
      : chat.type === "thread"
        ? "Discussion"
        : "Workspace channel"

  return (
    <div
      className={
        compact
          ? "flex min-h-[28rem] flex-col gap-3"
          : "flex h-[calc(100svh-5.5rem)] min-h-[30rem] flex-col gap-4 sm:h-[calc(100svh-6.5rem)] lg:h-[calc(100svh-7.5rem)]"
      }
    >
      {!compact && (
        <div className="shrink-0">
          <p className="mb-1 text-sm text-muted-foreground">{eyebrow}</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <HugeiconsIcon icon={BubbleChatIcon} strokeWidth={1.8} />
            {title}
          </h1>
          {resource.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {resource.description}
            </p>
          )}
        </div>
      )}

      <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {orderedMessages.length === 0 ? (
            <div className="grid h-full min-h-64 place-items-center text-center text-sm text-muted-foreground">
              No messages yet. Start the conversation.
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {orderedMessages.map((message) => {
                const author = message.author
                return (
                  <article className="flex items-start gap-3" key={message.id}>
                    <Avatar className="mt-0.5 size-8">
                      {author?.image && (
                        <AvatarImage src={author.image} alt={author.name} />
                      )}
                      <AvatarFallback>
                        {(author?.name || "?").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-medium">
                          {author?.name || "Unknown member"}
                        </p>
                        <time className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(message.createdAt ?? 0))}
                        </time>
                      </div>
                      <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                        {message.deletedAt ? (
                          <span className="text-muted-foreground italic">
                            Message deleted
                          </span>
                        ) : (
                          message.body
                        )}
                      </p>
                    </div>
                  </article>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form className="border-t p-3 sm:p-4" onSubmit={send}>
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              value={input}
              rows={2}
              className="min-h-10 resize-none"
              placeholder={`Message ${title}`}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={!input.trim() || isSending}
            >
              <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
            </Button>
          </div>
          {(error || queryError) && (
            <p className="mx-auto mt-2 max-w-3xl text-xs text-destructive">
              {error || queryError}
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}

export function ResourceContentChat({ resource }: { resource: Resource }) {
  return <ChatConversation chatId={resource.id} resource={resource} />
}
