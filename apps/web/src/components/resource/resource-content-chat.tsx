import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowUp02Icon } from "@hugeicons/core-free-icons"
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
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { Resource, WorkspaceMember } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { buildWorkspaceMentionItems } from "@/lib/workspace-mentions"
import {
  ResourceChatComposer,
  ResourceChatEditor,
  type ResourceChatEditorHandle,
  ResourceChatMessage,
} from "./resource-chat-rich-text"
import {
  serializeChatRichText,
  storedChatRichText,
} from "./resource-chat-rich-text-utils"
import { ResourcePageHeader } from "./resource-page-header"

export function ChatConversation({
  chatId,
  resource,
  resources,
  members,
  compact = false,
}: {
  chatId: string
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
  compact?: boolean
}) {
  const zero = useZero()
  const { data: session } = authClient.useSession()
  const [chat, chatState] = useQuery(queries.humanChats.byID({ id: chatId }))
  const [messages = [], messagesState] = useQuery(
    queries.humanChats.messages({ chatId })
  )
  const [inputEmpty, setInputEmpty] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const editorRef = useRef<ResourceChatEditorHandle | null>(null)
  const mentionItems = useMemo(
    () => buildWorkspaceMentionItems(resources, members),
    [resources, members]
  )
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
    const value = editorRef.current?.getValue()
    if (!value?.text || isSending) return
    const body = serializeChatRichText(value.content)
    if (body.length > 20_000) {
      setError("Message is too long")
      return
    }

    editorRef.current?.clear()
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
      editorRef.current?.setContent(value.content)
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
          compact ? "h-96 rounded-xl" : "min-h-0 flex-1 rounded-xl"
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
  return (
    <div
      className={
        compact
          ? "flex h-full min-h-0 flex-col gap-3"
          : "flex min-h-0 flex-1 flex-col gap-4"
      }
    >
      {!compact && (
        <ResourcePageHeader
          resource={resource}
          title={title}
          className="shrink-0"
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
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
                      <div className="mt-1 text-sm">
                        {message.deletedAt ? (
                          <span className="text-muted-foreground italic">
                            Message deleted
                          </span>
                        ) : (
                          <ResourceChatMessage
                            content={storedChatRichText(message.body)}
                            mentionItems={mentionItems}
                          />
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form ref={formRef} className="shrink-0" onSubmit={send}>
          <div className="mx-auto flex max-w-3xl">
            <ResourceChatComposer>
              <ResourceChatEditor
                ref={editorRef}
                mentionItems={mentionItems}
                disabled={isSending}
                onEmptyChange={setInputEmpty}
                onSubmit={() => formRef.current?.requestSubmit()}
                placeholder={`Message ${title}, or press '/' for commands…`}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={inputEmpty || isSending}
              >
                <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
              </Button>
            </ResourceChatComposer>
          </div>
          {(error || queryError) && (
            <p className="mx-auto mt-2 max-w-3xl text-xs text-destructive">
              {error || queryError}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export function ResourceContentChat({
  resource,
  resources,
  members,
}: {
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
}) {
  return (
    <ChatConversation
      chatId={resource.id}
      resource={resource}
      resources={resources}
      members={members}
    />
  )
}
