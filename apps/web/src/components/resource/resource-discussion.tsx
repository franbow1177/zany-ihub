import { useState } from "react"
import { BubbleChatAddIcon, Comment01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

import type { Resource } from "@/lib/api"
import { ChatConversation } from "./resource-content-chat"

function DiscussionPanelContent({ resource }: { resource: Resource }) {
  const zero = useZero()
  const [thread, threadState] = useQuery(
    queries.humanChats.byTarget({ id: resource.id })
  )
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createDiscussion() {
    setIsCreating(true)
    setError(null)
    try {
      const result = zero.mutate(
        mutators.humanChats.createThread({
          id: crypto.randomUUID(),
          targetResourceId: resource.id,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not start discussion"
      )
    } finally {
      setIsCreating(false)
    }
  }

  const queryError =
    threadState.type === "error" ? threadState.error.message : null

  if (thread?.resource) {
    return (
      <ChatConversation
        chatId={thread.id}
        resource={thread.resource as Resource}
        compact
      />
    )
  }

  return (
    <div className="space-y-3 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>No discussion yet</CardTitle>
          <CardDescription>
            Start a synced thread for comments and decisions about this
            resource.
          </CardDescription>
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-fit"
            disabled={isCreating || threadState.type === "unknown"}
            onClick={() => void createDiscussion()}
          >
            <HugeiconsIcon icon={BubbleChatAddIcon} strokeWidth={2} />
            {isCreating ? "Starting…" : "Start discussion"}
          </Button>
        </CardHeader>
      </Card>

      {(error || queryError) && (
        <p className="text-sm text-destructive" role="alert">
          {error || queryError}
        </p>
      )}
    </div>
  )
}

export function ResourceDiscussionPanel({ resource }: { resource: Resource }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} />
            <span className="hidden sm:inline">Discussion</span>
          </Button>
        }
      />
      <SheetContent side="right" className="gap-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-4 pr-14">
          <SheetTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} />
            Discussion
          </SheetTitle>
          <SheetDescription>
            Comments and decisions attached to {resource.name}.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <DiscussionPanelContent resource={resource} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
