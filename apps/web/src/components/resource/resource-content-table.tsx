import { useMemo, useState, type FormEvent } from "react"
import {
  Add01Icon,
  ArrowDown01Icon,
  AtSignIcon,
  Calendar03Icon,
  CheckListIcon,
  CheckmarkSquare02Icon,
  ColumnInsertIcon,
  HashtagIcon,
  Select02Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AllCommunityModule,
  iconSetQuartzLight,
  themeQuartz,
  type CellClickedEvent,
  type CellValueChangedEvent,
  type ColDef,
  type IHeaderParams,
} from "ag-grid-community"
import {
  AgGridProvider,
  AgGridReact,
  type CustomCellEditorProps,
  type CustomCellRendererProps,
} from "ag-grid-react"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

import { WorkspaceMentionMenu } from "@/components/workspace/workspace-mention-menu"
import type { Resource, WorkspaceMember } from "@/lib/api"
import {
  buildWorkspaceMentionItems,
  filterWorkspaceMentionItems,
  type WorkspaceMentionItem,
} from "@/lib/workspace-mentions"
import { ResourcePageHeader } from "./resource-page-header"

type ColumnKind =
  | "text"
  | "number"
  | "checkbox"
  | "date"
  | "select"
  | "multi-select"
  | "mention"
type CellValue = string | number | boolean | string[] | null
type TableRow = { id: string; [columnId: string]: CellValue }
type TableColumn = {
  id: string
  name: string
  kind: ColumnKind
  options?: string[]
}
type StoredTable = {
  version: 1
  columns: TableColumn[]
  rows: TableRow[]
}

const GRID_MODULES = [AllCommunityModule]

const GRID_THEME = themeQuartz.withPart(iconSetQuartzLight).withParams({
  accentColor: "var(--primary)",
  backgroundColor: "var(--background)",
  borderColor: "var(--border)",
  browserColorScheme: "inherit",
  columnBorder: true,
  fontFamily: "var(--font-sans)",
  foregroundColor: "var(--foreground)",
  headerBackgroundColor: "var(--background)",
  headerFontWeight: 600,
  headerTextColor: "var(--muted-foreground)",
  oddRowBackgroundColor: "var(--background)",
  rowHoverColor: "var(--accent)",
  rowBorder: true,
  sidePanelBorder: true,
  spacing: 8,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
})

const COLUMN_KINDS: { value: ColumnKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multi-select", label: "Multi-select" },
  { value: "mention", label: "Mention" },
]

const OPTION_TONES = [
  "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  "bg-rose-500/15 text-rose-800 dark:text-rose-200",
  "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
  "bg-orange-500/15 text-orange-900 dark:text-orange-200",
  "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200",
] as const

const PICKER_KINDS = new Set<ColumnKind>([
  "checkbox",
  "date",
  "select",
  "multi-select",
  "mention",
])

function optionTone(option: string) {
  let hash = 0
  for (let index = 0; index < option.length; index += 1) {
    hash = (hash << 5) - hash + option.charCodeAt(index)
    hash |= 0
  }
  return OPTION_TONES[Math.abs(hash) % OPTION_TONES.length]!
}

function SelectOptionBadge({
  option,
  className,
}: {
  option: string
  className?: string
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("max-w-full border-0", optionTone(option), className)}
    >
      <span className="truncate">{option}</span>
    </Badge>
  )
}

function asStringArray(value: CellValue | undefined): string[] {
  if (Array.isArray(value))
    return value.filter((item) => typeof item === "string")
  if (typeof value === "string" && value) return [value]
  return []
}

const EMPTY_TABLE: StoredTable = { version: 1, columns: [], rows: [] }

function kindLabel(kind: ColumnKind) {
  return COLUMN_KINDS.find((item) => item.value === kind)?.label ?? kind
}

function defaultCellValue(column: TableColumn): CellValue {
  if (column.kind === "checkbox") return false
  if (column.kind === "number") return null
  if (column.kind === "select") return column.options?.[0] ?? ""
  if (column.kind === "multi-select") return []
  return ""
}

