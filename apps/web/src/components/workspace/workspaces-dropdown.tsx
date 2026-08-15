import { Link, useNavigate } from "react-router-dom"
import {
  ArrowDown01Icon,
  Home01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { Workspace } from "@/lib/api"

function workspaceInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "W"
}

export function WorkspacesDropdown({
  workspace,
  workspaces,
  isLoading,
}: {
  workspace: Workspace | null
  workspaces: Workspace[]
  isLoading: boolean
}) {
  const navigate = useNavigate()

  if (isLoading && !workspace) {
    return (
      <div className="flex h-12 items-center gap-2 px-2">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="grid flex-1 gap-1">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent"
              />
            }
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
              {workspace ? workspaceInitial(workspace.name) : "W"}
            </span>
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate font-medium">
                {workspace?.name ?? "Select workspace"}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                {workspace?.slug ?? "Workspace"}
              </span>
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="ml-auto size-4"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="min-w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => navigate(`/workspace/${item.id}`)}
                >
                  <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                    {workspaceInitial(item.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.id === workspace?.id && (
                    <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link to="/" />}>
              <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
              All workspaces
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
