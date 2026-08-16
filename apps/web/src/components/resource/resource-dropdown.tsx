import { forwardRef, useState, type ComponentProps, type ReactElement } from "react"
import {
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  Delete02Icon,
  Edit02Icon,
  Folder01Icon,
  FolderRootIcon,
  MoreHorizontalIcon,
  SmileIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
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
} from "@workspace/ui/components/alert-dialog"
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
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import { Link } from "react-router-dom"

import { apiFetch, type Resource, type WorkspaceMember } from "@/lib/api"
import { RESOURCE_ICON_OPTIONS } from "@/lib/resource-icons"
import { ResourceFormSheet } from "./resource-form-sheet"
import { ResourceKindIcon } from "./resource-kind-icon"

function idsBelow(resourceId: string, resources: Resource[]) {
  const ids = new Set([resourceId])
  let foundMore = true
  while (foundMore) {
    foundMore = false
    for (const resource of resources) {
      if (
        resource.parentId &&
        ids.has(resource.parentId) &&
        !ids.has(resource.id)
      ) {
        ids.add(resource.id)
        foundMore = true
      }
    }
  }
  return ids
}

export function ResourceDropdown({
  resource,
  resources,
  members,
  workspaceId,
  trigger,
  align = "start",
  side = "bottom",
  onUpdated,
  onDeleted,
}: {
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
  workspaceId: string
  trigger?: ReactElement
  align?: "start" | "end"
  side?: "top" | "bottom" | "left" | "right"
  onUpdated?: (resource: Resource) => void
  onDeleted?: (resource: Resource) => void
}) {
  const zero = useZero()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocked = idsBelow(resource.id, resources)
  const folders = resources
    .filter((item) => item.kind === "folder" && !blocked.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const currentIcon = resource.icon ?? ""

  async function patchResource(patch: {
    icon?: string | null
    parentId?: string | null
  }) {
    setError(null)
    try {
      const result = zero.mutate(
        mutators.resources.update({
          id: resource.id,
          ...patch,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      onUpdated?.({
        ...resource,
        icon: patch.icon !== undefined ? patch.icon : resource.icon,
        parentId:
          patch.parentId !== undefined ? patch.parentId : resource.parentId,
      })
    } catch (patchError) {
      setError(
        patchError instanceof Error
          ? patchError.message
          : "Could not update resource"
      )
    }
  }

  async function deleteResource() {
    setError(null)
    setIsDeleting(true)
    try {
      const deleted = await apiFetch<Resource>(`/resources/${resource.id}`, {
        method: "DELETE",
      })
      setDeleteOpen(false)
      onDeleted?.(deleted)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete resource"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const defaultTrigger = (
    <button
      type="button"
      className="flex max-w-52 min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
      aria-current="page"
    />
  )

  return (
    <>
      <DropdownMenu>
        {trigger ? (
          <DropdownMenuTrigger render={trigger} />
        ) : (
          <DropdownMenuTrigger render={defaultTrigger}>
            <ResourceKindIcon
              kind={resource.kind}
              icon={resource.icon}
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="truncate">{resource.name}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="size-3.5 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent align={align} side={side} className="min-w-48">
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
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
              Edit resource
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <HugeiconsIcon icon={SmileIcon} strokeWidth={2} />
                Change icon
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-0">
                <DropdownMenuItem
                  className="rounded-none border-b"
                  onClick={() => void patchResource({ icon: null })}
                >
                  <span className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <ResourceKindIcon kind={resource.kind} />
                  </span>
                  <span className="flex-1">Default type icon</span>
                  {!currentIcon && (
                    <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
                  )}
                </DropdownMenuItem>
                <ScrollArea className="h-56">
                  <div className="grid grid-cols-6 gap-1 p-2">
                    {RESOURCE_ICON_OPTIONS.map((option) => {
                      const selected = currentIcon === option.name
                      return (
                        <DropdownMenuItem
                          key={option.name}
                          title={option.label}
                          aria-label={option.label}
                          className={cn(
                            "flex aspect-square size-auto items-center justify-center p-0",
                            selected &&
                              "border border-primary/30 bg-primary/10 text-primary"
                          )}
                          onClick={() =>
                            void patchResource({ icon: option.name })
                          }
                        >
                          <HugeiconsIcon
                            icon={option.icon}
                            className="size-5"
                            strokeWidth={1.8}
                          />
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
                </ScrollArea>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                Location
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-44">
                <DropdownMenuItem
                  disabled={resource.parentId === null}
                  onClick={() => void patchResource({ parentId: null })}
                >
                  <HugeiconsIcon icon={FolderRootIcon} strokeWidth={2} />
                  Workspace root
                </DropdownMenuItem>
                {folders.length > 0 && <DropdownMenuSeparator />}
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    disabled={resource.parentId === folder.id}
                    onClick={() => void patchResource({ parentId: folder.id })}
                  >
                    <ResourceKindIcon kind="folder" icon={folder.icon} />
                    <span className="truncate">{folder.name}</span>
                    {resource.parentId === folder.id && (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className="ml-auto"
                        strokeWidth={2}
                      />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            Delete
          </DropdownMenuItem>
          {error && (
            <p className="px-1.5 py-1 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResourceFormSheet
        workspaceId={workspaceId}
        resources={resources}
        members={members}
        resource={resource}
        trigger={null}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete {resource.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the resource permanently. Non-empty folders must be
              emptied first.
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
    </>
  )
}

export const ResourceDropdownSidebarTrigger = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & {
    resourceName: string
  }
>(function ResourceDropdownSidebarTrigger(
  { resourceName, className, onClick, onPointerDown, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Actions for ${resourceName}`}
      title={`Actions for ${resourceName}`}
      {...props}
      className={cn(
        "absolute top-1 right-1 z-10 flex aspect-square size-6 items-center justify-center rounded-md p-0 text-sidebar-foreground opacity-0 outline-none transition-opacity group-focus-within/menu-sub-item:opacity-100 group-hover/menu-sub-item:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring data-popup-open:opacity-100 [&_svg]:size-3.5",
        className
      )}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onPointerDown?.(event)
      }}
    >
      <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
    </button>
  )
})
