import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useHotkeys } from "react-hotkeys-hook"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  Edit02Icon,
  Folder01Icon,
  FolderOpenIcon,
  FolderRootIcon,
  MoreHorizontalIcon,
  MoveToIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { cn } from "@workspace/ui/lib/utils"

import { PageHeader } from "@/components/page-header"
import type { Resource, ResourceKind, WorkspaceMember } from "@/lib/api"
import { RESOURCE_KIND_CONFIG, RESOURCE_KINDS } from "@/lib/resource-kind"
import { ResourceFormSheet } from "./resource-form-sheet"
import { ResourceKindIcon } from "./resource-kind-icon"

const ROOT = "resource-root"
const folderDrop = (id: string) => `resource-folder:${id}`

function idsBelow(resourceId: string, resources: Resource[]) {
  const ids = new Set([resourceId])
  let foundMore = true
  while (foundMore) {
    foundMore = false
    resources.forEach((resource) => {
      if (
        resource.parentId &&
        ids.has(resource.parentId) &&
        !ids.has(resource.id)
      ) {
        ids.add(resource.id)
        foundMore = true
      }
    })
  }
  return ids
}

function RootDrop({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT, disabled: !active })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground transition-colors",
        active && "border-primary/40",
        isOver && "border-primary bg-primary/10 text-primary"
      )}
    >
      <HugeiconsIcon
        icon={FolderRootIcon}
        strokeWidth={2}
        className="size-3.5"
      />
      {isOver ? "Move to workspace root" : children}
    </div>
  )
}

