import { useMemo, useState } from "react"
import {
  Add01Icon,
  DragDropVerticalIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import DragHandle from "@tiptap/extension-drag-handle-react"
import { Placeholder } from "@tiptap/extensions"
import Mention from "@tiptap/extension-mention"
import {
  EditorContent,
  ReactNodeViewRenderer,
  ReactRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import { exitSuggestion } from "@tiptap/suggestion"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import type { Resource, WorkspaceMember } from "@/lib/api"
import {
  buildWorkspaceMentionItems,
  filterWorkspaceMentionItems,
} from "@/lib/workspace-mentions"
import {
  ResourceDocMentionList,
  type ResourceDocMentionListHandle,
  type ResourceDocMentionListProps,
} from "./resource-doc-mention-list"
import { ResourceDocMention } from "./resource-doc-mention"
import { ResourceDocSlashCommand } from "./resource-doc-slash-command"

const dragHandlePosition = {
  placement: "left-start" as const,
  strategy: "absolute" as const,
}

const bubbleMenuPosition = {
  placement: "top" as const,
  offset: 8,
  flip: true,
  shift: true,
}

function storageKey(resourceId: string) {
  return `zany-ihub:document:${resourceId}`
}

function loadDocument(resourceId: string) {
  return window.localStorage.getItem(storageKey(resourceId)) ?? ""
}

export function ResourceContentDoc({
  resource,
  resources,
  members,
}: {
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
}) {
  const mentionItems = useMemo(
    () => buildWorkspaceMentionItems(resources, members),
    [resources, members]
  )
  const [hoveredBlock, setHoveredBlock] = useState<{
    pos: number
    nodeSize: number
  } | null>(null)

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        ResourceDocSlashCommand,
        Placeholder.configure({
          placeholder: "Write something, or press '/' for commands…",
        }),
        Mention.extend({
          addNodeView() {
            return ReactNodeViewRenderer(
              (props) => (
                <ResourceDocMention {...props} mentionItems={mentionItems} />
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
              filterWorkspaceMentionItems(mentionItems, query),
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
        }),
      ],
      content: loadDocument(resource.id),
      editorProps: {
        attributes: {
          class:
            "tiptap min-h-[32rem] py-6 pr-5 pl-14 sm:py-8 sm:pr-8 sm:pl-16",
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        window.localStorage.setItem(
          storageKey(resource.id),
          currentEditor.getHTML()
        )
      },
    },
    [mentionItems, resource.id]
  )

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      strike: currentEditor.isActive("strike"),
    }),
  })

  function addBlockAfterHoveredBlock() {
    if (!editor || !hoveredBlock) return

    const insertPos = hoveredBlock.pos + hoveredBlock.nodeSize

    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, {
        type: "paragraph",
        content: [{ type: "text", text: "/" }],
      })
      .setTextSelection(insertPos + 2)
      .run()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Document</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {resource.name}
          </h1>
        </div>
        <Badge variant="outline">Saved locally</Badge>
      </div>

          {editor ? (
            <BubbleMenu
              editor={editor}
              pluginKey="resource-doc-selection-toolbar"
              updateDelay={0}
              options={bubbleMenuPosition}
              appendTo={() => document.body}
              shouldShow={({ editor: currentEditor, state, from, to }) =>
                currentEditor.isEditable &&
                from !== to &&
                state.selection.$from.parent.inlineContent &&
                state.selection.$to.parent.inlineContent &&
                !currentEditor.isActive("codeBlock")
              }
            >
              <div
                className="z-50 flex items-center gap-0.5 rounded-lg border bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur-sm"
                role="toolbar"
                aria-label="Text formatting"
              >
                <Button
                  type="button"
                  size="icon-sm"
                  variant={editorState?.bold ? "secondary" : "ghost"}
                  aria-label="Bold"
                  aria-pressed={editorState?.bold}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <HugeiconsIcon icon={TextBoldIcon} strokeWidth={2} />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={editorState?.italic ? "secondary" : "ghost"}
                  aria-label="Italic"
                  aria-pressed={editorState?.italic}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <HugeiconsIcon icon={TextItalicIcon} strokeWidth={2} />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={editorState?.strike ? "secondary" : "ghost"}
                  aria-label="Strikethrough"
                  aria-pressed={editorState?.strike}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <HugeiconsIcon icon={TextStrikethroughIcon} strokeWidth={2} />
                </Button>
              </div>
            </BubbleMenu>
          ) : null}
          {editor ? (
            <DragHandle
              editor={editor}
              className="resource-doc-drag-handle"
              computePositionConfig={dragHandlePosition}
              onNodeChange={({ node, pos }) =>
                setHoveredBlock(node ? { pos, nodeSize: node.nodeSize } : null)
              }
            >
              <div className="flex items-center rounded-md bg-background/95 p-0.5 text-muted-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm">
                <button
                  type="button"
                  className="flex size-6 items-center justify-center rounded-sm outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  contentEditable={false}
                  draggable={false}
                  aria-label="Add block below"
                  title="Add block below"
                  onMouseDown={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                  onClick={addBlockAfterHoveredBlock}
                >
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="flex size-6 cursor-grab items-center justify-center rounded-sm outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
                  contentEditable={false}
                  aria-label="Drag block"
                  title="Drag to reorder block"
                >
                  <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
                </button>
              </div>
            </DragHandle>
          ) : null}
          <EditorContent editor={editor} />
    </div>
  )
}
