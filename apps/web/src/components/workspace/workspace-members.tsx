import { UserGroupIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { WorkspaceMember } from "@/lib/api"

function initials(name: string, email: string) {
  const value = name.trim() || email.trim()
  const parts = value.split(/[\s@]+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

function MemberAvatar({ member }: { member: WorkspaceMember }) {
  return (
    <Avatar  title={member.name || member.email}>
      {member.image && <AvatarImage src={member.image} alt="" />}
      <AvatarFallback>{initials(member.name, member.email)}</AvatarFallback>
    </Avatar>
  )
}

export function WorkspaceMembers({
  members,
  isLoading,
}: {
  members: WorkspaceMember[]
  isLoading: boolean
}) {
  if (isLoading && members.length === 0) {
    return <Skeleton className="h-7 w-20 rounded-full" />
  }

  const visibleMembers = members.slice(0, 4)
  const hiddenCount = Math.max(0, members.length - visibleMembers.length)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className="h-8 gap-2 rounded-full px-1.5"
            aria-label={`View ${members.length} workspace members`}
          />
        }
      >
        {members.length > 0 ? (
          <AvatarGroup>
            {visibleMembers.map((member) => (
              <MemberAvatar member={member} key={member.id} />
            ))}
            {hiddenCount > 0 && (
              <AvatarGroupCount className="size-6 text-xs">
                +{hiddenCount}
              </AvatarGroupCount>
            )}
          </AvatarGroup>
        ) : (
          <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
        )}
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {members.length}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle>Workspace members</PopoverTitle>
          <PopoverDescription>
            {members.length} {members.length === 1 ? "person" : "people"} in
            this workspace
          </PopoverDescription>
        </PopoverHeader>
        <ScrollArea className="max-h-72">
          <div className="grid gap-1 pr-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60"
              >
                <Avatar>
                  {member.image && <AvatarImage src={member.image} alt="" />}
                  <AvatarFallback>
                    {initials(member.name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name || member.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
