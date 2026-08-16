import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  Add01Icon,
  ChevronRightIcon,
  Clock01Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type {
  Resource,
  ResourceKind,
  Workspace,
  WorkspaceMember,
} from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import {
  RESOURCE_KIND_CONFIG,
  RESOURCE_KINDS,
  WORKSPACE_NAV_CONFIG,
} from "@/lib/resource-kind"
import { ResourceKindIcon } from "@/components/resource/resource-kind-icon"
import {
  ResourceDropdown,
  ResourceDropdownSidebarTrigger,
} from "@/components/resource/resource-dropdown"
import { ResourceFormSheet } from "@/components/resource/resource-form-sheet"
import { WorkspacesDropdown } from "./workspaces-dropdown"

function ResourceSubmenu({
  resources,
  allResources,
  members,
  workspaceId,
  activeResourceId,
  onResourceUpdated,
  onResourceDeleted,
}: {
  resources: Resource[]
  allResources: Resource[]
  members: WorkspaceMember[]
  workspaceId: string
  activeResourceId?: string
  onResourceUpdated?: (resource: Resource) => void
  onResourceDeleted?: (resource: Resource) => void
}) {
  if (resources.length === 0) {
    return (
      <p className="py-1 pr-0 pl-11 text-xs text-sidebar-foreground/45">
        Nothing here yet
      </p>
    )
  }

  return (
    <SidebarMenuSub className="mx-0 gap-0 border-l-0 py-0 pr-0 pl-8">
      {resources.map((resource) => (
        <SidebarMenuSubItem key={resource.id}>
          <SidebarMenuSubButton
            className="h-8 pr-7 text-sm [&_svg]:size-4"
            isActive={resource.id === activeResourceId}
            render={
              <Link to={`/workspace/${workspaceId}/resource/${resource.id}`} />
            }
          >
            <ResourceKindIcon kind={resource.kind} icon={resource.icon} />
            <span>{resource.name}</span>
          </SidebarMenuSubButton>
          <ResourceDropdown
            resource={resource}
            resources={allResources}
            members={members}
            workspaceId={workspaceId}
            align="end"
            side="right"
            trigger={
              <ResourceDropdownSidebarTrigger resourceName={resource.name} />
            }
            onUpdated={onResourceUpdated}
            onDeleted={onResourceDeleted}
          />
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  )
}

function CollapsibleSidebarGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarGroup className="py-1">
        <CollapsibleTrigger
          render={
            <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent" />
          }
        >
          <span>{label}</span>
          <HugeiconsIcon
            icon={ChevronRightIcon}
            strokeWidth={2}
            className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

function CollapsibleResourceGroup({
  label,
  icon,
  resources,
  workspaceId,
  activeResourceId,
  createKind,
  allResources,
  members,
  defaultOpen = true,
  onResourceUpdated,
  onResourceDeleted,
}: {
  label: string
  icon: IconSvgElement
  resources: Resource[]
  workspaceId: string
  activeResourceId?: string
  createKind?: ResourceKind
  allResources?: Resource[]
  members?: WorkspaceMember[]
  defaultOpen?: boolean
  onResourceUpdated?: (resource: Resource) => void
  onResourceDeleted?: (resource: Resource) => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(defaultOpen)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenu>
        <SidebarMenuItem>
          <CollapsibleTrigger render={<SidebarMenuButton className="pr-2!" />}>
            <HugeiconsIcon icon={icon} strokeWidth={2} />
            <span>{label}</span>
            <HugeiconsIcon
              icon={ChevronRightIcon}
              strokeWidth={2}
              className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`}
            />
          </CollapsibleTrigger>
          {createKind && allResources && members && (
            <SidebarMenuAction
              showOnHover
              className="right-8"
              render={
                <button
                  type="button"
                  aria-label={`New ${label}`}
                  title={`New ${label}`}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setCreateOpen(true)
                  }}
                />
              }
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            </SidebarMenuAction>
          )}
          <CollapsibleContent>
            <ResourceSubmenu
              resources={resources}
              allResources={allResources ?? resources}
              members={members ?? []}
              workspaceId={workspaceId}
              activeResourceId={activeResourceId}
              onResourceUpdated={onResourceUpdated}
              onResourceDeleted={onResourceDeleted}
            />
          </CollapsibleContent>
          {createKind && allResources && members && (
            <ResourceFormSheet
              workspaceId={workspaceId}
              resources={allResources}
              members={members}
              defaultKind={createKind}
              trigger={null}
              open={createOpen}
              onOpenChange={setCreateOpen}
              onCreated={(resource) =>
                navigate(`/workspace/${workspaceId}/resource/${resource.id}`)
              }
            />
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </Collapsible>
  )
}

export function WorkspaceSidebar({
  workspace,
  workspaces,
  resources,
  members,
  activeResourceId,
  isLoading,
  onResourceUpdated,
  onResourceDeleted,
}: {
  workspace: Workspace | null
  workspaces: Workspace[]
  resources: Resource[]
  members: WorkspaceMember[]
  activeResourceId?: string
  isLoading: boolean
  onResourceUpdated?: (resource: Resource) => void
  onResourceDeleted?: (resource: Resource) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const zero = useZero()
  const { data: session } = authClient.useSession()
  const [chats = []] = useQuery(
    queries.humanChats.byWorkspace({
      workspaceId: workspace?.id ?? "__none__",
    }),
    { enabled: Boolean(session && workspace?.id) }
  )
  const [openingUserId, setOpeningUserId] = useState<string | null>(null)
  const [dmError, setDmError] = useState<string | null>(null)
  const recent = [...resources]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 5)
  const otherMembers = members.filter(
    (member) => member.userId !== session?.user.id
  )
  const canViewAudit = members.some(
    (member) => member.userId === session?.user.id && member.role === "owner"
  )
  const dmByUserId = new Map<string, (typeof chats)[number]>()
  for (const chat of chats) {
    if (chat.type !== "dm") continue
    const other = chat.participants.find(
      (participant) => participant.userId !== session?.user.id
    )
    if (other) dmByUserId.set(other.userId, chat)
  }

  async function signOut() {
    await authClient.signOut()
    navigate("/", { replace: true })
  }

  async function openDirectMessage(member: WorkspaceMember, now: number) {
    if (!workspace || openingUserId) return
    const existing = dmByUserId.get(member.userId)
    if (existing) {
      navigate(`/workspace/${workspace.id}/resource/${existing.id}`)
      return
    }

    const id = crypto.randomUUID()
    setOpeningUserId(member.userId)
    setDmError(null)
    try {
      const result = zero.mutate(
        mutators.humanChats.createDM({
          id,
          selfParticipantId: crypto.randomUUID(),
          otherParticipantId: crypto.randomUUID(),
          workspaceId: workspace.id,
          otherUserId: member.userId,
          now,
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      navigate(`/workspace/${workspace.id}/resource/${id}`)
    } catch (openError) {
      setDmError(
        openError instanceof Error
          ? openError.message
          : "Could not open direct message"
      )
    } finally {
      setOpeningUserId(null)
    }
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-none">
      <SidebarHeader className="p-2">
        <WorkspacesDropdown
          workspace={workspace}
          workspaces={workspaces}
          isLoading={isLoading}
        />
      </SidebarHeader>
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
            <CollapsibleSidebarGroup label="Workspace">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={
                      location.pathname === `/workspace/${workspace.id}`
                    }
                    render={<Link to={`/workspace/${workspace.id}`} />}
                  >
                    <HugeiconsIcon
                      icon={WORKSPACE_NAV_CONFIG.overview.icon}
                      strokeWidth={2}
                    />
                    <span>{WORKSPACE_NAV_CONFIG.overview.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={
                      location.pathname === `/workspace/${workspace.id}/members`
                    }
                    render={<Link to={`/workspace/${workspace.id}/members`} />}
                  >
                    <HugeiconsIcon
                      icon={WORKSPACE_NAV_CONFIG.members.icon}
                      strokeWidth={2}
                    />
                    <span>{WORKSPACE_NAV_CONFIG.members.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={
                      location.pathname === `/workspace/${workspace.id}/teams`
                    }
                    render={<Link to={`/workspace/${workspace.id}/teams`} />}
                  >
                    <HugeiconsIcon
                      icon={WORKSPACE_NAV_CONFIG.teams.icon}
                      strokeWidth={2}
                    />
                    <span>{WORKSPACE_NAV_CONFIG.teams.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {canViewAudit && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={
                        location.pathname === `/workspace/${workspace.id}/audit`
                      }
                      render={<Link to={`/workspace/${workspace.id}/audit`} />}
                    >
                      <HugeiconsIcon
                        icon={WORKSPACE_NAV_CONFIG.audit.icon}
                        strokeWidth={2}
                      />
                      <span>{WORKSPACE_NAV_CONFIG.audit.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
              <CollapsibleResourceGroup
                label="Recent"
                icon={Clock01Icon}
                resources={recent}
                workspaceId={workspace.id}
                activeResourceId={activeResourceId}
                allResources={resources}
                members={members}
                onResourceUpdated={onResourceUpdated}
                onResourceDeleted={onResourceDeleted}
              />
            </CollapsibleSidebarGroup>
            <CollapsibleSidebarGroup label="Resources">
              <div className="space-y-0.5">
                {(RESOURCE_KINDS as ResourceKind[]).map((kind) => {
                  const config = RESOURCE_KIND_CONFIG[kind]
                  const items = resources
                    .filter((resource) => resource.kind === kind)
                    .sort((a, b) => a.name.localeCompare(b.name))

                  return (
                    <CollapsibleResourceGroup
                      key={`${kind}:${activeResourceId ?? "workspace"}`}
                      label={config.plural}
                      icon={config.icon}
                      resources={items}
                      workspaceId={workspace.id}
                      activeResourceId={activeResourceId}
                      createKind={kind}
                      allResources={resources}
                      members={members}
                      defaultOpen={items.some(
                        (item) => item.id === activeResourceId
                      )}
                      onResourceUpdated={onResourceUpdated}
                      onResourceDeleted={onResourceDeleted}
                    />
                  )
                })}
              </div>
            </CollapsibleSidebarGroup>
            <CollapsibleSidebarGroup label="DMs">
              {otherMembers.length === 0 ? (
                <p className="px-2 py-1 text-xs text-sidebar-foreground/45">
                  No other members yet
                </p>
              ) : (
                <SidebarMenu>
                  {otherMembers.map((member) => {
                    const dm = dmByUserId.get(member.userId)
                    return (
                      <SidebarMenuItem key={member.id}>
                        <SidebarMenuButton
                          isActive={dm?.id === activeResourceId}
                          disabled={openingUserId === member.userId}
                          render={
                            <button
                              type="button"
                              onClick={(event) =>
                                void openDirectMessage(
                                  member,
                                  Math.round(
                                    performance.timeOrigin + event.timeStamp
                                  )
                                )
                              }
                            />
                          }
                        >
                          <Avatar className="size-4">
                            {member.image && (
                              <AvatarImage src={member.image} alt="" />
                            )}
                            <AvatarFallback className="text-[8px]">
                              {(member.name || member.email)
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.name || member.email}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              )}
              {dmError && (
                <p className="px-2 py-1 text-xs text-destructive" role="alert">
                  {dmError}
                </p>
              )}
            </CollapsibleSidebarGroup>
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
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {session.user.name || "Signed in"}
            </p>
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
    </Sidebar>
  )
}
