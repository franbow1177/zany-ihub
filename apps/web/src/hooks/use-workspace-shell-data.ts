import { useMemo } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { queries } from "@workspace/zero/queries"

import type {
  Resource,
  Workspace,
  WorkspaceMember,
} from "@/lib/api"

export function useWorkspaceShellData(
  workspaceId: string,
  enabled = true
) {
  const shouldLoad = enabled && Boolean(workspaceId)
  const [workspace, workspaceState] = useQuery(
    queries.workspaces.byID({ id: workspaceId }),
    { enabled: shouldLoad }
  )
  const [workspaces = [], workspacesState] = useQuery(
    queries.workspaces.mine(),
    { enabled }
  )
  const [resources = [], resourcesState] = useQuery(
    queries.resources.byWorkspace({ workspaceId }),
    { enabled: shouldLoad }
  )
  const [memberRows = [], membersState] = useQuery(
    queries.members.byWorkspace({ workspaceId }),
    { enabled: shouldLoad }
  )

  const members = useMemo<WorkspaceMember[]>(
    () =>
      memberRows.flatMap((member) =>
        member.user
          ? [
              {
                id: member.id,
                workspaceId: member.workspaceId,
                userId: member.userId,
                role: member.role,
                createdAt: member.createdAt ?? 0,
                name: member.user.name,
                email: member.user.email,
                image: member.user.image ?? null,
              },
            ]
          : []
      ),
    [memberRows]
  )

  const states = [
    workspaceState,
    workspacesState,
    resourcesState,
    membersState,
  ]
  const errorState = states.find((state) => state.type === "error")
  function reload() {
    for (const state of states) {
      if (state.type === "error") state.retry()
    }
  }

  return {
    workspace: (workspace ?? null) as Workspace | null,
    workspaces: workspaces as Workspace[],
    resources: resources as Resource[],
    members,
    isLoading: shouldLoad && states.some((state) => state.type === "unknown"),
    error:
      errorState?.type === "error"
        ? errorState.error.message
        : null,
    reload,
  }
}
