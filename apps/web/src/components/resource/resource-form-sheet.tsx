import { useMemo, useState, type ReactElement } from "react"
import {
  Add01Icon,
  CubeIcon,
  Delete02Icon,
  Edit02Icon,
  Folder01Icon,
  GridIcon,
  Link01Icon,
  Note01Icon,
  SmileIcon,
  TextIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useHotkeys } from "react-hotkeys-hook"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
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
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Kbd } from "@workspace/ui/components/kbd"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import {
  apiFetch,
  type Resource,
  type ResourceFileMeta,
  type ResourceKind,
  type WorkspaceMember,
} from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import {
  RESOURCE_KIND_CONFIG,
  RESOURCE_KINDS,
} from "@/lib/resource-kind"
import { ResourceIconPicker } from "./resource-icon-picker"
import { ResourcePicker } from "./resource-picker"

const PROPERTY_ROW = "gap-0 border-t sm:grid sm:grid-cols-[13rem_minmax(0,1fr)]"
const PROPERTY_LABEL = "w-full sm:h-full sm:border-r p-3"
const PROPERTY_CONTROL = "min-w-0 p-3"

function FieldShortcutHint({ index }: { index: number | null }) {
  if (index == null || index < 1 || index > 9) return null
  return <Kbd className="ml-auto shrink-0 bg-muted/70 text-[10px]">{index}</Kbd>
}

