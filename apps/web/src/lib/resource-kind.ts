import {
  AiChat02Icon,
  AiUserIcon,
  Bookmark01Icon,
  File01Icon,
  Folder01Icon,
  Note01Icon,
  Table01Icon,
  Task01Icon,
  WhiteboardIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

import type { ResourceKind } from "@/lib/api"

export const RESOURCE_KIND_CONFIG: Record<
  ResourceKind,
  { label: string; icon: IconSvgElement }
> = {
  folder: { label: "Folder", icon: Folder01Icon },
  file: { label: "File", icon: File01Icon },
  doc: { label: "Document", icon: Note01Icon },
  table: { label: "Table", icon: Table01Icon },
  whiteboard: { label: "Whiteboard", icon: WhiteboardIcon },
  project: { label: "Project", icon: Task01Icon },
  bookmark: { label: "Bookmark", icon: Bookmark01Icon },
  agent: { label: "Agent", icon: AiUserIcon },
  "ai-chat": { label: "AI chat", icon: AiChat02Icon },
}
