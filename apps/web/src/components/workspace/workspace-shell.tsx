import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import type { Resource, Workspace, WorkspaceMember } from "@/lib/api"
import { WorkspaceBreadcrumb } from "./workspace-breadcrumb"
import { WorkspaceMembers } from "./workspace-members"
import { WorkspaceSearch } from "./workspace-search"
import { WorkspaceSidebar } from "./workspace-sidebar"

export function WorkspaceShell({
  workspace,
  workspaces,
  resources,
  members,
  activeResourceId,
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
  isLoading: boolean
  onResourceUpdated?: (resource: Resource) => void
  onResourceDeleted?: (resource: Resource) => void
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <SidebarProvider
        style={{ "--sidebar-width": "17rem" } as React.CSSProperties}
      >
        <WorkspaceSidebar
          workspace={workspace}
          workspaces={workspaces}
          resources={resources}
          activeResourceId={activeResourceId}
          isLoading={isLoading}
        />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-4" />
              <WorkspaceBreadcrumb
                workspace={workspace}
                resources={resources}
                activeResourceId={activeResourceId}
                isLoading={isLoading}
                onResourceUpdated={onResourceUpdated}
                onResourceDeleted={onResourceDeleted}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {workspace && (
                <WorkspaceSearch
                  workspaceId={workspace.id}
                  resources={resources}
                  members={members}
                />
              )}
              <WorkspaceMembers members={members} isLoading={isLoading} />
            </div>
          </header>
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