const KINDS = RESOURCE_KINDS

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
  members,
  currentUserId,
  selectedChatMemberIds,
  onChatMemberToggle,
  shortcutFor,
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
  members: WorkspaceMember[]
  currentUserId?: string
  selectedChatMemberIds: string[]
  onChatMemberToggle: (userId: string, selected: boolean) => void
  shortcutFor: (fieldId: string) => number | null
}) {
  if (kind === "file") {
    return (
      <FieldGroup className="gap-0">
        <Field className={PROPERTY_ROW}>
          <FieldLabel
            htmlFor="resource-file"
            className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
          >
            <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
            File
            <FieldShortcutHint index={shortcutFor("resource-file")} />
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
          <FieldLabel
            className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
          >
            <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
            Target type
            <FieldShortcutHint index={shortcutFor("bookmark-target-type")} />
          </FieldLabel>
          <div className={PROPERTY_CONTROL}>
            <Select
              value={bookmarkTargetType}
              onValueChange={(value) =>
                onBookmarkTargetTypeChange(value as "resource" | "url")
              }
            >
              <SelectTrigger id="bookmark-target-type" className="h-10 w-full">
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
            <FieldLabel
              className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
            >
              Resource
              <FieldShortcutHint index={shortcutFor("bookmark-resource")} />
            </FieldLabel>
            <div className={`${PROPERTY_CONTROL} space-y-2`}>
              <Select
                value={bookmarkResourceId}
                onValueChange={(value) =>
                  onBookmarkResourceIdChange(String(value))
                }
              >
                <SelectTrigger id="bookmark-resource" className="h-10 w-full">
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
            <FieldLabel
              htmlFor="bookmark-url"
              className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
            >
              URL
              <FieldShortcutHint index={shortcutFor("bookmark-url")} />
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

  if (kind === "chat") {
    const requiredUserIds = new Set(
      [resource?.createdBy, currentUserId].filter((userId): userId is string =>
        Boolean(userId)
      )
    )

    return (
      <FieldGroup className="gap-0">
        <Field className={PROPERTY_ROW}>
          <FieldLabel
            className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
          >
            <HugeiconsIcon
              icon={RESOURCE_KIND_CONFIG.chat.icon}
              strokeWidth={2}
            />
            Members <span className="text-destructive">*</span>
            <FieldShortcutHint
              index={shortcutFor("resource-form-chat-members")}
            />
          </FieldLabel>
          <div className={`${PROPERTY_CONTROL} space-y-3`}>
            <div
              id="resource-form-chat-members"
              tabIndex={-1}
              className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {[...members]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((member) => {
                  const checked = selectedChatMemberIds.includes(member.userId)
                  const required = requiredUserIds.has(member.userId)
                  return (
                    <label
                      key={member.userId}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={required}
                        onCheckedChange={(nextChecked) =>
                          onChatMemberToggle(member.userId, nextChecked)
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {member.name}
                          {required ? " (required)" : ""}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </span>
                    </label>
                  )
                })}
            </div>
            <FieldDescription>
              The creator is included automatically. Select at least one other
              workspace member; only channel members can see or open it.
            </FieldDescription>
          </div>
        </Field>
      </FieldGroup>
    )
  }

  return null
}

export function ResourceFormSheet({
  workspaceId,
  resources,
  members,
  resource,
  defaultParentId = null,
  defaultKind = "folder",
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  workspaceId: string
  resources: Resource[]
  members: WorkspaceMember[]
  resource?: Resource
  defaultParentId?: string | null
  defaultKind?: ResourceKind
  trigger?: ReactElement | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCreated?: (resource: Resource) => void
  onUpdated?: (resource: Resource) => void
  onDeleted?: (resource: Resource) => void
}) {
  const zero = useZero()
  const { data: session } = authClient.useSession()
  const isEditing = Boolean(resource)
  const [channel] = useQuery(
    queries.humanChats.byID({ id: resource?.id ?? "__new_channel__" }),
    { enabled: resource?.kind === "chat" }
  )
  const [internalOpen, setInternalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(resource?.name ?? "Untitled")
  const [description, setDescription] = useState(resource?.description ?? "")
  const [icon, setIcon] = useState(resource?.icon ?? "")
  const [kind, setKind] = useState<ResourceKind>(resource?.kind ?? defaultKind)
  const [parentId, setParentId] = useState<string | null>(
    resource?.parentId ?? defaultParentId
  )
  const [file, setFile] = useState<File | null>(null)
  const [bookmarkTargetType, setBookmarkTargetType] = useState<
    "resource" | "url"
  >("url")
  const [bookmarkResourceId, setBookmarkResourceId] = useState("")
  const [bookmarkUrl, setBookmarkUrl] = useState("")
  const [channelMemberSelection, setChannelMemberSelection] = useState<
    string[] | null
  >(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unavailableFolderIds = useMemo(
    () =>
      resource ? descendantIds(resource.id, resources) : new Set<string>(),
    [resource, resources]
  )
  const selectedChatMemberIds =
    channelMemberSelection ??
    (resource?.kind === "chat" && channel?.type === "channel"
      ? channel.participants.map((participant) => participant.userId)
      : session?.user.id
        ? [session.user.id]
        : [])
  const isThread = resource?.kind === "chat" && channel?.type === "thread"
  const isChannel =
    kind === "chat" && (!resource || channel?.type === "channel")
  const hasKindSpecificFields =
    kind === "file" || isChannel || (kind === "bookmark" && !resource)
  const sheetOpen = controlledOpen ?? internalOpen

  const shortcutFields = useMemo(() => {
    const fields: string[] = []
    if (!isEditing) fields.push("resource-form-kind")
    fields.push(
      "resource-form-name",
      "resource-form-icon",
      "resource-form-description"
    )
    if (!isThread) fields.push("resource-form-location")
    if (kind === "file") fields.push("resource-file")
    if (kind === "bookmark" && !resource) {
      fields.push("bookmark-target-type")
      fields.push(
        bookmarkTargetType === "resource" ? "bookmark-resource" : "bookmark-url"
      )
    }
    if (isChannel) fields.push("resource-form-chat-members")
    return fields.slice(0, 9)
  }, [
    bookmarkTargetType,
    isChannel,
    isEditing,
    isThread,
    kind,
    resource,
  ])

  function shortcutFor(fieldId: string) {
    const index = shortcutFields.indexOf(fieldId)
    return index >= 0 ? index + 1 : null
  }

  useHotkeys(
    "ctrl+1,ctrl+2,ctrl+3,ctrl+4,ctrl+5,ctrl+6,ctrl+7,ctrl+8,ctrl+9",
    (event) => {
      if (!/^[1-9]$/.test(event.key)) return
      const fieldId = shortcutFields[Number(event.key) - 1]
      if (!fieldId) return
      const target = document.getElementById(fieldId)
      if (!target) return
      event.preventDefault()
      target.focus()
      target.scrollIntoView({ block: "nearest", behavior: "smooth" })
    },
    {
      enabled: sheetOpen,
      enableOnFormTags: true,
      preventDefault: true,
    },
    [sheetOpen, shortcutFields]
  )

  function resetForm() {
    setName(resource?.name ?? "Untitled")
    setDescription(resource?.description ?? "")
    setIcon(resource?.icon ?? "")
    setKind(resource?.kind ?? defaultKind)
    setParentId(resource?.parentId ?? defaultParentId)
    setFile(null)
    setBookmarkTargetType("url")
    setBookmarkResourceId("")
    setBookmarkUrl("")
    setChannelMemberSelection(null)
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
    if (isChannel && selectedChatMemberIds.length < 2) {
      setError("Select at least one channel member")
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      let saved: Resource
      if (resource) {
        const now = Date.now()
        if (isChannel) {
          const participantResult = zero.mutate(
            mutators.humanChats.updateChannelParticipants({
              id: resource.id,
              participants: selectedChatMemberIds.map((userId) => ({
                id:
                  channel?.participants.find(
                    (participant) => participant.userId === userId
                  )?.id ?? crypto.randomUUID(),
                userId,
              })),
              now,
            })
          )
          const participantServerResult = await participantResult.server
          if (participantServerResult.type === "error") {
            throw new Error(participantServerResult.error.message)
          }
        }
        const result = zero.mutate(
          mutators.resources.update({
            id: resource.id,
            name: trimmedName,
            parentId: isThread ? null : parentId,
            description: description.trim() || null,
            icon: icon.trim() || null,
            now,
          })
        )
        const serverResult = await result.server
        if (serverResult.type === "error") {
          throw new Error(serverResult.error.message)
        }
        saved = {
          ...resource,
          name: trimmedName,
          parentId: isThread ? null : parentId,
          description: description.trim() || null,
          icon: icon.trim() || null,
          updatedAt: now,
        }
      } else {
        const id = crypto.randomUUID()
        const now = Date.now()
        const bookmark =
          kind === "bookmark"
            ? bookmarkTargetType === "resource"
              ? ({
                  type: "resource" as const,
                  resourceId: bookmarkResourceId,
                } as const)
              : ({ type: "url" as const, url: bookmarkUrl.trim() } as const)
            : null
        const result = zero.mutate(
          mutators.resources.create({
            id,
            workspaceId,
            parentId,
            kind,
            name: trimmedName,
            description: description.trim() || null,
            icon: icon.trim() || null,
            bookmark,
            channelParticipants:
              kind === "chat"
                ? selectedChatMemberIds.map((userId) => ({
                    id: crypto.randomUUID(),
                    userId,
                  }))
                : null,
            now,
          })
        )
        const serverResult = await result.server
        if (serverResult.type === "error") {
          throw new Error(serverResult.error.message)
        }
        saved = {
          id,
          workspaceId,
          parentId,
          kind,
          name: trimmedName,
          description: description.trim() || null,
          icon: icon.trim() || null,
          createdBy: "",
          createdAt: now,
          updatedAt: now,
          ...(kind === "file" ? { file: null } : {}),
        }
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
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:sm:max-w-3xl [&_svg]:size-4"
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={save}>
          <SheetHeader className="border-b p-3 pr-14">
            <SheetTitle className="text-xl">
              {isEditing ? "Edit resource" : "New resource"}
            </SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <FieldSet className="gap-0">
              <div className="p-3">
                <FieldLegend className="flex items-center gap-2">
                  <HugeiconsIcon icon={GridIcon} strokeWidth={2} />
                  Resource
                </FieldLegend>
              </div>
              <FieldGroup className="gap-0 border-b">
                <Field className={PROPERTY_ROW}>
                  <FieldLabel
                    className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
                  >
                    <HugeiconsIcon icon={CubeIcon} strokeWidth={2} />
                    Type <span className="text-destructive">*</span>
                    <FieldShortcutHint
                      index={shortcutFor("resource-form-kind")}
                    />
                  </FieldLabel>
                  <div className={PROPERTY_CONTROL}>
                    <Select
                      value={kind}
                      disabled={isEditing}
                      onValueChange={(value) => setKind(value as ResourceKind)}
                    >
                      <SelectTrigger
                        id="resource-form-kind"
                        className="h-10 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((value) => (
                          <SelectItem value={value} key={value}>
                            <HugeiconsIcon
                              icon={RESOURCE_KIND_CONFIG[value].icon}
                              strokeWidth={2}
                            />
                            {RESOURCE_KIND_CONFIG[value].plural}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Field>

                <Field className={PROPERTY_ROW}>
                  <FieldLabel
                    htmlFor="resource-form-name"
                    className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
                  >
                    <HugeiconsIcon icon={TextIcon} strokeWidth={2} />
                    Name <span className="text-destructive">*</span>
                    <FieldShortcutHint
                      index={shortcutFor("resource-form-name")}
                    />
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
                  <FieldLabel
                    className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
                  >
                    <HugeiconsIcon icon={SmileIcon} strokeWidth={2} />
                    Icon
                    <FieldShortcutHint
                      index={shortcutFor("resource-form-icon")}
                    />
                  </FieldLabel>
                  <div className={`${PROPERTY_CONTROL} space-y-2`}>
                    <ResourceIconPicker
                      id="resource-form-icon"
                      kind={kind}
                      value={icon}
                      onValueChange={setIcon}
                    />
                  </div>
                </Field>

                <Field className={PROPERTY_ROW}>
                  <FieldLabel
                    htmlFor="resource-form-description"
                    className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
                  >
                    <HugeiconsIcon icon={Note01Icon} strokeWidth={2} />
                    Description
                    <FieldShortcutHint
                      index={shortcutFor("resource-form-description")}
                    />
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

                {!isThread && (
                  <Field className={PROPERTY_ROW}>
                    <FieldLabel
                      className={cn(PROPERTY_LABEL, "flex items-center gap-2")}
                    >
                      <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                      Location
                      <FieldShortcutHint
                        index={shortcutFor("resource-form-location")}
                      />
                    </FieldLabel>
                    <div className={PROPERTY_CONTROL}>
                      <ResourcePicker
                        id="resource-form-location"
                        resources={resources}
                        value={parentId}
                        onValueChange={setParentId}
                        allowedKinds={["folder"]}
                        includeWorkspaceRoot
                        excludeIds={unavailableFolderIds}
                        placeholder="Choose a location"
                        searchPlaceholder="Search folders…"
                      />
                    </div>
                  </Field>
                )}
              </FieldGroup>
            </FieldSet>

            {hasKindSpecificFields && (
              <FieldSet className="gap-0">
                <div className="p-5">
                  <FieldLegend className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={RESOURCE_KIND_CONFIG[kind].icon}
                      strokeWidth={2}
                    />
                    {RESOURCE_KIND_CONFIG[kind].label} fields
                  </FieldLegend>
                  <FieldDescription>
                    {RESOURCE_KIND_CONFIG[kind].description}
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
                  members={members}
                  currentUserId={session?.user.id}
                  selectedChatMemberIds={selectedChatMemberIds}
                  shortcutFor={shortcutFor}
                  onChatMemberToggle={(userId, selected) =>
                    setChannelMemberSelection(
                      selected
                        ? selectedChatMemberIds.includes(userId)
                          ? selectedChatMemberIds
                          : [...selectedChatMemberIds, userId]
                        : selectedChatMemberIds.filter((id) => id !== userId)
                    )
                  }
                />
              </FieldSet>
            )}

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
