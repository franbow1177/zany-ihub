import { useMemo, useState, type ReactElement } from "react"
import {
  Add01Icon,
  AiChat02Icon,
  AiUserIcon,
  Bookmark01Icon,
  CubeIcon,
  Delete02Icon,
  Edit02Icon,
  File01Icon,
  Folder01Icon,
  GridIcon,
  Link01Icon,
  Note01Icon,
  SmileIcon,
  Table01Icon,
  Task01Icon,
  TextIcon,
  Upload01Icon,
  WhiteboardIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  apiFetch,
  type Resource,
  type ResourceFileMeta,
  type ResourceKind,
} from "@/lib/api"
import { ResourceIconPicker } from "./resource-icon-picker"

const ROOT_LOCATION = "__workspace_root__"
const PROPERTY_ROW = "gap-0 border-t sm:grid sm:grid-cols-[13rem_minmax(0,1fr)]"
const PROPERTY_LABEL = "w-full px-5 pt-4 sm:h-full sm:border-r sm:px-5 sm:py-5"
const PROPERTY_CONTROL = "min-w-0 p-4 sm:p-5"

const KIND_CONFIG: Record<
  ResourceKind,
  { label: string; plural: string; icon: IconSvgElement; description: string }
> = {
  folder: {
    label: "Folder",
    plural: "Folders",
    icon: Folder01Icon,
    description: "A container that can hold other workspace resources.",
  },
  file: {
    label: "File",
    plural: "Files",
    icon: File01Icon,
    description: "A resource backed by an uploaded file in object storage.",
  },
  doc: {
    label: "Document",
    plural: "Documents",
    icon: Note01Icon,
    description: "A writing surface for structured document content.",
  },
  table: {
    label: "Table",
    plural: "Tables",
    icon: Table01Icon,
    description: "A structured grid for rows, columns, and typed values.",
  },
  whiteboard: {
    label: "Whiteboard",
    plural: "Whiteboards",
    icon: WhiteboardIcon,
    description: "An infinite canvas for sketches, diagrams, and ideas.",
  },
  project: {
    label: "Project",
    plural: "Projects",
    icon: Task01Icon,
    description: "A focused space for a project and its tasks.",
  },
  bookmark: {
    label: "Bookmark",
    plural: "Bookmarks",
    icon: Bookmark01Icon,
    description: "A link to another resource or an external website.",
  },
  agent: {
    label: "Agent",
    plural: "Agents",
    icon: AiUserIcon,
    description: "A reusable model, persona, and system prompt.",
  },
  "ai-chat": {
    label: "AI chat",
    plural: "AI chats",
    icon: AiChat02Icon,
    description: "A persistent conversation with a model or agent.",
  },
}

const KINDS = Object.keys(KIND_CONFIG) as ResourceKind[]

function descendantIds(resourceId: string, resources: Resource[]) {
  const result = new Set<string>([resourceId])
  let changed = true

  while (changed) {
    changed = false
    for (const resource of resources) {
      if (
        resource.parentId &&
        result.has(resource.parentId) &&
        !result.has(resource.id)
      ) {
        result.add(resource.id)
        changed = true
      }
    }
  }

  return result
}

