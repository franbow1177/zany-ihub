import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bookmark01Icon,
  ExternalLinkIcon,
  Link01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { apiFetch, type BookmarkContent, type Resource } from "@/lib/api"

export function ResourceContentBookmark({
  resource,
  resources,
  workspaceId,
}: {
  resource: Resource
  resources: Resource[]
  workspaceId: string
}) {
  const [content, setContent] = useState<BookmarkContent | null>(null)
  const [targetType, setTargetType] = useState<"resource" | "url">("url")
  const [targetResourceId, setTargetResourceId] = useState("")
  const [url, setUrl] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const bookmark = await apiFetch<BookmarkContent>(
          `/resources/${resource.id}/bookmark`,
          { signal: controller.signal }
        )
        setContent(bookmark)
        if (bookmark.target?.type === "resource") {
          setTargetType("resource")
          setTargetResourceId(bookmark.target.resourceId)
          setUrl("")
        } else if (bookmark.target?.type === "url") {
          setTargetType("url")
          setUrl(bookmark.target.url)
          setTargetResourceId("")
        }
        setError(null)
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load bookmark"
        )
      }
    }

    void load()
    return () => controller.abort()
  }, [resource.id])

  async function saveTarget() {
    setIsSaving(true)
    setError(null)
    try {
      await apiFetch(`/resources/${resource.id}/bookmark`, {
        method: "PATCH",
        body: JSON.stringify({
          target:
            targetType === "resource"
              ? { type: "resource", resourceId: targetResourceId }
              : { type: "url", url: url.trim() },
        }),
      })
      const bookmark = await apiFetch<BookmarkContent>(
        `/resources/${resource.id}/bookmark`
      )
      setContent(bookmark)
      if (bookmark.target?.type === "resource") {
        setTargetType("resource")
        setTargetResourceId(bookmark.target.resourceId)
        setUrl("")
      } else if (bookmark.target?.type === "url") {
        setTargetType("url")
        setUrl(bookmark.target.url)
        setTargetResourceId("")
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save bookmark"
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!content && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  const resourceTarget =
    content?.target?.type === "resource" ? content.target : null
  const urlTarget = content?.target?.type === "url" ? content.target : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Bookmark</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {resource.name}
          </h1>
        </div>
        <Badge variant={content?.target ? "secondary" : "destructive"}>
          {content?.target ? "Linked" : "Missing target"}
        </Badge>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <HugeiconsIcon icon={Bookmark01Icon} strokeWidth={1.8} />
          </div>
          <CardTitle>
            {resourceTarget?.resource?.name ??
              urlTarget?.url ??
              "Target no longer exists"}
          </CardTitle>
          <CardDescription>
            {resourceTarget
              ? resourceTarget.resource
                ? `Workspace ${resourceTarget.resource.kind}`
                : "The linked resource was deleted."
              : urlTarget
                ? "External website"
                : "Choose a new target below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resourceTarget?.resource && (
            <Button
              render={
                <Link
                  to={`/workspace/${workspaceId}/resource/${resourceTarget.resourceId}`}
                />
              }
            >
              <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
              Open resource
            </Button>
          )}
          {urlTarget && (
            <Button
              render={
                <a
                  href={urlTarget.url}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <HugeiconsIcon icon={ExternalLinkIcon} strokeWidth={2} />
              Open website
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit target</CardTitle>
          <CardDescription>
            Link this bookmark to a workspace resource or an HTTP(S) URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={targetType}
            onValueChange={(value) =>
              setTargetType(value as "resource" | "url")
            }
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="url">External URL</SelectItem>
              <SelectItem value="resource">Workspace resource</SelectItem>
            </SelectContent>
          </Select>

          {targetType === "resource" ? (
            <Select
              value={targetResourceId}
              onValueChange={(value) => setTargetResourceId(String(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a resource" />
              </SelectTrigger>
              <SelectContent>
                {resources
                  .filter((item) => item.id !== resource.id)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="url"
              value={url}
              placeholder="https://example.com"
              onChange={(event) => setUrl(event.target.value)}
            />
          )}

          <Button
            disabled={
              isSaving ||
              (targetType === "resource" ? !targetResourceId : !url.trim())
            }
            onClick={() => void saveTarget()}
          >
            {isSaving ? "Saving…" : "Save target"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
