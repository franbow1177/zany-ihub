import {
  CodeIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  TextIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { Extension, type Range } from "@tiptap/core"
import { ReactRenderer } from "@tiptap/react"
import Suggestion, {
  exitSuggestion,
  type SuggestionProps,
} from "@tiptap/suggestion"
import { PluginKey } from "@tiptap/pm/state"

import {
  ResourceDocSlashCommandList,
  type ResourceDocSlashCommandListHandle,
  type ResourceDocSlashCommandListProps,
} from "./resource-doc-slash-command-list"

type SlashCommandId =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bullet-list"
  | "ordered-list"
  | "blockquote"
  | "code-block"
  | "divider"

export type SlashCommandItem = {
  id: SlashCommandId
  title: string
  description: string
  keywords: string[]
  icon?: IconSvgElement
}

const slashCommandItems: SlashCommandItem[] = [
  {
    id: "paragraph",
    title: "Text",
    description: "Start writing with plain text",
    keywords: ["paragraph", "plain"],
    icon: TextIcon,
  },
  {
    id: "heading-1",
    title: "Heading 1",
    description: "Large section heading",
    keywords: ["h1", "title"],
    icon: Heading01Icon,
  },
  {
    id: "heading-2",
    title: "Heading 2",
    description: "Medium section heading",
    keywords: ["h2", "subtitle"],
    icon: Heading02Icon,
  },
  {
    id: "heading-3",
    title: "Heading 3",
    description: "Small section heading",
    keywords: ["h3", "subtitle"],
    icon: Heading03Icon,
  },
  {
    id: "bullet-list",
    title: "Bulleted list",
    description: "Create a simple bulleted list",
    keywords: ["unordered", "ul", "bullet"],
    icon: LeftToRightListBulletIcon,
  },
  {
    id: "ordered-list",
    title: "Numbered list",
    description: "Create a list with numbering",
    keywords: ["ordered", "ol", "number"],
    icon: LeftToRightListNumberIcon,
  },
  {
    id: "blockquote",
    title: "Quote",
    description: "Capture a quotation",
    keywords: ["blockquote", "citation"],
    icon: LeftToRightBlockQuoteIcon,
  },
  {
    id: "code-block",
    title: "Code block",
    description: "Write a formatted code snippet",
    keywords: ["code", "pre"],
    icon: CodeIcon,
  },
  {
    id: "divider",
    title: "Divider",
    description: "Separate sections with a line",
    keywords: ["separator", "horizontal rule", "hr"],
  },
]

const slashCommandPluginKey = new PluginKey("resource-doc-slash-command")

function filterSlashCommandItems(query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  return slashCommandItems.filter((item) => {
    const searchableText = [item.title, item.description, ...item.keywords]
      .join(" ")
      .toLowerCase()

    return !normalizedQuery || searchableText.includes(normalizedQuery)
  })
}

function runSlashCommand(
  editor: SuggestionProps["editor"],
  range: Range,
  item: SlashCommandItem
) {
  const chain = editor.chain().focus().deleteRange(range)

  if (item.id === "divider") {
    chain.setHorizontalRule().run()
    return
  }

  const normalizedChain = chain.clearNodes()

  switch (item.id) {
    case "paragraph":
      normalizedChain.run()
      break
    case "heading-1":
      normalizedChain.setHeading({ level: 1 }).run()
      break
    case "heading-2":
      normalizedChain.setHeading({ level: 2 }).run()
      break
    case "heading-3":
      normalizedChain.setHeading({ level: 3 }).run()
      break
    case "bullet-list":
      normalizedChain.toggleBulletList().run()
      break
    case "ordered-list":
      normalizedChain.toggleOrderedList().run()
      break
    case "blockquote":
      normalizedChain.toggleBlockquote().run()
      break
    case "code-block":
      normalizedChain.toggleCodeBlock().run()
      break
  }
}

export const ResourceDocSlashCommand = Extension.create({
  name: "resourceDocSlashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: "/",
        startOfLine: true,
        decorationClass: "resource-doc-slash-command",
        items: ({ query }) => filterSlashCommandItems(query),
        command: ({ editor, range, props }) => {
          runSlashCommand(editor, range, props)
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          return $from.parent.type.name === "paragraph"
        },
        render: () => {
          let component: ReactRenderer<
            ResourceDocSlashCommandListHandle,
            ResourceDocSlashCommandListProps
          > | null = null
          let unmount: (() => void) | null = null

          return {
            onStart: (props) => {
              component = new ReactRenderer(ResourceDocSlashCommandList, {
                props,
                editor: props.editor,
              })
              unmount = props.mount(component.element)
            },
            onUpdate: (props) => component?.updateProps(props),
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                exitSuggestion(props.view, slashCommandPluginKey)
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
      }),
    ]
  },
})