function KindSpecificFields({
  kind,
  resource,
  file,
  onFileChange,
  resources,
  bookmarkTargetType,
  bookmarkResourceId,
  bookmarkUrl,
  onBookmarkTargetTypeChange,
  onBookmarkResourceIdChange,
  onBookmarkUrlChange,
}: {
  kind: ResourceKind
  resource?: Resource
  file: File | null
  onFileChange: (file: File | null) => void
  resources: Resource[]
  bookmarkTargetType: "resource" | "url"
  bookmarkResourceId: string
  bookmarkUrl: string
  onBookmarkTargetTypeChange: (value: "resource" | "url") => void
  onBookmarkResourceIdChange: (value: string) => void
  onBookmarkUrlChange: (value: string) => void
}) {
  const config = KIND_CONFIG[kind]

  if (kind === "file") {
    return (
      <FieldGroup className="gap-0">
        <Field className={PROPERTY_ROW}>
          <FieldLabel htmlFor="resource-file" className={PROPERTY_LABEL}>
            <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
            File
          </FieldLabel>
          <div className={`${PROPERTY_CONTROL} space-y-2`}>
            <Input
              id="resource-file"
              type="file"
              className="h-10"
              onChange={(event) =>
                onFileChange(event.target.files?.[0] ?? null)
              }
            />
            <FieldDescription>
              {file
                ? `${file.name} · ${file.size.toLocaleString()} bytes`
                : resource?.file?.originalName
                  ? `Current file: ${resource.file.originalName}`
                  : "You can create the resource now and upload a file later."}
            </FieldDescription>
          </div>
        </Field>
      </FieldGroup>
    )
  }

  if (kind === "bookmark" && !resource) {
    return (
      <FieldGroup className="gap-0">
        <Field className={PROPERTY_ROW}>
          <FieldLabel className={PROPERTY_LABEL}>
            <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
            Target type
          </FieldLabel>
          <div className={PROPERTY_CONTROL}>
            <Select
              value={bookmarkTargetType}
              onValueChange={(value) =>
                onBookmarkTargetTypeChange(value as "resource" | "url")
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="url">External URL</SelectItem>
                <SelectItem value="resource">Workspace resource</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Field>

        {bookmarkTargetType === "resource" ? (
          <Field className={PROPERTY_ROW}>
            <FieldLabel className={PROPERTY_LABEL}>Resource</FieldLabel>
            <div className={`${PROPERTY_CONTROL} space-y-2`}>
              <Select
                value={bookmarkResourceId}
                onValueChange={(value) =>
                  onBookmarkResourceIdChange(String(value))
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Choose a resource" />
                </SelectTrigger>
                <SelectContent>
                  {[...resources]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item) => (
                      <SelectItem value={item.id} key={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {resources.length === 0 && (
                <FieldDescription>
                  Create another resource first, or use an external URL.
                </FieldDescription>
              )}
            </div>
          </Field>
        ) : (
          <Field className={PROPERTY_ROW}>
            <FieldLabel htmlFor="bookmark-url" className={PROPERTY_LABEL}>
              URL
            </FieldLabel>
            <div className={PROPERTY_CONTROL}>
              <Input
                id="bookmark-url"
                type="url"
                className="h-10"
                placeholder="https://example.com"
                value={bookmarkUrl}
                onChange={(event) => onBookmarkUrlChange(event.target.value)}
              />
            </div>
          </Field>
        )}
      </FieldGroup>
    )
  }

  const contentMessage = {
    folder:
      "Folders use the shared resource fields only. Child resources are managed from the folder view.",
    doc: "Document content is edited from the document view.",
    table: "Columns and rows are managed from the table view.",
    whiteboard:
      "The whiteboard opens as a blank canvas and saves automatically.",
    project: "Project status and tasks are managed from the project view.",
    bookmark: "The bookmark target is managed from the bookmark view.",
    agent: "Model, persona, and instructions are managed from the agent view.",
    "ai-chat": "Model or agent selection is managed from the chat composer.",
    file: "File uploads are managed above.",
  }[kind]

  return (
    <div className="border-t p-5">
      <Alert>
        <HugeiconsIcon icon={config.icon} strokeWidth={2} />
        <AlertTitle>{config.label} fields</AlertTitle>
        <AlertDescription>{contentMessage}</AlertDescription>
      </Alert>
    </div>
  )
}

export function ResourceFormSheet({
  workspaceId,
  resources,
  resource,
  defaultParentId = null,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  workspaceId: string
  resources: Resource[]
  resource?: Resource
  defaultParentId?: string | null
  trigger?: ReactElement | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCreated?: (resource: Resource) => void
  onUpdated?: (resource: Resource) => void
  onDeleted?: (resource: Resource) => void
}) {
  const isEditing = Boolean(resource)
  const [internalOpen, setInternalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(resource?.name ?? "Untitled")
  const [description, setDescription] = useState(resource?.description ?? "")
  const [icon, setIcon] = useState(resource?.icon ?? "")
  const [kind, setKind] = useState<ResourceKind>(resource?.kind ?? "folder")
  const [parentId, setParentId] = useState<string | null>(
    resource?.parentId ?? defaultParentId
  )
  const [file, setFile] = useState<File | null>(null)
  const [bookmarkTargetType, setBookmarkTargetType] = useState<
    "resource" | "url"
  >("url")
  const [bookmarkResourceId, setBookmarkResourceId] = useState("")
  const [bookmarkUrl, setBookmarkUrl] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unavailableFolderIds = useMemo(
    () =>
      resource ? descendantIds(resource.id, resources) : new Set<string>(),
    [resource, resources]
  )
  const folders = resources
    .filter(
      (item) => item.kind === "folder" && !unavailableFolderIds.has(item.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  function resetForm() {
    setName(resource?.name ?? "Untitled")
    setDescription(resource?.description ?? "")
    setIcon(resource?.icon ?? "")
    setKind(resource?.kind ?? "folder")
    setParentId(resource?.parentId ?? defaultParentId)
    setFile(null)
    setBookmarkTargetType("url")
    setBookmarkResourceId("")
    setBookmarkUrl("")
    setError(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) resetForm()
    if (controlledOpen === undefined) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  async function uploadFile(resourceId: string) {
    if (!file) return null
    const form = new FormData()
    form.append("file", file)
    return apiFetch<ResourceFileMeta>(`/resources/${resourceId}/upload`, {
      method: "POST",
      body: form,
    })
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Resource name is required")
      return
    }
    if (
      !resource &&
      kind === "bookmark" &&
      ((bookmarkTargetType === "resource" && !bookmarkResourceId) ||
        (bookmarkTargetType === "url" && !bookmarkUrl.trim()))
    ) {
      setError("Bookmark target is required")
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      let saved: Resource
      if (resource) {
        saved = await apiFetch<Resource>(`/resources/${resource.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmedName,
            parentId,
            description: description.trim() || null,
            icon: icon.trim() || null,
          }),
        })
        if (resource.kind === "file") {
          saved = { ...saved, file: resource.file }
        }
      } else {
        saved = await apiFetch<Resource>(
          `/workspaces/${workspaceId}/resources`,
          {
            method: "POST",
            body: JSON.stringify({
              name: trimmedName,
              kind,
              description: description.trim() || null,
              icon: icon.trim() || null,
              ...(parentId ? { parentId } : {}),
              ...(kind === "bookmark"
                ? {
                    bookmark:
                      bookmarkTargetType === "resource"
                        ? {
                            type: "resource",
                            resourceId: bookmarkResourceId,
                          }
                        : { type: "url", url: bookmarkUrl.trim() },
                  }
                : {}),
            }),
          }
        )
      }

      if (kind === "file" && file) {
        const fileMeta = await uploadFile(saved.id)
        saved = { ...saved, file: fileMeta }
      }

      if (resource) onUpdated?.(saved)
      else onCreated?.(saved)
      handleOpenChange(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save resource"
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteResource() {
    if (!resource) return

    setError(null)
    setIsDeleting(true)
    try {
      const deleted = await apiFetch<Resource>(`/resources/${resource.id}`, {
        method: "DELETE",
      })
      setDeleteOpen(false)
      handleOpenChange(false)
      onDeleted?.(deleted)
    } catch (deleteError) {
      setDeleteOpen(false)
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete resource"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const defaultTrigger = isEditing ? (
    <Button variant="outline">
      <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
      Edit resource
    </Button>
  ) : (
    <Button>
      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
      New resource
    </Button>
  )

  return (
    <Sheet
      open={controlledOpen ?? internalOpen}
      onOpenChange={handleOpenChange}
    >
      {trigger !== null && <SheetTrigger render={trigger ?? defaultTrigger} />}
      <SheetContent side="right" className="gap-0 sm:max-w-3xl">
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={save}>
          <SheetHeader className="border-b px-5 py-5 pr-14">
            <SheetTitle className="text-xl">
              {isEditing ? "Edit resource" : "New resource"}
            </SheetTitle>
            <SheetDescription>
              Shared resource settings and fields specific to its kind.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <FieldSet className="gap-0">
              <div className="p-5">
                <FieldLegend className="flex items-center gap-2">
                  <HugeiconsIcon icon={GridIcon} strokeWidth={2} />
                  Resource
                </FieldLegend>
                <FieldDescription>
                  Identity and location shared by every resource kind.
                </FieldDescription>
              </div>
              <FieldGroup className="gap-0 border-b">
                <Field className={PROPERTY_ROW}>
                  <FieldLabel className={PROPERTY_LABEL}>
                    <HugeiconsIcon icon={CubeIcon} strokeWidth={2} />
                    Type <span className="text-destructive">*</span>
                  </FieldLabel>
                  <div className={PROPERTY_CONTROL}>
                    <Select
                      value={kind}
                      disabled={isEditing}
                      onValueChange={(value) => setKind(value as ResourceKind)}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((value) => (
                          <SelectItem value={value} key={value}>
                            <HugeiconsIcon
                              icon={KIND_CONFIG[value].icon}
                              strokeWidth={2}
                            />
                            {KIND_CONFIG[value].plural}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Field>

                <Field className={PROPERTY_ROW}>
                  <FieldLabel
                    htmlFor="resource-form-name"
                    className={PROPERTY_LABEL}
                  >
                    <HugeiconsIcon icon={TextIcon} strokeWidth={2} />
                    Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <div className={PROPERTY_CONTROL}>
                    <Input
                      id="resource-form-name"
                      className="h-10"
                      value={name}
                      autoComplete="off"
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                </Field>

                <Field className={PROPERTY_ROW}>
                  <FieldLabel className={PROPERTY_LABEL}>
                    <HugeiconsIcon icon={SmileIcon} strokeWidth={2} />
                    Icon
                  </FieldLabel>
                  <div className={`${PROPERTY_CONTROL} space-y-2`}>
                    <ResourceIconPicker
                      kind={kind}
                      value={icon}
                      onValueChange={setIcon}
                    />
                    <FieldDescription>
                      Choose a Hugeicons glyph. The resource type icon is used
                      by default.
                    </FieldDescription>
                  </div>
                </Field>

                <Field className={PROPERTY_ROW}>
                  <FieldLabel
                    htmlFor="resource-form-description"
                    className={PROPERTY_LABEL}
                  >
                    <HugeiconsIcon icon={Note01Icon} strokeWidth={2} />
                    Description
                  </FieldLabel>
                  <div className={PROPERTY_CONTROL}>
                    <Textarea
                      id="resource-form-description"
                      value={description}
                      rows={5}
                      className="min-h-32 resize-y"
                      placeholder="What is this resource for?"
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                </Field>

                <Field className={PROPERTY_ROW}>
                  <FieldLabel className={PROPERTY_LABEL}>
                    <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                    Location
                  </FieldLabel>
                  <div className={PROPERTY_CONTROL}>
                    <Select
                      value={parentId ?? ROOT_LOCATION}
                      onValueChange={(value) =>
                        setParentId(
                          value === ROOT_LOCATION ? null : String(value)
                        )
                      }
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ROOT_LOCATION}>
                          <HugeiconsIcon icon={GridIcon} strokeWidth={2} />
                          Workspace root
                        </SelectItem>
                        {folders.map((folder) => (
                          <SelectItem value={folder.id} key={folder.id}>
                            <HugeiconsIcon
                              icon={Folder01Icon}
                              strokeWidth={2}
                            />
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet className="gap-0">
              <div className="p-5">
                <FieldLegend className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={KIND_CONFIG[kind].icon}
                    strokeWidth={2}
                  />
                  {KIND_CONFIG[kind].label} fields
                </FieldLegend>
                <FieldDescription>
                  {KIND_CONFIG[kind].description}
                </FieldDescription>
              </div>
              <KindSpecificFields
                kind={kind}
                resource={resource}
                file={file}
                onFileChange={setFile}
                resources={resources}
                bookmarkTargetType={bookmarkTargetType}
                bookmarkResourceId={bookmarkResourceId}
                bookmarkUrl={bookmarkUrl}
                onBookmarkTargetTypeChange={setBookmarkTargetType}
                onBookmarkResourceIdChange={setBookmarkResourceId}
                onBookmarkUrlChange={setBookmarkUrl}
              />
            </FieldSet>

            {error && <FieldError className="px-5 py-4">{error}</FieldError>}
          </div>

          <SheetFooter className="flex-row items-center border-t bg-muted/30 p-4">
            {resource && (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="destructive"
                      className="mr-auto"
                    >
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      Delete
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia>
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Delete {resource.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the resource permanently. Non-empty folders
                      must be emptied first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      type="button"
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={() => void deleteResource()}
                    >
                      {isDeleting ? "Deleting…" : "Delete resource"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
