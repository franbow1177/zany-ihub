import type { Resource, ResourceKind, WorkspaceMember } from "@/lib/api"

export type WorkspaceMentionItem = {
  key: string
  id: string
  type: "resource" | "member"
  label: string
  description: string
  resourceKind?: ResourceKind
  resourceIcon?: string | null
  resourceDescription?: string | null
  updatedAt?: number
  image?: string | null
  userId?: string
  memberRole?: WorkspaceMember["role"]
}

export function buildWorkspaceMentionItems(
  resources: Resource[],
  members: WorkspaceMember[]
): WorkspaceMentionItem[] {
  const resourceItems = [...resources]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map<WorkspaceMentionItem>((resource) => ({
      key: `resource:${resource.id}`,
      id: resource.id,
      type: "resource",
      label: resource.name,
      description: resource.kind,
      resourceKind: resource.kind,
      resourceIcon: resource.icon,
      resourceDescription: resource.description,
      updatedAt: resource.updatedAt,
    }))
  const memberItems = [...members]
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
    .map<WorkspaceMentionItem>((member) => ({
      key: `member:${member.id}`,
      id: member.id,
      type: "member",
      label: member.name || member.email,
      description: member.email,
      image: member.image,
      userId: member.userId,
      memberRole: member.role,
    }))

  return [...resourceItems, ...memberItems]
}

export function filterWorkspaceMentionItems(
  items: WorkspaceMentionItem[],
  query: string,
  limit = 10
) {
  const normalizedQuery = query.trim().toLowerCase()
  return items
    .filter(
      (item) =>
        !normalizedQuery ||
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.type.includes(normalizedQuery)
    )
    .slice(0, limit)
}
