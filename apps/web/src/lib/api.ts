export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

export type Workspace = {
  id: string
  name: string
  slug: string
}

export type WorkspaceMember = {
  id: string
  workspaceId: string
  userId: string
  role: "owner" | "member"
  createdAt: string
  name: string
  email: string
  image: string | null
}

export type ResourceKind =
  | "folder"
  | "file"
  | "doc"
  | "table"
  | "whiteboard"
  | "project"
  | "bookmark"

export type ResourceFileMeta = {
  mimeType: string | null
  sizeBytes: number | null
  originalName: string | null
  uploaded: boolean
}

export type Resource = {
  id: string
  workspaceId: string
  parentId: string | null
  kind: ResourceKind
  name: string
  description: string | null
  icon: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  file?: ResourceFileMeta | null
}

export type WhiteboardScene = {
  elements: unknown[]
  appState: Record<string, unknown>
}

export type WhiteboardAssetMeta = {
  id: string
  mimeType: string
  sizeBytes: number
  created: number
}

export type WhiteboardContent = {
  scene: WhiteboardScene
  revision: number
  formatVersion: number
  assets: WhiteboardAssetMeta[]
}

export type ProjectStatus = "active" | "completed" | "archived"
export type ProjectTaskStatus = "todo" | "in_progress" | "done"

export type ProjectDetails = {
  id: string
  status: ProjectStatus
  description: string | null
  createdAt: string
  updatedAt: string
}

export type ProjectTask = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: ProjectTaskStatus
  position: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ProjectContent = {
  project: ProjectDetails
  tasks: ProjectTask[]
}

export type BookmarkTarget =
  | {
      type: "resource"
      resourceId: string
      resource: Pick<Resource, "id" | "name" | "kind"> | null
    }
  | { type: "url"; url: string }

export type BookmarkContent = {
  target: BookmarkTarget | null
  updatedAt: string
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData

  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body && !isFormData
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    return response as unknown as T
  }

  return response.json() as Promise<T>
}

export function downloadUrl(resourceId: string) {
  return `${API_URL}/resources/${resourceId}/download`
}

export function whiteboardAssetUrl(resourceId: string, assetId: string) {
  return `${API_URL}/resources/${resourceId}/whiteboard/assets/${assetId}`
}
