import { useMemo, useState, type FormEvent } from "react"
import {
  Add01Icon,
  AtSignIcon,
  Calendar03Icon,
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
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { WorkspaceMentionMenu } from "@/components/workspace/workspace-mention-menu"
import type { Resource, WorkspaceMember } from "@/lib/api"
import {
  buildWorkspaceMentionItems,
  filterWorkspaceMentionItems,
  type WorkspaceMentionItem,
} from "@/lib/workspace-mentions"

type ColumnKind = "text" | "number" | "checkbox" | "date" | "select" | "mention"
type CellValue = string | number | boolean | null
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
  accentColor: "#087AD1",
  backgroundColor: "#ffffff",
  browserColorScheme: "light",
  columnBorder: false,
  fontFamily: "Arial",
  foregroundColor: "rgb(46, 55, 66)",
  headerBackgroundColor: "#F9FAFB",
  headerFontWeight: 600,
  headerTextColor: "#919191",
  oddRowBackgroundColor: "#F9FAFB",
  rowBorder: false,
  sidePanelBorder: false,
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
  { value: "mention", label: "Mention" },
]

const DEFAULT_COLUMNS: TableColumn[] = [
  { id: "name", name: "Name", kind: "text" },
  {
    id: "status",
    name: "Status",
    kind: "select",
    options: ["Not started", "In progress", "Done"],
  },
  { id: "owner", name: "Owner", kind: "text" },
  { id: "updated", name: "Date", kind: "date" },
]

function storageKey(resourceId: string) {
  return `zany-ihub:table:${resourceId}`
}

function kindLabel(kind: ColumnKind) {
  return COLUMN_KINDS.find((item) => item.value === kind)?.label ?? kind
}

function defaultCellValue(column: TableColumn): CellValue {
  if (column.kind === "checkbox") return false
  if (column.kind === "number") return null
  if (column.kind === "select") return column.options?.[0] ?? ""
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

function loadTable(resourceId: string): StoredTable {
  const saved = window.localStorage.getItem(storageKey(resourceId))
  if (!saved) {
    return {
      version: 1,
      columns: DEFAULT_COLUMNS,
      rows: [createRow(DEFAULT_COLUMNS)],
    }
  }

  try {
    const parsed = JSON.parse(saved) as StoredTable | TableRow[]

    // Migrate tables created before column schemas were introduced.
    if (Array.isArray(parsed)) {
      return { version: 1, columns: DEFAULT_COLUMNS, rows: parsed }
    }

    if (
      parsed.version === 1 &&
      Array.isArray(parsed.columns) &&
      Array.isArray(parsed.rows)
    ) {
      return parsed
    }
  } catch {
    // Fall back to a new table if local data is malformed.
  }

  return {
    version: 1,
    columns: DEFAULT_COLUMNS,
    rows: [createRow(DEFAULT_COLUMNS)],
  }
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

function MentionCellRenderer({
  value,
  mentionItems,
}: CustomCellRendererProps<TableRow, string> & MentionCellProps) {
  const item = mentionItems.find((candidate) => candidate.key === value)
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex max-w-full items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
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

function AddColumnDialog({ onAdd }: { onAdd: (column: TableColumn) => void }) {
  const [open, setOpen] = useState(false)
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

    if (kind === "select" && selectOptions.length === 0) return

    onAdd({
      id: `column_${crypto.randomUUID()}`,
      name: trimmedName,
      kind,
      ...(kind === "select" ? { options: selectOptions } : {}),
    })
    setName("")
    setKind("text")
    setOptions("Not started, In progress, Done")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <HugeiconsIcon icon={ColumnInsertIcon} strokeWidth={2} />
        Add column
      </DialogTrigger>
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
            {kind === "select" && (
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
                (kind === "select" &&
                  !options.split(",").some((option) => Boolean(option.trim())))
              }
            >
              Add column
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [table, setTable] = useState<StoredTable>(() => loadTable(resource.id))
  const { columns, rows } = table
  const mentionItems = useMemo(
    () => buildWorkspaceMentionItems(resources, members),
    [resources, members]
  )

  const columnDefs = useMemo<ColDef<TableRow>[]>(
    () =>
      columns.map((column, index) => ({
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
              : column.kind === "select" || column.kind === "mention"
                ? "text"
                : column.kind,
        ...(column.kind === "select"
          ? {
              cellEditor: "agSelectCellEditor",
              cellEditorParams: { values: column.options ?? [] },
            }
          : {}),
        ...(column.kind === "mention"
          ? {
              cellRenderer: MentionCellRenderer,
              cellRendererParams: { mentionItems },
              cellEditor: MentionCellEditor,
              cellEditorParams: { mentionItems },
              cellEditorPopup: true,
              cellEditorPopupPosition: "under" as const,
            }
          : {}),
      })),
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
    setTable(nextTable)
    window.localStorage.setItem(
      storageKey(resource.id),
      JSON.stringify(nextTable)
    )
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Table</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {resource.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Saved locally</Badge>
          <Badge variant="secondary">
            {rows.length} {rows.length === 1 ? "row" : "rows"}
          </Badge>
          <Badge variant="secondary">
            {columns.length} {columns.length === 1 ? "column" : "columns"}
          </Badge>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 p-2">
          <p className="px-2 text-sm font-medium">Database</p>
          <div className="flex items-center gap-2">
            <AddColumnDialog onAdd={addColumn} />
            <Button type="button" variant="outline" onClick={addRow}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Add row
            </Button>
          </div>
        </div>
        <CardContent className="h-[32rem] p-0">
          <AgGridProvider modules={GRID_MODULES}>
            <AgGridReact<TableRow>
              theme={GRID_THEME}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={({ data }) => String(data.id)}
              onCellValueChanged={updateCell}
              animateRows
              stopEditingWhenCellsLoseFocus
            />
          </AgGridProvider>
        </CardContent>
      </Card>
    </div>
  )
}
