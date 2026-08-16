export const RESOURCE_KINDS = [
  "folder",
  "file",
  "doc",
  "table",
  "whiteboard",
  "project",
  "bookmark",
  "agent",
  "ai-chat",
  "chat",
] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export function assertParentIsFolder(parent: { kind: string } | null): void {
  if (parent === null) return
  if (parent.kind !== "folder") {
    throw new Error("parent must be a folder")
  }
}
