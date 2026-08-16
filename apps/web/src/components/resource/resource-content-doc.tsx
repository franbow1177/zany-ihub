import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { Resource, WorkspaceMember } from "@/lib/api"
import { buildWorkspaceMentionItems } from "@/lib/workspace-mentions"
import { ResourceDocSlashCommand } from "./resource-doc-slash-command"
import { ResourcePageHeader } from "./resource-page-header"
import { createWorkspaceMentionExtension } from "./resource-rich-text-mention"

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

class LatestValue<T> {
  #value: T

  constructor(value: T) {
    this.#value = value
  }

  get() {
    return this.#value
  }

  set(value: T) {
    this.#value = value
  }
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
  const zero = useZero()
  const [documentRow, documentState] = useQuery(
    queries.documents.byID({ id: resource.id })
  )
  const saveTimerRef = useRef<number | null>(null)
  const pendingContentRef = useRef<string | null>(null)
  const mountedRef = useRef(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const mentionItems = useMemo(
    () => buildWorkspaceMentionItems(resources, members),
    [resources, members]
  )
  const [mentionItemsStore] = useState(() => new LatestValue(mentionItems))
  const [hoveredBlock, setHoveredBlock] = useState<{
    pos: number
    nodeSize: number
  } | null>(null)

  useEffect(() => {
    mentionItemsStore.set(mentionItems)
  }, [mentionItems, mentionItemsStore])

  const getMentionItems = useCallback(
    () => mentionItemsStore.get(),
    [mentionItemsStore]
  )

  const persistDocument = useCallback(
    (content: string) => {
      if (zero.closed || !mountedRef.current) return

      const result = zero.mutate(
        mutators.documents.update({
          id: resource.id,
          content,
          now: Date.now(),
        })
      )
      setSaveError(null)
      void result.server
        .then((serverResult) => {
          if (serverResult.type === "error") {
            throw new Error(serverResult.error.message)
          }
        })
        .catch((error: unknown) => {
          if (zero.closed || !mountedRef.current) return
          setSaveError(
            error instanceof Error ? error.message : "Could not save document"
          )
        })
    },
    [resource.id, zero]
  )

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        ResourceDocSlashCommand,
        Placeholder.configure({
          placeholder: "Write something, or press '/' for commands…",
        }),
        createWorkspaceMentionExtension(getMentionItems),
      ],
      content: "",
      editorProps: {
        attributes: {
          class: "tiptap min-h-[32rem]",
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        if (currentEditor.isDestroyed) return

        pendingContentRef.current = currentEditor.getHTML()
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current)
        }
        saveTimerRef.current = window.setTimeout(() => {
          saveTimerRef.current = null
          const content = pendingContentRef.current
          pendingContentRef.current = null
          if (content !== null) persistDocument(content)
        }, 200)
      },
    },
    [resource.id]
  )

  useEffect(() => {
    if (!editor || editor.isDestroyed || !documentRow) return
    const content = documentRow.content ?? ""
    if (
      editor.getHTML() !== content &&
      !editor.isFocused &&
      pendingContentRef.current === null
    ) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [documentRow, editor])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      pendingContentRef.current = null
    }
  }, [])

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      !currentEditor || currentEditor.isDestroyed
        ? { bold: false, italic: false, strike: false }
        : {
            bold: currentEditor.isActive("bold"),
            italic: currentEditor.isActive("italic"),
            strike: currentEditor.isActive("strike"),
          },
  })

  const activeEditor = editor && !editor.isDestroyed ? editor : null

  function addBlockAfterHoveredBlock() {
    if (!activeEditor || !hoveredBlock) return

    const insertPos = hoveredBlock.pos + hoveredBlock.nodeSize

    activeEditor
      .chain()
      .focus()
      .insertContentAt(insertPos, {
        type: "paragraph",
        content: [{ type: "text", text: "/" }],
      })
      .setTextSelection(insertPos + 2)
      .run()
  }

  const queryError =
    documentState.type === "error" ? documentState.error.message : null

  if (!documentRow && !queryError) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-[32rem] w-full" />
      </div>
    )
  }

  if (!documentRow) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {queryError ?? "Document content not found"}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <ResourcePageHeader resource={resource} />

      {saveError && (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}

      {activeEditor ? (
        <BubbleMenu
          editor={activeEditor}
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
              size="icon"
              variant={editorState?.bold ? "secondary" : "ghost"}
              aria-label="Bold"
              aria-pressed={editorState?.bold}
              onClick={() => activeEditor.chain().focus().toggleBold().run()}
            >
              <HugeiconsIcon icon={TextBoldIcon} strokeWidth={2} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={editorState?.italic ? "secondary" : "ghost"}
              aria-label="Italic"
              aria-pressed={editorState?.italic}
              onClick={() => activeEditor.chain().focus().toggleItalic().run()}
            >
              <HugeiconsIcon icon={TextItalicIcon} strokeWidth={2} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={editorState?.strike ? "secondary" : "ghost"}
              aria-label="Strikethrough"
              aria-pressed={editorState?.strike}
              onClick={() => activeEditor.chain().focus().toggleStrike().run()}
            >
              <HugeiconsIcon icon={TextStrikethroughIcon} strokeWidth={2} />
            </Button>
          </div>
        </BubbleMenu>
      ) : null}
      {activeEditor ? (
        <DragHandle
          editor={activeEditor}
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
      <EditorContent editor={activeEditor} />
    </div>
  )
}
