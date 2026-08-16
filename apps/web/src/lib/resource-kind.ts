import {
  Activity01Icon,
  Bookmark02Icon,
  BubbleChatIcon,
  BubbleChatSparkIcon,
  CheckmarkSquare04Icon,
  DatabaseIcon,
  DrawingModeIcon,
  FileEmpty01Icon,
  FileEmpty02Icon,
  Folder01Icon,
  GoogleGeminiIcon,
  Home04Icon,
  User02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

import type { ResourceKind } from "@/lib/api"

export const RESOURCE_KIND_CONFIG: Record<
  ResourceKind,
  {
    label: string
    plural: string
    icon: IconSvgElement
    description: string
  }
> = {
  folder: {
    label: "Folder",
    plural: "Folders",
    icon: Folder01Icon,
    description: "A container that can hold other workspace resources.",
  },
  file: {
    label: "File",
    plural: "Files",
    icon: FileEmpty01Icon,
    description: "A resource backed by an uploaded file in object storage.",
  },
  doc: {
    label: "Document",
    plural: "Documents",
    icon: FileEmpty02Icon,
    description: "A writing surface for structured document content.",
  },
  table: {
    label: "Table",
    plural: "Tables",
    icon: DatabaseIcon,
    description: "A structured grid for rows, columns, and typed values.",
  },
  whiteboard: {
    label: "Whiteboard",
    plural: "Whiteboards",
    icon: DrawingModeIcon,
    description: "An infinite canvas for sketches, diagrams, and ideas.",
  },
  project: {
    label: "Project",
    plural: "Projects",
    icon: CheckmarkSquare04Icon,
    description: "A focused space for a project and its tasks.",
  },
  bookmark: {
    label: "Bookmark",
    plural: "Bookmarks",
    icon: Bookmark02Icon,
    description: "A link to another resource or an external website.",
  },
  agent: {
    label: "Agent",
    plural: "Agents",
    icon: GoogleGeminiIcon,
    description: "A reusable model, persona, and system prompt.",
  },
  "ai-chat": {
    label: "AI chat",
    plural: "AI chats",
    icon: BubbleChatSparkIcon,
    description: "A persistent conversation with a model or agent.",
  },
  chat: {
    label: "Channel",
    plural: "Channels",
    icon: BubbleChatIcon,
    description: "A real-time conversation for workspace members.",
  },
}

export const WORKSPACE_NAV_CONFIG = {
  overview: { label: "Overview", icon: Home04Icon },
  members: { label: "Members", icon: User02Icon },
  teams: { label: "Teams", icon: UserMultiple02Icon },
  audit: { label: "Audit log", icon: Activity01Icon },
} as const

export const RESOURCE_KINDS = Object.keys(
  RESOURCE_KIND_CONFIG
) as ResourceKind[]
