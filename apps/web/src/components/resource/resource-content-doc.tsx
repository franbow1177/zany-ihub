import { useMemo } from "react"
import {
  CodeIcon,
  Heading02Icon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Redo02Icon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  Undo02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Placeholder } from "@tiptap/extensions"
import Mention from "@tiptap/extension-mention"
import {
  EditorContent,
  ReactNodeViewRenderer,
  ReactRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { exitSuggestion } from "@tiptap/suggestion"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

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

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: "Start writing…",
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
          class: "tiptap min-h-[32rem] px-5 py-6 sm:px-8 sm:py-8",
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
      heading: currentEditor.isActive("heading", { level: 2 }),
      bulletList: currentEditor.isActive("bulletList"),
      orderedList: currentEditor.isActive("orderedList"),
      blockquote: currentEditor.isActive("blockquote"),
      codeBlock: currentEditor.isActive("codeBlock"),
      canUndo: currentEditor.can().chain().focus().undo().run(),
      canRedo: currentEditor.can().chain().focus().redo().run(),
    }),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Document</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {resource.name}
          </h1>
        </div>
        <Badge variant="outline">Saved locally</Badge>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div
          className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2"
          role="toolbar"
          aria-label="Document formatting"
        >
          <Button
            type="button"
            size="icon"
            variant={editorState?.bold ? "secondary" : "ghost"}
            aria-label="Bold"
            aria-pressed={editorState?.bold}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <HugeiconsIcon icon={TextBoldIcon} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={editorState?.italic ? "secondary" : "ghost"}
            aria-label="Italic"
            aria-pressed={editorState?.italic}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <HugeiconsIcon icon={TextItalicIcon} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={editorState?.strike ? "secondary" : "ghost"}
            aria-label="Strikethrough"
            aria-pressed={editorState?.strike}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <HugeiconsIcon icon={TextStrikethroughIcon} strokeWidth={2} />
          </Button>

          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

          <Button
            type="button"
            size="icon"
            variant={editorState?.heading ? "secondary" : "ghost"}
            aria-label="Heading"
            aria-pressed={editorState?.heading}
            disabled={!editor}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <HugeiconsIcon icon={Heading02Icon} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={editorState?.bulletList ? "secondary" : "ghost"}
            aria-label="Bulleted list"
            aria-pressed={editorState?.bulletList}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={editorState?.orderedList ? "secondary" : "ghost"}
            aria-label="Numbered list"
            aria-pressed={editorState?.orderedList}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <HugeiconsIcon icon={LeftToRightListNumberIcon} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={editorState?.blockquote ? "secondary" : "ghost"}
            aria-label="Block quote"
            aria-pressed={editorState?.blockquote}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <HugeiconsIcon icon={LeftToRightBlockQuoteIcon} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={editorState?.codeBlock ? "secondary" : "ghost"}
            aria-label="Code block"
            aria-pressed={editorState?.codeBlock}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            <HugeiconsIcon icon={CodeIcon} strokeWidth={2} />
          </Button>

          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Undo"
            disabled={!editorState?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <HugeiconsIcon icon={Undo02Icon} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Redo"
            disabled={!editorState?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <HugeiconsIcon icon={Redo02Icon} strokeWidth={2} />
          </Button>
        </div>

        <CardContent className="p-0">
          <EditorContent editor={editor} />
        </CardContent>
      </Card>
    </div>
  )
}
