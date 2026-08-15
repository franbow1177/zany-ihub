import { useCallback, useEffect, useState } from "react"

import {
  apiFetch,
  type Resource,
  type Workspace,
  type WorkspaceMember,
} from "@/lib/api"

type WorkspaceShellState = {
  workspace: Workspace | null
  workspaces: Workspace[]
  resources: Resource[]
  members: WorkspaceMember[]
  isLoading: boolean
  error: string | null
}

type WorkspaceShellData = WorkspaceShellState & { reload: () => void }

const initialState: WorkspaceShellState = {
  workspace: null,
  workspaces: [],
  resources: [],
  members: [],
  isLoading: true,
  error: null,
}

export function useWorkspaceShellData(
  workspaceId: string,
  enabled = true
): WorkspaceShellData {
  const [state, setState] = useState<WorkspaceShellState>(initialState)
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((current) => current + 1), [])

  useEffect(() => {
    if (!enabled || !workspaceId) {
      setState((current) => ({ ...current, isLoading: false }))
      return
    }

    const controller = new AbortController()
    setState((current) => ({ ...current, isLoading: true, error: null }))

    async function load() {
      try {
        const [workspace, workspaces, resources, members] = await Promise.all([
          apiFetch<Workspace>(`/workspaces/${workspaceId}`, {
            signal: controller.signal,
          }),
          apiFetch<Workspace[]>("/workspaces", {
            signal: controller.signal,
          }),
          apiFetch<Resource[]>(
            `/workspaces/${workspaceId}/resources?scope=all`,
            { signal: controller.signal }
          ),
          apiFetch<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`, {
            signal: controller.signal,
          }),
        ])

        setState({
          workspace,
          workspaces,
          resources,
          members,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        setState((current) => ({
          ...current,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not load workspace navigation",
        }))
      }
    }

    void load()
    return () => controller.abort()
  }, [enabled, revision, workspaceId])

  return { ...state, reload }
}
