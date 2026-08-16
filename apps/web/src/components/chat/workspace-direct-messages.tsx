import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { BubbleChatUserIcon } from "@hugeicons/core-free-icons"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import type { WorkspaceMember } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

export function WorkspaceDirectMessages({
  workspaceId,
  members,
}: {
  workspaceId: string
  members: WorkspaceMember[]
}) {
  const zero = useZero()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const [chats = [], chatsState] = useQuery(
    queries.humanChats.byWorkspace({ workspaceId }),
    { enabled: Boolean(session && workspaceId) }
  )
  const [selectedUserId, setSelectedUserId] = useState("")
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentUserId = session?.user.id

  const directMessages = useMemo(
    () =>
      chats
        .filter((chat) => chat.type === "dm")
        .map((chat) => ({
          chat,
          other: chat.participants.find(
            (participant) => participant.userId !== currentUserId
          )?.user,
        }))
        .filter((item) => item.other),
    [chats, currentUserId]
  )
  const otherMembers = members.filter(
    (member) => member.userId !== currentUserId
  )

  async function openDirectMessage() {
    if (!selectedUserId || isOpening) return
    const existing = directMessages.find(({ chat }) =>
      chat.participants.some(
        (participant) => participant.userId === selectedUserId
      )
    )
    if (existing) {
      navigate(`/workspace/${workspaceId}/resource/${existing.chat.id}`)
      return
    }

    setIsOpening(true)
    setError(null)
    const id = crypto.randomUUID()
    try {
      const result = zero.mutate(
        mutators.humanChats.createDM({
          id,
          selfParticipantId: crypto.randomUUID(),
          otherParticipantId: crypto.randomUUID(),
          workspaceId,
          otherUserId: selectedUserId,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      navigate(`/workspace/${workspaceId}/resource/${id}`)
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Could not open direct message"
      )
    } finally {
      setIsOpening(false)
    }
  }

  const queryError =
    chatsState.type === "error" ? chatsState.error.message : null

  return (
    <Card>
      <CardHeader className="items-start gap-4 sm:grid-cols-[1fr_minmax(18rem,auto)] sm:items-end">
        <div>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={BubbleChatUserIcon} strokeWidth={2} />
            Direct messages
          </CardTitle>
          <CardDescription className="mt-1">
            Private synced conversations with workspace members.
          </CardDescription>
        </div>
        <div className="flex w-full gap-2">
          <Select
            value={selectedUserId}
            onValueChange={(value) => setSelectedUserId(value ?? "")}
          >
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue placeholder="Choose a member" />
            </SelectTrigger>
            <SelectContent>
              {otherMembers.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={!selectedUserId || isOpening}
            onClick={() => void openDirectMessage()}
          >
            {isOpening ? "Opening…" : "Message"}
          </Button>
        </div>
      </CardHeader>

      {directMessages.length > 0 && (
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {directMessages.map(({ chat, other }) => (
            <Link
              key={chat.id}
              to={`/workspace/${workspaceId}/resource/${chat.id}`}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <Avatar className="size-9">
                {other?.image && (
                  <AvatarImage src={other.image} alt={other.name} />
                )}
                <AvatarFallback>
                  {(other?.name || "?").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium">
                {other?.name || "Workspace member"}
              </span>
            </Link>
          ))}
        </CardContent>
      )}

      {(error || queryError) && (
        <p className="px-6 pb-5 text-sm text-destructive" role="alert">
          {error || queryError}
        </p>
      )}
    </Card>
  )
}
