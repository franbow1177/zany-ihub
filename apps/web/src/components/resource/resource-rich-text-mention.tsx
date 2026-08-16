import Mention from "@tiptap/extension-mention"
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react"
import { exitSuggestion } from "@tiptap/suggestion"

import { filterWorkspaceMentionItems } from "@/lib/workspace-mentions"
import type { WorkspaceMentionItem } from "@/lib/workspace-mentions"
import {
  ResourceDocMentionList,
  type ResourceDocMentionListHandle,
  type ResourceDocMentionListProps,
} from "./resource-doc-mention-list"
import { ResourceDocMention } from "./resource-doc-mention"

export function createWorkspaceMentionExtension(
  getMentionItems: () => WorkspaceMentionItem[]
) {
  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer(
        (props) => (
          <ResourceDocMention {...props} mentionItems={getMentionItems()} />
        ),
        { as: "span" }
      )
    },
  }).configure({
    HTMLAttributes: { class: "workspace-mention" },
    deleteTriggerWithBackspace: true,
    renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
    suggestion: {
      char: "@",
      items: ({ query }) =>
        filterWorkspaceMentionItems(getMentionItems(), query),
      render: () => {
        let component: ReactRenderer<
          ResourceDocMentionListHandle,
          ResourceDocMentionListProps
        > | null = null
        let unmount: (() => void) | null = null

        return {
          onStart: (props) => {
            component = new ReactRenderer(ResourceDocMentionList, {
              props,
              editor: props.editor,
            })
            unmount = props.mount(component.element)
          },
          onUpdate: (props) => component?.updateProps(props),
          onKeyDown: (props) => {
            if (props.event.key === "Escape") {
              exitSuggestion(props.view)
              return true
            }
            return component?.ref?.onKeyDown(props) ?? false
          },
          onExit: () => {
            unmount?.()
            component?.destroy()
            component = null
            unmount = null
          },
        }
      },
    },
  })
}
