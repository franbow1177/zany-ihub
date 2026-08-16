import type { JSONContent } from "@tiptap/core"

const STORED_CHAT_CONTENT_PREFIX = "tiptap:"

export class LatestValue<T> {
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

function isRichTextDocument(value: unknown): value is JSONContent {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "doc" &&
    (!("content" in value) || Array.isArray(value.content))
  )
}

export function plainTextToRichText(text: string): JSONContent {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  }
}

export function serializeChatRichText(content: JSONContent) {
  return `${STORED_CHAT_CONTENT_PREFIX}${JSON.stringify(content)}`
}

export function storedChatRichText(body: string): JSONContent {
  if (!body.startsWith(STORED_CHAT_CONTENT_PREFIX)) {
    return plainTextToRichText(body)
  }

  try {
    const parsed: unknown = JSON.parse(
      body.slice(STORED_CHAT_CONTENT_PREFIX.length)
    )
    return isRichTextDocument(parsed) ? parsed : plainTextToRichText(body)
  } catch {
    return plainTextToRichText(body)
  }
}

export function messageMetadataRichText(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null
  const content = Reflect.get(metadata, "richText")
  return isRichTextDocument(content) ? content : null
}