function ResourceMenu({
  resource,
  resources,
  members,
  workspaceId,
  move,
}: {
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
  workspaceId: string
  move: (resource: Resource, parentId: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const blocked = idsBelow(resource.id, resources)
  const folders = resources
    .filter((item) => item.kind === "folder" && !blocked.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${resource.name}`}
              className="relative z-20 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  to={`/workspace/${workspaceId}/resource/${resource.id}`}
                />
              }
            >
              <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
              Edit resource
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon icon={MoveToIcon} strokeWidth={2} />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-44">
              <DropdownMenuItem
                disabled={resource.parentId === null}
                onClick={() => move(resource, null)}
              >
                <HugeiconsIcon icon={FolderRootIcon} strokeWidth={2} />
                Workspace root
              </DropdownMenuItem>
              {folders.length > 0 && <DropdownMenuSeparator />}
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  disabled={resource.parentId === folder.id}
                  onClick={() => move(resource, folder.id)}
                >
                  <ResourceKindIcon kind="folder" icon={folder.icon} />
                  <span className="truncate">{folder.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResourceFormSheet
        workspaceId={workspaceId}
        resources={resources}
        members={members}
        resource={resource}
        trigger={null}
        open={editing}
        onOpenChange={setEditing}
      />
    </>
  )
}

function CardFace({
  resource,
  overlay = false,
}: {
  resource: Resource
  overlay?: boolean
}) {
  return (
    <Card
      className={cn(
        "gap-0 bg-secondary py-0 ring-0",
        overlay && "w-64 shadow-xl"
      )}
    >
      <CardHeader className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 px-3 py-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-background text-muted-foreground transition-colors group-hover:text-foreground">
          <ResourceKindIcon
            kind={resource.kind}
            icon={resource.icon}
            className="size-4"
          />
        </span>
        <CardTitle className="truncate pr-7 text-sm">{resource.name}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function ResourceCard({
  resource,
  resources,
  members,
  workspaceId,
  activeId,
  move,
}: {
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
  workspaceId: string
  activeId: string | null
  move: (resource: Resource, parentId: string | null) => void
}) {
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    transform,
    isDragging,
  } = useDraggable({ id: resource.id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folderDrop(resource.id),
    disabled: resource.kind !== "folder" || activeId === resource.id,
  })

  return (
    <div
      ref={setDropRef}
      className={cn(
        "group relative min-w-0 rounded-xl transition-all outline-none",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div
        ref={setDragRef}
        style={{ transform: CSS.Translate.toString(transform) }}
        {...attributes}
        {...listeners}
        className={cn(
          "relative touch-none rounded-xl transition-opacity select-none",
          isDragging ? "cursor-grabbing opacity-20" : "cursor-grab"
        )}
      >
        <CardFace resource={resource} />
        <Link
          to={`/workspace/${workspaceId}/resource/${resource.id}`}
          aria-label={`Open ${resource.name}`}
          className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="absolute top-2 right-2 z-20">
          <ResourceMenu
            resource={resource}
            resources={resources}
            members={members}
            workspaceId={workspaceId}
            move={move}
          />
        </div>
      </div>
      {isOver && (
        <div className="pointer-events-none absolute inset-x-3 bottom-2 z-30 rounded-md bg-primary px-2 py-1 text-center text-xs font-medium text-primary-foreground shadow-sm">
          Move into {resource.name}
        </div>
      )}
    </div>
  )
}

export function ResourcesView({
  resources,
  members,
  workspaceId,
  parentId = null,
}: {
  resources: Resource[]
  members: WorkspaceMember[]
  workspaceId: string
  parentId?: string | null
}) {
  const zero = useZero()
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<ResourceKind>("folder")
  const [createSession, setCreateSession] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } })
  )
  const visible = resources
    .filter((resource) => resource.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const active = resources.find((resource) => resource.id === activeId) ?? null

  useHotkeys(
    "ctrl+1,ctrl+2,ctrl+3,ctrl+4,ctrl+5,ctrl+6,ctrl+7,ctrl+8,ctrl+9",
    (event) => {
      if (!/^[1-9]$/.test(event.key)) return
      if (document.querySelector('[role="dialog"]')) return
      const resource = visible[Number(event.key) - 1]
      if (!resource) return
      event.preventDefault()
      navigate(`/workspace/${workspaceId}/resource/${resource.id}`)
    },
    {
      enabled: !createOpen && visible.length > 0,
      preventDefault: true,
    },
    [createOpen, navigate, visible, workspaceId]
  )

  function openCreator(kind: ResourceKind) {
    setCreateKind(kind)
    setCreateSession((current) => current + 1)
    setCreateOpen(true)
  }

  async function move(resource: Resource, nextParentId: string | null) {
    if (resource.parentId === nextParentId) return
    if (nextParentId && idsBelow(resource.id, resources).has(nextParentId)) {
      setError("A folder cannot be moved into itself or one of its children.")
      return
    }
    setError(null)
    try {
      const result = zero.mutate(
        mutators.resources.update({
          id: resource.id,
          parentId: nextParentId,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error")
        throw new Error(serverResult.error.message)
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Could not move resource"
      )
    }
  }

  function dragEnd(event: DragEndEvent) {
    setActiveId(null)
    if (!event.over) return
    const resource = resources.find(
      (item) => item.id === String(event.active.id)
    )
    if (!resource) return
    const target = String(event.over.id)
    if (target === ROOT) void move(resource, null)
    if (target.startsWith("resource-folder:")) {
      void move(resource, target.slice("resource-folder:".length))
    }
  }

  const createActions = (
    <ButtonGroup>
      <Button type="button" onClick={() => openCreator("folder")}>
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
        New resource
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon"
              className="relative before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-primary-foreground/20"
              aria-label="Choose resource type"
            />
          }
        >
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {RESOURCE_KINDS.map((kind) => (
            <DropdownMenuItem key={kind} onClick={() => openCreator(kind)}>
              <ResourceKindIcon kind={kind} className="size-4" />
              {RESOURCE_KIND_CONFIG[kind].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event: DragStartEvent) => {
        setError(null)
        setActiveId(String(event.active.id))
      }}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={dragEnd}
    >
      <section className="space-y-6" aria-labelledby="resources-heading">
        {parentId ? (
          <div className="flex items-center justify-between gap-3">
            <h2 id="resources-heading" className="text-lg font-semibold">
              Contents
            </h2>
            {createActions}
          </div>
        ) : (
          <PageHeader
            icon={<HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />}
            title={<span id="resources-heading">Resources</span>}
            actions={createActions}
          />
        )}

        {parentId && activeId && <RootDrop active>Workspace root</RootDrop>}

        {error && (
          <p
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        {visible.length === 0 ? (
          <Empty className="min-h-64 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon
                  icon={parentId ? FolderOpenIcon : Folder01Icon}
                  strokeWidth={2}
                />
              </EmptyMedia>
              <EmptyTitle>
                {parentId ? "This folder is empty" : "No resources yet"}
              </EmptyTitle>
              <EmptyDescription>
                {parentId
                  ? "Create a resource here, or move one into this folder."
                  : "Create the first resource to start organizing your workspace."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visible.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                resources={resources}
                members={members}
                workspaceId={workspaceId}
                activeId={activeId}
                move={move}
              />
            ))}
          </div>
        )}

        <ResourceFormSheet
          key={`${parentId ?? "root"}:${createKind}:${createSession}`}
          workspaceId={workspaceId}
          resources={resources}
          members={members}
          defaultParentId={parentId}
          defaultKind={createKind}
          trigger={null}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(resource) =>
            navigate(`/workspace/${workspaceId}/resource/${resource.id}`)
          }
        />
      </section>

      <DragOverlay dropAnimation={null}>
        {active ? <CardFace resource={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
