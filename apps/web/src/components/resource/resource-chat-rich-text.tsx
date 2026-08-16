import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from "react"
import type { JSONContent } from "@tiptap/core"
import { Extension } from "@tiptap/core"
import { Placeholder } from "@tiptap/extensions"
import { Markdown } from "@tiptap/markdown"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { cn } from "@workspace/ui/lib/utils"

import type { WorkspaceMentionItem } from "@/lib/workspace-mentions"
import { LatestValue } from "./resource-chat-rich-text-utils"
import { ResourceDocSlashCommand } from "./resource-doc-slash-command"
import { createWorkspaceMentionExtension } from "./resource-rich-text-mention"

type ChatEditorState = {
  disabled: boolean
  empty: boolean
  mentionItems: WorkspaceMentionItem[]
  onEmptyChange?: (empty: boolean) => void
  onSubmit: () => void
}

function createChatEnterSubmit(getState: () => ChatEditorState) {
  return Extension.create({
    name: "chatEnterSubmit",
    priority: 1000,
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          if (document.querySelector("[data-suggestion-list]")) return false
          const current = getState()
          if (current.disabled || current.empty) return false
          current.onSubmit()
          return true
        },
      }
    },
  })
}

export type ChatRichTextValue = {
  content: JSONContent
  text: string
}

export type ResourceChatEditorHandle = {
  clear: () => void
  focus: () => void
  getValue: () => ChatRichTextValue | null
  setContent: (content: JSONContent) => void
}

export const ResourceChatEditor = forwardRef<
  ResourceChatEditorHandle,
  {
    className?: string
    disabled?: boolean
    mentionItems: WorkspaceMentionItem[]
    onEmptyChange?: (empty: boolean) => void
    onSubmit: () => void
    placeholder: string
  }
>(function ResourceChatEditor(
  {
    className,
    disabled = false,
    mentionItems,
    onEmptyChange,
    onSubmit,
    placeholder,
  },
  ref
) {
  const [latest] = useState(
    () =>
      new LatestValue<ChatEditorState>({
        disabled,
        empty: true,
        mentionItems,
        onEmptyChange,
        onSubmit,
      })
  )

  useEffect(() => {
    latest.set({
      ...latest.get(),
      disabled,
      mentionItems,
      onEmptyChange,
      onSubmit,
    })
  }, [disabled, latest, mentionItems, onEmptyChange, onSubmit])

  const getMentionItems = useCallback(() => latest.get().mentionItems, [latest])
  const updateEmptyState = useCallback(
    (empty: boolean) => {
      latest.set({ ...latest.get(), empty })
      latest.get().onEmptyChange?.(empty)
    },
    [latest]
  )
  const editor = useEditor(
    {
      extensions: [
        createChatEnterSubmit(() => latest.get()),
        StarterKit,
        ResourceDocSlashCommand,
        Placeholder.configure({ placeholder }),
        createWorkspaceMentionExtension(getMentionItems),
      ],
      content: "",
      editable: !disabled,
      editorProps: {
        attributes: {
          class:
            "tiptap chat-tiptap chat-tiptap-composer max-h-40 min-h-10 overflow-x-hidden overflow-y-auto px-2 py-2",
          "aria-label": placeholder,
        },
      },
      onCreate: ({ editor: currentEditor }) =>
        updateEmptyState(currentEditor.isEmpty),
      onUpdate: ({ editor: currentEditor }) =>
        updateEmptyState(currentEditor.isEmpty),
    },
    [getMentionItems, placeholder, updateEmptyState]
  )

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        editor?.commands.clearContent(true)
      },
      focus() {
        editor?.commands.focus()
      },
      getValue() {
        if (!editor || editor.isDestroyed || editor.isEmpty) return null
        return {
          content: editor.getJSON(),
          text: editor.getText({ blockSeparator: "\n" }).trim(),
        }
      },
      setContent(content) {
        editor?.commands.setContent(content, { emitUpdate: true })
      },
    }),
    [editor]
  )

  return (
    <EditorContent
      editor={editor && !editor.isDestroyed ? editor : null}
      className={cn("min-w-0 flex-1", disabled && "opacity-60", className)}
      aria-disabled={disabled}
    />
  )
})

export function ResourceChatComposer({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-end gap-2 rounded-xl border bg-background p-2 shadow-xs focus-within:ring-3 focus-within:ring-ring/20",
        className
      )}
    >
      {children}
    </div>
  )
}

export function ResourceChatMessage({
  className,
  content,
  contentType = "json",
  mentionItems,
}: {
  className?: string
  content: JSONContent | string
  contentType?: "json" | "markdown"
  mentionItems: WorkspaceMentionItem[]
}) {
  const [mentionItemsStore] = useState(() => new LatestValue(mentionItems))
  useEffect(() => {
    mentionItemsStore.set(mentionItems)
  }, [mentionItems, mentionItemsStore])
  const getMentionItems = useCallback(
    () => mentionItemsStore.get(),
    [mentionItemsStore]
  )
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Markdown.configure({
          markedOptions: { breaks: true, gfm: true },
        }),
        createWorkspaceMentionExtension(getMentionItems),
      ],
      content,
      contentType,
      editable: false,
      editorProps: {
        attributes: {
          class: cn(
            "tiptap chat-tiptap chat-tiptap-message break-words",
            className
          ),
          "aria-label": "Message content",
        },
      },
    },
    [getMentionItems]
  )

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.commands.setContent(content, {
      contentType,
      emitUpdate: false,
    })
  }, [content, contentType, editor, mentionItems])

  return (
    <EditorContent editor={editor && !editor.isDestroyed ? editor : null} />
  )
}
