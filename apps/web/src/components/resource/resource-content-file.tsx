import { useEffect, useState } from "react"
import { File01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { downloadUrl, type Resource } from "@/lib/api"

type Preview =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; mimeType: string; url?: string; text?: string }

function isTextPreview(mimeType: string) {
  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("xml")
  )
}

function FilePreview({ preview, name }: { preview: Preview; name: string }) {
  if (preview.status === "loading") {
    return (
      <div className="grid min-h-[32rem] place-items-center text-muted-foreground">
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-6 animate-spin"
          strokeWidth={2}
        />
        <span className="sr-only">Loading preview</span>
      </div>
    )
  }

  if (preview.status === "empty" || preview.status === "error") {
    return (
      <Empty className="min-h-[32rem] border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>
            {preview.status === "error" ? "Preview unavailable" : "No file yet"}
          </EmptyTitle>
          <EmptyDescription>
            {preview.status === "error"
              ? preview.message
              : "Use Edit resource to upload a file for this resource."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (preview.text !== undefined) {
    return (
      <pre className="max-h-[70vh] min-h-[32rem] overflow-auto p-6 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {preview.text}
      </pre>
    )
  }

  if (preview.mimeType.startsWith("image/") && preview.url) {
    return (
      <div className="grid min-h-[32rem] place-items-center bg-muted/20 p-4">
        <img
          src={preview.url}
          alt={`Preview of ${name}`}
          className="max-h-[70vh] max-w-full rounded-md object-contain"
        />
      </div>
    )
  }

  if (preview.mimeType === "application/pdf" && preview.url) {
    return (
      <iframe
        src={preview.url}
        title={`Preview of ${name}`}
        className="h-[70vh] min-h-[32rem] w-full bg-background"
      />
    )
  }

  if (preview.mimeType.startsWith("video/") && preview.url) {
    return (
      <div className="grid min-h-[32rem] place-items-center bg-black p-4">
        <video
          src={preview.url}
          aria-label={`Preview of ${name}`}
          className="max-h-[70vh] max-w-full"
          controls
        />
      </div>
    )
  }

  if (preview.mimeType.startsWith("audio/") && preview.url) {
    return (
      <div className="grid min-h-[32rem] place-items-center bg-muted/20 p-8">
        <audio
          src={preview.url}
          aria-label={`Preview of ${name}`}
          className="w-full max-w-xl"
          controls
        />
      </div>
    )
  }

  return (
    <Empty className="min-h-[32rem] border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>Preview unavailable</EmptyTitle>
        <EmptyDescription>
          This file type does not have an in-browser preview.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function ResourceContentFile({ resource }: { resource: Resource }) {
  const uploaded = Boolean(resource.file?.uploaded)
  const [preview, setPreview] = useState<Preview>(() =>
    uploaded ? { status: "loading" } : { status: "empty" }
  )

  useEffect(() => {
    if (!uploaded) return

    const controller = new AbortController()
    let objectUrl: string | undefined

    async function loadPreview() {
      try {
        const response = await fetch(downloadUrl(resource.id), {
          credentials: "include",
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("The file could not be loaded.")

        const blob = await response.blob()
        const mimeType =
          resource.file?.mimeType || blob.type || "application/octet-stream"

        if (isTextPreview(mimeType)) {
          setPreview({ status: "ready", mimeType, text: await blob.text() })
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setPreview({ status: "ready", mimeType, url: objectUrl })
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        setPreview({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The file could not be loaded.",
        })
      }
    }

    void loadPreview()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [resource.file?.mimeType, resource.id, uploaded])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">File preview</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {resource.file?.originalName || resource.name}
          </h1>
        </div>
        <Badge variant={uploaded ? "secondary" : "outline"}>
          {uploaded ? "Preview" : "Awaiting file"}
        </Badge>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          <FilePreview
            preview={preview}
            name={resource.file?.originalName || resource.name}
          />
        </CardContent>
      </Card>
    </div>
  )
}
