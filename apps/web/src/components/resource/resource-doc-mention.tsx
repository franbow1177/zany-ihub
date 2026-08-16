import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"

import { EntityHoverCard } from "@/components/entity-hover-card"
import type { WorkspaceMentionItem } from "@/lib/workspace-mentions"

export function ResourceDocMention({
  node,
  mentionItems,
}: ReactNodeViewProps & { mentionItems: WorkspaceMentionItem[] }) {
  const entity = mentionItems.find((item) => item.key === node.attrs.id)
  const label = node.attrs.label ?? node.attrs.id

  return (
    <NodeViewWrapper as="span" className="workspace-mention-node">
      {entity ? (
        <EntityHoverCard entity={entity}>@{label}</EntityHoverCard>
      ) : (
        <span className="workspace-mention">@{label}</span>
      )}
    </NodeViewWrapper>
  )
}
