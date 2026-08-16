import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import type { Resource, Workspace, WorkspaceMember } from "@/lib/api"
import {
  ResourceDiscussionButtonGroup,
  ResourceDiscussionPanel,
  type DiscussionMode,
} from "../resource/resource-discussion"
import { WorkspaceBreadcrumb } from "./workspace-breadcrumb"
import { WorkspaceMembers } from "./workspace-members"
import { WorkspaceSearch } from "./workspace-search"
import { WorkspaceSidebar } from "./workspace-sidebar"

export type WorkspaceContentSize = "full" | "default" | "narrow"

export function WorkspaceShell({
  workspace,
  workspaces,
  resources,
  members,
  activeResourceId,
  discussionResource,
  contentSize = "default",
  isLoading,
  onResourceUpdated,
  onResourceDeleted,
  children,
}: {
  workspace: Workspace | null
  workspaces: Workspace[]
  resources: Resource[]
  members: WorkspaceMember[]
  activeResourceId?: string
  discussionResource?: Resource
  contentSize?: WorkspaceContentSize
  isLoading: boolean
  onResourceUpdated?: (resource: Resource) => void
  onResourceDeleted?: (resource: Resource) => void
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const [discussionOpen, setDiscussionOpen] = useState(false)
  const [discussionMode, setDiscussionMode] =
    useState<DiscussionMode>("threads")
  const [aiChatId, setAiChatId] = useState<string | null>(null)

  useHotkeys(
    "ctrl+0",
    (event) => {
      if (!workspace) return
      if (document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      navigate(`/workspace/${workspace.id}`)
    },
    {
      enabled: Boolean(workspace),
      preventDefault: true,
    },
    [navigate, workspace]
  )

  return (
    <TooltipProvider>
      <SidebarProvider
        style={{ "--sidebar-width": "17rem" } as React.CSSProperties}
      >
        <WorkspaceSidebar
          workspace={workspace}
          workspaces={workspaces}
          resources={resources}
          members={members}
          activeResourceId={activeResourceId}
          isLoading={isLoading}
        />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              <WorkspaceBreadcrumb
                workspace={workspace}
                resources={resources}
                members={members}
                activeResourceId={activeResourceId}
                isLoading={isLoading}
                onResourceUpdated={onResourceUpdated}
                onResourceDeleted={onResourceDeleted}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {discussionResource && workspace && (
                <ResourceDiscussionButtonGroup
                  resource={discussionResource}
                  resources={resources}
                  workspaceId={workspace.id}
                  open={discussionOpen}
                  mode={discussionMode}
                  onOpenChange={setDiscussionOpen}
                  onModeChange={setDiscussionMode}
                  onAiChatIdChange={setAiChatId}
                />
              )}
              {workspace && (
                <WorkspaceSearch
                  workspaceId={workspace.id}
                  resources={resources}
                  members={members}
                />
              )}
              <WorkspaceMembers
                workspaceId={workspace?.id}
                members={members}
                isLoading={isLoading}
              />
            </div>
          </header>
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-y-auto">
              <div
                className={cn(
                  "mx-auto flex w-full flex-col px-16 pt-8",
                  contentSize === "full" && "max-w-none",
                  contentSize === "default" && "max-w-6xl",
                  contentSize === "narrow" && "max-w-3xl"
                )}
              >
                {children}
              </div>
            </div>
            {discussionResource && discussionOpen && workspace && (
              <aside className="fixed inset-y-0 right-0 z-40 w-full border-l bg-background md:sticky md:top-14 md:z-auto md:h-[calc(100svh-3.5rem)] md:w-[clamp(20rem,32vw,28rem)] md:shrink-0">
                <ResourceDiscussionPanel
                  key={`${discussionResource.id}:${discussionMode}:${aiChatId ?? "none"}`}
                  resource={discussionResource}
                  resources={resources}
                  members={members}
                  workspaceId={workspace.id}
                  mode={discussionMode}
                  aiChatId={aiChatId}
                  onClose={() => setDiscussionOpen(false)}
                />
              </aside>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