function createRow(columns: TableColumn[]): TableRow {
  return columns.reduce<TableRow>(
    (row, column) => {
      row[column.id] = defaultCellValue(column)
      return row
    },
    { id: crypto.randomUUID() }
  )
}

function DatabaseColumnHeader({
  displayName,
  kind,
}: IHeaderParams<TableRow> & { kind: ColumnKind }) {
  const icon = {
    text: TextFontIcon,
    number: HashtagIcon,
    checkbox: CheckmarkSquare02Icon,
    date: Calendar03Icon,
    select: Select02Icon,
    "multi-select": CheckListIcon,
    mention: AtSignIcon,
  }[kind]

  return (
    <div className="flex min-w-0 items-center gap-2">
      <HugeiconsIcon icon={icon} className="size-4 shrink-0" strokeWidth={2} />
      <span className="truncate font-medium">{displayName}</span>
    </div>
  )
}

type MentionCellProps = {
  mentionItems: WorkspaceMentionItem[]
}

type OptionCellProps = {
  options: string[]
}

function SelectCellRenderer({
  value,
}: CustomCellRendererProps<TableRow, string>) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return <SelectOptionBadge option={value} />
}

function SelectCellEditor({
  value,
  onValueChange,
  stopEditing,
  options,
}: CustomCellEditorProps<TableRow, string> & OptionCellProps) {
  return (
    <div className="flex max-h-64 w-52 flex-col gap-0.5 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={cn(
            "flex w-full items-center rounded-md px-1.5 py-1 text-left hover:bg-accent",
            option === value && "bg-accent"
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onValueChange(option)
            stopEditing(true)
          }}
        >
          <SelectOptionBadge option={option} />
        </button>
      ))}
    </div>
  )
}

function MultiSelectCellRenderer({
  value,
}: CustomCellRendererProps<TableRow, string[]>) {
  const selected = asStringArray(value)
  if (selected.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="flex min-w-0 flex-wrap gap-1 py-0.5">
      {selected.map((option) => (
        <SelectOptionBadge key={option} option={option} />
      ))}
    </div>
  )
}

function MultiSelectCellEditor({
  value,
  onValueChange,
  options,
}: CustomCellEditorProps<TableRow, string[]> & OptionCellProps) {
  const selected = asStringArray(value)

  function toggle(option: string) {
    onValueChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option]
    )
  }

  return (
    <div className="flex max-h-64 w-56 flex-col gap-0.5 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
      {options.map((option) => {
        const checked = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-accent",
              checked && "bg-accent"
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => toggle(option)}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background"
              )}
              aria-hidden
            >
              {checked ? "✓" : ""}
            </span>
            <SelectOptionBadge option={option} />
          </button>
        )
      })}
    </div>
  )
}

function MentionCellRenderer({
  value,
  mentionItems,
}: CustomCellRendererProps<TableRow, string> & MentionCellProps) {
  const item = mentionItems.find((candidate) => candidate.key === value)
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex max-w-full items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-foreground">
      <span className="truncate">
        @{item?.label ?? value.split(":").at(-1)}
      </span>
    </span>
  )
}

