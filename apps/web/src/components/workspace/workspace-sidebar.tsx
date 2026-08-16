import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  AiChat02Icon,
  AiUserIcon,
  Bookmark01Icon,
  BubbleChatIcon,
  ChevronRightIcon,
  Clock01Icon,
  File01Icon,
  Folder01Icon,
  Logout01Icon,
  Note01Icon,
  Table01Icon,
  Task01Icon,
  WhiteboardIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { Resource, ResourceKind, Workspace } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import { WorkspacesDropdown } from "./workspaces-dropdown"

const KIND_CONFIG: Record<
  ResourceKind,
  { label: string; icon: IconSvgElement }
> = {
  folder: { label: "Folders", icon: Folder01Icon },
  file: { label: "Files", icon: File01Icon },
  doc: { label: "Docs", icon: Note01Icon },
  table: { label: "Tables", icon: Table01Icon },
  whiteboard: { label: "Whiteboards", icon: WhiteboardIcon },
  project: { label: "Projects", icon: Task01Icon },
  bookmark: { label: "Bookmarks", icon: Bookmark01Icon },
  agent: { label: "Agents", icon: AiUserIcon },
  "ai-chat": { label: "AI chats", icon: AiChat02Icon },
  chat: { label: "Channels", icon: BubbleChatIcon },
}

function ResourceSubmenu({
  resources,
  workspaceId,
  activeResourceId,
}: {
  resources: Resource[]
  workspaceId: string
  activeResourceId?: string
}) {
  if (resources.length === 0) {
    return (
      <p className="py-1 pr-2 pl-11 text-xs text-sidebar-foreground/45">
        Nothing here yet
      </p>
    )
  }

  return (
    <SidebarMenuSub className="gap-0">
      {resources.map((resource) => (
        <SidebarMenuSubItem key={resource.id}>
          <SidebarMenuSubButton
            className="h-8 text-sm [&_svg]:size-4"
            isActive={resource.id === activeResourceId}
            render={
              <Link to={`/workspace/${workspaceId}/resource/${resource.id}`} />
            }
          >
            <ResourceKindIcon kind={resource.kind} icon={resource.icon} />
            <span>{resource.name}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  )
}

function CollapsibleResourceGroup({
  label,
  icon,
  resources,
  workspaceId,
  activeResourceId,
  defaultOpen = true,
}: {
  label: string
  icon: IconSvgElement
  resources: Resource[]
  workspaceId: string
  activeResourceId?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenu>
        <SidebarMenuItem>
          <CollapsibleTrigger render={<SidebarMenuButton />}>
            <HugeiconsIcon icon={icon} strokeWidth={2} />
            <span>{label}</span>
            <span className="ml-auto text-xs text-sidebar-foreground/55 tabular-nums">
              {resources.length}
            </span>
            <HugeiconsIcon
              icon={ChevronRightIcon}
              strokeWidth={2}
              className={`transition-transform ${open ? "rotate-90" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ResourceSubmenu
              resources={resources}
              workspaceId={workspaceId}
              activeResourceId={activeResourceId}
            />
          </CollapsibleContent>
        </SidebarMenuItem>
      </SidebarMenu>
    </Collapsible>
  )
}

export function WorkspaceSidebar({
  workspace,
  workspaces,
  resources,
  activeResourceId,
  isLoading,
}: {
  workspace: Workspace | null
  workspaces: Workspace[]
  resources: Resource[]
  activeResourceId?: string
  isLoading: boolean
}) {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const recent = [...resources]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 5)

  async function signOut() {
    await authClient.signOut()
    navigate("/", { replace: true })
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="p-2">
        <WorkspacesDropdown
          workspace={workspace}
          workspaces={workspaces}
          isLoading={isLoading}
        />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {isLoading && resources.length === 0 ? (
          <SidebarGroup>
            <div className="grid gap-2 px-2 py-1">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-4/5" />
              <Skeleton className="h-8 w-11/12" />
            </div>
          </SidebarGroup>
        ) : workspace ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <CollapsibleResourceGroup
                  label="Recent"
                  icon={Clock01Icon}
                  resources={recent}
                  workspaceId={workspace.id}
                  activeResourceId={activeResourceId}
                />
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Resources by kind</SidebarGroupLabel>
              <SidebarGroupContent className="space-y-0.5">
                {(Object.keys(KIND_CONFIG) as ResourceKind[]).map((kind) => {
                  const config = KIND_CONFIG[kind]
                  const items = resources
                    .filter((resource) => resource.kind === kind)
                    .sort((a, b) => a.name.localeCompare(b.name))

                  return (
                    <CollapsibleResourceGroup
                      key={`${kind}:${activeResourceId ?? "workspace"}`}
                      label={config.label}
                      icon={config.icon}
                      resources={items}
                      workspaceId={workspace.id}
                      activeResourceId={activeResourceId}
                      defaultOpen={items.some(
                        (item) => item.id === activeResourceId
                      )}
                    />
                  )
                })}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>
      {session && (
        <SidebarFooter>
          <div className="flex items-center gap-2 rounded-lg p-1.5">
            <Avatar>
              <AvatarFallback>
                {(session.user.name || session.user.email)
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">
                {session.user.name || "Signed in"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/55">
                {session.user.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void signOut()}
            >
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            </Button>
          </div>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
