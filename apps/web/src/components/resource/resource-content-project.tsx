import { useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Add01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
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
import { cn } from "@workspace/ui/lib/utils"

import {
  apiFetch,
  type ProjectContent,
  type ProjectDetails,
  type ProjectStatus,
  type ProjectTask,
  type ProjectTaskStatus,
  type Resource,
} from "@/lib/api"

const TASK_COLUMNS: Array<{
  status: ProjectTaskStatus
  label: string
}> = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
]

const EMPTY_TASK_INPUTS: Record<ProjectTaskStatus, string> = {
  todo: "",
  in_progress: "",
  done: "",
}

function isTaskStatus(value: string): value is ProjectTaskStatus {
  return TASK_COLUMNS.some((column) => column.status === value)
}

function normalizePositions(tasks: ProjectTask[]) {
  const positionByStatus: Record<ProjectTaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    done: 0,
  }

  return tasks.map((task) => ({
    ...task,
    position: positionByStatus[task.status]++,
  }))
}

function SortableTaskCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: ProjectTask
  onUpdate: (taskId: string, title: string) => void
  onDelete: (taskId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border bg-background p-3 shadow-xs",
        isDragging && "opacity-35"
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="-ml-1 inline-flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
          aria-label={`Drag ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
        </button>
        <Input
          key={`${task.id}:${task.title}`}
          defaultValue={task.title}
          aria-label={`Task title: ${task.title}`}
          className="h-8 min-w-0 flex-1 border-0 px-1 font-medium shadow-none focus-visible:ring-2"
          onBlur={(event) => {
            const title = event.target.value.trim()
            if (title && title !== task.title) {
              onUpdate(task.id, title)
            } else {
              event.target.value = task.title
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          aria-label={`Delete ${task.title}`}
          onClick={() => onDelete(task.id)}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </div>
      {task.description && (
        <p className="mt-2 line-clamp-3 pl-7 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}
    </div>
  )
}

function TaskColumn({
  status,
  label,
  tasks,
  newTask,
  isCreating,
  onNewTaskChange,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: {
  status: ProjectTaskStatus
  label: string
  tasks: ProjectTask[]
  newTask: string
  isCreating: boolean
  onNewTaskChange: (value: string) => void
  onCreateTask: (event: React.FormEvent<HTMLFormElement>) => void
  onUpdateTask: (taskId: string, title: string) => void
  onDeleteTask: (taskId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "min-h-0 gap-0 overflow-hidden py-0 transition-colors",
        isOver && "ring-2 ring-primary/40"
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between border-b py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Task01Icon} strokeWidth={2} />
          <CardTitle>{label}</CardTitle>
        </div>
        <Badge variant="outline">{tasks.length}</Badge>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-3">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="min-h-full space-y-3">
            {tasks.length === 0 ? (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                Drop a task here
              </p>
            ) : (
              tasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  onUpdate={onUpdateTask}
                  onDelete={onDeleteTask}
                />
              ))
            )}
          </div>
        </SortableContext>
      </CardContent>

      <CardFooter className="shrink-0 bg-background p-3">
        <form className="flex w-full gap-2" onSubmit={onCreateTask}>
          <Input
            value={newTask}
            className="min-w-0"
            placeholder="Add a task"
            aria-label={`New ${label} task title`}
            onChange={(event) => onNewTaskChange(event.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            disabled={isCreating || !newTask.trim()}
            aria-label={`Add task to ${label}`}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}

export function ResourceContentProject({ resource }: { resource: Resource }) {
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [newTasks, setNewTasks] =
    useState<Record<ProjectTaskStatus, string>>(EMPTY_TASK_INPUTS)
  const [creatingStatus, setCreatingStatus] =
    useState<ProjectTaskStatus | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragStartTasks = useRef<ProjectTask[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const content = await apiFetch<ProjectContent>(
          `/resources/${resource.id}/project`,
          { signal: controller.signal }
        )
        setProject(content.project)
        setTasks(normalizePositions(content.tasks))
        setError(null)
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load project"
        )
      }
    }

    void load()
    return () => controller.abort()
  }, [resource.id])

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === "done").length,
    [tasks]
  )
  const activeTask = activeTaskId
    ? tasks.find((task) => task.id === activeTaskId)
    : null

  async function updateProject(status: ProjectStatus) {
    if (!project) return
    setIsSavingProject(true)
    setError(null)
    try {
      const updated = await apiFetch<ProjectDetails>(
        `/resources/${resource.id}/project`,
        { method: "PATCH", body: JSON.stringify({ status }) }
      )
      setProject(updated)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save project"
      )
    } finally {
      setIsSavingProject(false)
    }
  }

  async function createTask(
    event: React.FormEvent<HTMLFormElement>,
    status: ProjectTaskStatus
  ) {
    event.preventDefault()
    const title = newTasks[status].trim()
    if (!title) return

    setCreatingStatus(status)
    setError(null)
    try {
      const task = await apiFetch<ProjectTask>(
        `/resources/${resource.id}/tasks`,
        { method: "POST", body: JSON.stringify({ title, status }) }
      )
      setTasks((current) => normalizePositions([...current, task]))
      setNewTasks((current) => ({ ...current, [status]: "" }))
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create task"
      )
    } finally {
      setCreatingStatus(null)
    }
  }

  async function updateTaskTitle(taskId: string, title: string) {
    setError(null)
    try {
      const updated = await apiFetch<ProjectTask>(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      })
      setTasks((current) =>
        current.map((task) => (task.id === updated.id ? updated : task))
      )
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update task"
      )
    }
  }

  async function deleteTask(taskId: string) {
    setError(null)
    try {
      await apiFetch<ProjectTask>(`/tasks/${taskId}`, { method: "DELETE" })
      setTasks((current) =>
        normalizePositions(current.filter((task) => task.id !== taskId))
      )
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete task"
      )
    }
  }

  function statusForDropTarget(id: string, currentTasks: ProjectTask[]) {
    if (isTaskStatus(id)) return id
    return currentTasks.find((task) => task.id === id)?.status ?? null
  }

  function handleDragStart(event: DragStartEvent) {
    dragStartTasks.current = tasks
    setActiveTaskId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    if (!event.over) return
    const activeId = String(event.active.id)
    const overId = String(event.over.id)

    setTasks((current) => {
      const activeIndex = current.findIndex((task) => task.id === activeId)
      if (activeIndex < 0) return current
      const active = current[activeIndex]!
      const targetStatus = statusForDropTarget(overId, current)
      if (!targetStatus || active.status === targetStatus) return current

      const withoutActive = current.filter((task) => task.id !== activeId)
      const overIndex = withoutActive.findIndex((task) => task.id === overId)
      const moved = { ...active, status: targetStatus }

      if (overIndex < 0) return normalizePositions([...withoutActive, moved])
      const next = [...withoutActive]
      next.splice(overIndex, 0, moved)
      return normalizePositions(next)
    })
  }

  async function persistTaskOrder(
    nextTasks: ProjectTask[],
    previousTasks: ProjectTask[]
  ) {
    const previousById = new Map(previousTasks.map((task) => [task.id, task]))
    const changed = nextTasks.filter((task) => {
      const previous = previousById.get(task.id)
      return (
        !previous ||
        previous.status !== task.status ||
        previous.position !== task.position
      )
    })

    try {
      await Promise.all(
        changed.map((task) =>
          apiFetch<ProjectTask>(`/tasks/${task.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              status: task.status,
              position: task.position,
            }),
          })
        )
      )
    } catch (updateError) {
      setTasks(previousTasks)
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not move task"
      )
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const previousTasks = dragStartTasks.current ?? tasks
    dragStartTasks.current = null
    setActiveTaskId(null)
    if (!event.over) {
      setTasks(previousTasks)
      return
    }

    const activeId = String(event.active.id)
    const overId = String(event.over.id)
    let nextTasks = tasks
    let active = nextTasks.find((task) => task.id === activeId)
    const over = nextTasks.find((task) => task.id === overId)
    const originalStatus = previousTasks.find(
      (task) => task.id === activeId
    )?.status
    const targetStatus = statusForDropTarget(overId, nextTasks)

    if (active && targetStatus && active.status !== targetStatus) {
      const withoutActive = nextTasks.filter((task) => task.id !== activeId)
      const overIndex = withoutActive.findIndex((task) => task.id === overId)
      active = { ...active, status: targetStatus }
      if (overIndex < 0) {
        nextTasks = [...withoutActive, active]
      } else {
        nextTasks = [...withoutActive]
        nextTasks.splice(overIndex, 0, active)
      }
    }

    if (
      active &&
      over &&
      active.status === over.status &&
      originalStatus === active.status
    ) {
      const columnTasks = nextTasks.filter(
        (task) => task.status === active.status
      )
      const oldIndex = columnTasks.findIndex((task) => task.id === activeId)
      const newIndex = columnTasks.findIndex((task) => task.id === overId)
      if (oldIndex !== newIndex) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex)
        let index = 0
        nextTasks = nextTasks.map((task) =>
          task.status === active.status ? reordered[index++]! : task
        )
      }
    }

    nextTasks = normalizePositions(nextTasks)
    setTasks(nextTasks)
    void persistTaskOrder(nextTasks, previousTasks)
  }

  function handleDragCancel() {
    if (dragStartTasks.current) setTasks(dragStartTasks.current)
    dragStartTasks.current = null
    setActiveTaskId(null)
  }

  if (!project && !error) {
    return (
      <div className="flex h-[calc(100svh-5.5rem)] flex-col gap-4 sm:h-[calc(100svh-6.5rem)] lg:h-[calc(100svh-7.5rem)]">
        <Skeleton className="h-14 w-full shrink-0" />
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
          {TASK_COLUMNS.map((column) => (
            <Skeleton key={column.status} className="h-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-[28rem] flex-col gap-4 sm:h-[calc(100svh-6.5rem)] lg:h-[calc(100svh-7.5rem)]">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-sm text-muted-foreground">Project</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {resource.icon && <span className="mr-2">{resource.icon}</span>}
            {resource.name}
          </h1>
          {resource.description && (
            <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
              {resource.description}
            </p>
          )}
        </div>
        {project && (
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">
              {completedCount} / {tasks.length} completed
            </Badge>
            <Select
              value={project.status}
              disabled={isSavingProject}
              onValueChange={(value) =>
                void updateProject(value as ProjectStatus)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && (
        <p className="shrink-0 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid min-h-0 flex-1 grid-flow-col auto-cols-[minmax(17rem,1fr)] gap-4 overflow-x-auto pb-1 lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto lg:overflow-x-visible">
          {TASK_COLUMNS.map((column) => {
            const columnTasks = tasks.filter(
              (task) => task.status === column.status
            )
            return (
              <TaskColumn
                key={column.status}
                status={column.status}
                label={column.label}
                tasks={columnTasks}
                newTask={newTasks[column.status]}
                isCreating={creatingStatus === column.status}
                onNewTaskChange={(value) =>
                  setNewTasks((current) => ({
                    ...current,
                    [column.status]: value,
                  }))
                }
                onCreateTask={(event) =>
                  void createTask(event, column.status)
                }
                onUpdateTask={(taskId, title) =>
                  void updateTaskTitle(taskId, title)
                }
                onDeleteTask={(taskId) => void deleteTask(taskId)}
              />
            )
          })}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="rounded-lg border bg-background px-4 py-3 font-medium shadow-lg">
              {activeTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