function MentionCellEditor({
  value,
  onValueChange,
  stopEditing,
  onKeyDown,
  mentionItems,
}: CustomCellEditorProps<TableRow, string> & MentionCellProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const items = filterWorkspaceMentionItems(mentionItems, query)
  const safeIndex = items.length ? Math.min(selectedIndex, items.length - 1) : 0
  const current = mentionItems.find((item) => item.key === value)

  function choose(item: WorkspaceMentionItem) {
    onValueChange(item.key)
    stopEditing(true)
  }

  return (
    <div className="w-80 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
      <div className="border-b p-2">
        <Input
          value={query}
          autoFocus
          placeholder={
            current ? `Current: @${current.label}` : "Search workspace…"
          }
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              event.stopPropagation()
              setSelectedIndex((index) =>
                items.length
                  ? event.key === "ArrowDown"
                    ? (index + 1) % items.length
                    : (index + items.length - 1) % items.length
                  : 0
              )
              return
            }
            if (event.key === "Enter") {
              event.preventDefault()
              event.stopPropagation()
              const item = items[safeIndex]
              if (item) choose(item)
              return
            }
            if (event.key === "Escape" || event.key === "Tab") {
              onKeyDown(event.nativeEvent)
              return
            }
            event.stopPropagation()
          }}
        />
      </div>
      <WorkspaceMentionMenu
        items={items}
        selectedIndex={safeIndex}
        onSelect={choose}
      />
    </div>
  )
}

function AddColumnDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (column: TableColumn) => void
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<ColumnKind>("text")
  const [options, setOptions] = useState("Not started, In progress, Done")

  function addColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    const selectOptions = options
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean)

    if (
      (kind === "select" || kind === "multi-select") &&
      selectOptions.length === 0
    ) {
      return
    }

    onAdd({
      id: `column_${crypto.randomUUID()}`,
      name: trimmedName,
      kind,
      ...(kind === "select" || kind === "multi-select"
        ? { options: selectOptions }
        : {}),
    })
    setName("")
    setKind("text")
    setOptions("Not started, In progress, Done")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="contents" onSubmit={addColumn}>
          <DialogHeader>
            <DialogTitle>New column</DialogTitle>
            <DialogDescription>
              Add a typed field to every row in this table.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="table-column-name">Name</Label>
              <Input
                id="table-column-name"
                value={name}
                placeholder="Priority"
                autoComplete="off"
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as ColumnKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_KINDS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(kind === "select" || kind === "multi-select") && (
              <div className="space-y-2">
                <Label htmlFor="table-column-options">Options</Label>
                <Input
                  id="table-column-options"
                  value={options}
                  placeholder="Low, Medium, High"
                  onChange={(event) => setOptions(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Separate options with commas.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                !name.trim() ||
                ((kind === "select" || kind === "multi-select") &&
                  !options.split(",").some((option) => Boolean(option.trim())))
              }
            >
              Add column
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TableAddActions({
  onAddRow,
  onAddColumn,
}: {
  onAddRow: () => void
  onAddColumn: (column: TableColumn) => void
}) {
  const [columnDialogOpen, setColumnDialogOpen] = useState(false)

  return (
    <>
      <ButtonGroup>
        <Button type="button" onClick={onAddRow}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Add row
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="icon"
                className="relative before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-primary-foreground/20"
                aria-label="More table actions"
              />
            }
          >
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onClick={() => setColumnDialogOpen(true)}>
              <HugeiconsIcon icon={ColumnInsertIcon} strokeWidth={2} />
              Add column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <AddColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        onAdd={onAddColumn}
      />
    </>
  )
}

export function ResourceContentTable({
  resource,
  resources,
  members,
}: {
  resource: Resource
  resources: Resource[]
  members: WorkspaceMember[]
}) {
  const zero = useZero()
  const [tableRow, tableState] = useQuery(
    queries.tables.byID({ id: resource.id })
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const table = (tableRow?.data as StoredTable | undefined) ?? EMPTY_TABLE
  const { columns } = table
  const rows = useMemo(() => structuredClone(table.rows), [table.rows])
  const mentionItems = useMemo(
    () => buildWorkspaceMentionItems(resources, members),
    [resources, members]
  )

  const columnDefs = useMemo<ColDef<TableRow>[]>(
    () =>
      columns.map((column, index) => {
        const base: ColDef<TableRow> = {
          colId: column.id,
          field: column.id,
          headerName: column.name,
          headerComponent: DatabaseColumnHeader,
          headerComponentParams: { kind: column.kind },
          headerTooltip: `${column.name} · ${kindLabel(column.kind)}`,
          minWidth: index === 0 ? 180 : 140,
          flex: index === 0 ? 2 : 1,
          cellDataType:
            column.kind === "date"
              ? "dateString"
              : column.kind === "checkbox"
                ? "boolean"
                : column.kind === "number"
                  ? "number"
                  : "text",
        }

        if (column.kind === "select") {
          return {
            ...base,
            cellRenderer: SelectCellRenderer,
            cellEditor: SelectCellEditor,
            cellEditorParams: { options: column.options ?? [] },
            cellEditorPopup: true,
            cellEditorPopupPosition: "under" as const,
          }
        }

        if (column.kind === "multi-select") {
          return {
            ...base,
            cellRenderer: MultiSelectCellRenderer,
            cellEditor: MultiSelectCellEditor,
            cellEditorParams: { options: column.options ?? [] },
            cellEditorPopup: true,
            cellEditorPopupPosition: "under" as const,
            autoHeight: true,
            wrapText: true,
          }
        }

        if (column.kind === "mention") {
          return {
            ...base,
            cellRenderer: MentionCellRenderer,
            cellRendererParams: { mentionItems },
            cellEditor: MentionCellEditor,
            cellEditorParams: { mentionItems },
            cellEditorPopup: true,
            cellEditorPopupPosition: "under" as const,
          }
        }

        return base
      }),
    [columns, mentionItems]
  )
  const defaultColDef = useMemo<ColDef<TableRow>>(
    () => ({
      editable: true,
      filter: true,
      minWidth: 120,
      resizable: true,
      sortable: true,
    }),
    []
  )

  function saveTable(nextTable: StoredTable) {
    if (zero.closed) return

    setSaveError(null)
    const result = zero.mutate(
      mutators.tables.update({
        id: resource.id,
        data: nextTable,
        now: Date.now(),
      })
    )
    void result.server
      .then((serverResult) => {
        if (serverResult.type === "error") {
          throw new Error(serverResult.error.message)
        }
      })
      .catch((error: unknown) => {
        if (zero.closed) return
        setSaveError(
          error instanceof Error ? error.message : "Could not save table"
        )
      })
  }

  function addRow() {
    saveTable({ ...table, rows: [...rows, createRow(columns)] })
  }

  function addColumn(column: TableColumn) {
    saveTable({
      ...table,
      columns: [...columns, column],
      rows: rows.map((row) => ({
        ...row,
        [column.id]: defaultCellValue(column),
      })),
    })
  }

  function updateCell(event: CellValueChangedEvent<TableRow>) {
    saveTable({
      ...table,
      rows: rows.map((row) =>
        row.id === event.data.id ? { ...event.data } : row
      ),
    })
  }

  function handleCellClicked(event: CellClickedEvent<TableRow>) {
    const colId = event.column.getColId()
    const column = columns.find((item) => item.id === colId)
    if (!column || !PICKER_KINDS.has(column.kind) || event.rowIndex == null) {
      return
    }
    event.api.startEditingCell({
      rowIndex: event.rowIndex,
      colKey: colId,
    })
  }

  const queryError =
    tableState.type === "error" ? tableState.error.message : null

  if (!tableRow && !queryError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Skeleton className="h-14 w-72 shrink-0" />
        <Skeleton className="min-h-0 flex-1 w-full" />
      </div>
    )
  }

  if (!tableRow) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {queryError ?? "Table content not found"}
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ResourcePageHeader
        resource={resource}
        className="shrink-0"
        actions={<TableAddActions onAddRow={addRow} onAddColumn={addColumn} />}
      />

      {saveError && (
        <p className="shrink-0 text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <AgGridProvider modules={GRID_MODULES}>
            <AgGridReact<TableRow>
              theme={GRID_THEME}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={({ data }) => String(data.id)}
              onCellValueChanged={updateCell}
              onCellClicked={handleCellClicked}
              animateRows
              stopEditingWhenCellsLoseFocus
            />
          </AgGridProvider>
        </div>
      </div>
    </div>
  )
}
