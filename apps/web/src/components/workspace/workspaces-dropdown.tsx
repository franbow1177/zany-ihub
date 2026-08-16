import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import {
  ArrowDown01Icon,
  Home01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Kbd } from "@workspace/ui/components/kbd"
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

import { AppLogo } from "@/components/app-logo"
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
  const [open, setOpen] = useState(false)

  useHotkeys(
    "ctrl+w",
    (event) => {
      if (document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      setOpen((current) => !current)
    },
    {
      preventDefault: true,
    },
    []
  )

  useHotkeys(
    "ctrl+1,ctrl+2,ctrl+3,ctrl+4,ctrl+5,ctrl+6,ctrl+7,ctrl+8,ctrl+9",
    (event) => {
      if (!/^[1-9]$/.test(event.key)) return
      const item = workspaces[Number(event.key) - 1]
      if (!item) return
      event.preventDefault()
      setOpen(false)
      navigate(`/workspace/${item.id}`)
    },
    {
      enabled: open && workspaces.length > 0,
      preventDefault: true,
    },
    [navigate, open, workspaces]
  )

  if (isLoading && !workspace) {
    return (
      <div className="flex h-8 items-center gap-2 px-2">
        <Skeleton className="size-4 shrink-0 rounded-sm" />
        <Skeleton className="h-3.5 w-24 flex-1" />
      </div>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton className="data-popup-open:bg-sidebar-accent" />
            }
          >
            <AppLogo className="size-4" />
            <span className="min-w-0 flex-1 truncate text-left font-medium">
              {workspace?.name ?? "Select workspace"}
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="ml-auto size-4"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            className="min-w-64"
            data-workspaces-menu=""
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((item, index) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => navigate(`/workspace/${item.id}`)}
                >
                  <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                    {workspaceInitial(item.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {index < 9 && (
                    <Kbd className="text-[10px] text-muted-foreground">
                      ⌃{index + 1}
                    </Kbd>
                  )}
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
