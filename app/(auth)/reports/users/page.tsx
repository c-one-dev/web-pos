"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import gql from "graphql-tag"
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react"
import { format } from "date-fns"
import {
  startOfToday,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from "date-fns"
import { formatDateRange } from "little-date"
import { DateRange } from "react-day-picker"
import ExcelJS from "exceljs"
import {
  CalendarBlankIcon,
  CaretDownIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/custom/data-table"
import { useCursorPage } from "@/hooks/use-cursor-page"
import { toast } from "sonner"
import { downloadExcelWorkbook, styleExcelHeaderRow } from "@/lib/report-export"

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

type SalesTargetPeriod = "DAILY" | "WEEKLY" | "MONTHLY"

// Mirrors resolvers/salesTarget.resolver.ts's rangeForPeriod, so the export's
// title/filename period matches whatever the on-screen table is showing.
const periodDateRange = (period: SalesTargetPeriod, date: Date): DateRange => {
  switch (period) {
    case "WEEKLY":
      return { from: startOfWeek(date), to: endOfWeek(date) }
    case "MONTHLY":
      return { from: startOfMonth(date), to: endOfMonth(date) }
    default:
      return { from: startOfDay(date), to: endOfDay(date) }
  }
}

// Users report has no outlet dimension (activity/targets aren't
// outlet-scoped), so this is a lighter title block than the Sales/Payments
// reports' addExcelTitleRows - title + period only, no outlet line.
function addTitleRows(
  sheet: ExcelJS.Worksheet,
  title: string,
  range: DateRange,
  columnCount: number
) {
  const from = range.from || startOfToday()
  const to = range.to || range.from || startOfToday()
  sheet.mergeCells(1, 1, 1, columnCount)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: "center" }

  sheet.mergeCells(2, 1, 2, columnCount)
  const periodCell = sheet.getCell(2, 1)
  periodCell.value = `For the period of ${format(from, "dd MMM yyyy")} to ${format(to, "dd MMM yyyy")}`
  periodCell.alignment = { horizontal: "center" }
  periodCell.font = { color: { argb: "FF666666" } }

  sheet.addRow([])
}

const DATE_PRESETS: { label: string; getRange: () => DateRange }[] = [
  {
    label: "Today",
    getRange: () => ({ from: startOfToday(), to: startOfToday() }),
  },
  {
    label: "This Week",
    getRange: () => ({
      from: startOfWeek(new Date()),
      to: endOfWeek(new Date()),
    }),
  },
  {
    label: "Last 7 Days",
    getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: "This Month",
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Last 30 Days",
    getRange: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
]

function DateRangeFilter({
  appliedRange,
  presetLabel,
  onApply,
}: {
  appliedRange: DateRange
  presetLabel: string
  onApply: (range: DateRange, label: string) => void
}) {
  const [stagedRange, setStagedRange] = useState<DateRange | undefined>(
    appliedRange
  )
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setStagedRange(appliedRange)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <CalendarBlankIcon />
          {presetLabel === "Custom" && appliedRange.from && appliedRange.to
            ? formatDateRange(appliedRange.from, appliedRange.to, {
                includeTime: false,
              })
            : presetLabel}
          <CaretDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-lg p-0 px-1 pt-4" align="end">
        <div className="flex">
          <div className="flex flex-col gap-1 border-r p-2 pr-3">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start font-normal"
                onClick={() => {
                  onApply(preset.getRange(), preset.label)
                  setOpen(false)
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div>
            <Calendar
              mode="range"
              defaultMonth={stagedRange?.from}
              selected={stagedRange}
              onSelect={setStagedRange}
              numberOfMonths={2}
            />
            <div className="flex justify-end px-4 pb-4">
              <Button
                disabled={!stagedRange?.from || !stagedRange?.to}
                onClick={() => {
                  if (!stagedRange?.from || !stagedRange?.to) return
                  onApply(stagedRange, "Custom")
                  setOpen(false)
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TotalsTable<T extends { _id: string }>({
  nodes,
  total,
  loading,
  columns,
  emptyLabel,
  rows,
  setRows,
  page,
  onPrev,
  onNext,
}: {
  nodes: T[]
  total: number
  loading: boolean
  columns: ColumnDef<T>[]
  emptyLabel: string
  rows: number
  setRows: (rows: number) => void
  page: { current: number; max: number }
  onPrev: () => void
  onNext: () => void
}) {
  const points = nodes

  if (!loading && !points.length)
    return (
      <div className="flex h-40 w-full items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {total === 0 ? 0 : (page.current - 1) * rows + 1}-
          {page.current === page.max ? total : page.current * rows} out of{" "}
          {total} result{total === 1 ? "" : "s"}.
        </span>
        <div className="flex gap-1.5">
          <Select
            value={rows.toString()}
            onValueChange={(value) => setRows(Number(value))}
          >
            <SelectTrigger className="w-18">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <ButtonGroup>
            <Button
              onClick={onPrev}
              disabled={page.current === 1}
              variant="outline"
            >
              Prev
            </Button>
            <ButtonGroupText>{`Page ${page.current} of ${page.max}`}</ButtonGroupText>
            <Button
              onClick={onNext}
              disabled={page.current === page.max}
              variant="outline"
            >
              Next
            </Button>
          </ButtonGroup>
        </div>
      </div>
      <DataTable
        loading={loading}
        columns={columns}
        data={points.slice((page.current - 1) * rows, page.current * rows)}
        noFooter
      />
    </div>
  )
}

function SearchBox({
  placeholder,
  onSearch,
}: {
  placeholder: string
  onSearch: (value: string) => void
}) {
  const [term, setTerm] = useState("")
  return (
    <InputGroup className="w-80">
      <InputGroupInput
        data-search-input
        placeholder={placeholder}
        onChange={(e) => setTerm(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch(term)
          if (e.key === "Escape") {
            setTerm("")
            onSearch("")
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton onClick={() => onSearch(term)}>
          <MagnifyingGlassIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

const GET_ACTIVITY_LOG = gql`
  query ActivityLogTable(
    $first: Int
    $after: String
    $start: String!
    $end: String!
    $search: String
  ) {
    activityLogTable(
      first: $first
      after: $after
      start: $start
      end: $end
      search: $search
    ) {
      total
      pages
      edges {
        cursor
        node {
          _id
          userName
          activity
          ipAddress
          deviceName
          browser
          date
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`

type ActivityLogNode = {
  _id: string
  userName: string
  activity: string
  ipAddress: string | null
  deviceName: string | null
  browser: string | null
  date: string
}

function MajorActivityLogTab({ range }: { range: DateRange }) {
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<number>(8)

  const baseVars = useMemo(
    () => ({
      start: startOfDay(range.from || startOfToday()).toISOString(),
      end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
      search,
    }),
    [range, search]
  )

  const { data, loading, fetchMore } = useQuery(GET_ACTIVITY_LOG, {
    variables: { first: rows, ...baseVars },
    fetchPolicy: "network-only",
  })
  const { page, total, nodes, reset, onNext, onPrev } = useCursorPage(
    "activityLogTable",
    data,
    fetchMore,
    rows,
    baseVars
  )

  // A new range, search or page size starts a fresh cursor run - the pages
  // already loaded belong to the old query.
  useEffect(() => {
    reset()
  }, [baseVars, rows, reset])

  const columns: ColumnDef<ActivityLogNode>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Time",
        cell: ({ row }) =>
          row.original.date ? format(Number(row.original.date), "PP · p") : "-",
      },
      {
        id: "userName",
        header: "User Name",
        cell: ({ row }) => row.original.userName,
      },
      {
        id: "activity",
        header: "Activity",
        cell: ({ row }) => row.original.activity,
      },
      {
        id: "ipAddress",
        header: "IP address",
        cell: ({ row }) => row.original.ipAddress || "-",
      },
      {
        id: "deviceName",
        header: "Device name (if available)",
        cell: ({ row }) => row.original.deviceName || "-",
      },
      {
        id: "browser",
        header: "Browser",
        cell: ({ row }) => row.original.browser || "-",
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-1.5 pt-4">
      <SearchBox placeholder="Find by user or activity" onSearch={setSearch} />
      <TotalsTable
        nodes={nodes.slice((page.current - 1) * rows, page.current * rows)}
        total={total}
        loading={loading}
        columns={columns}
        emptyLabel="No activity recorded in this period."
        rows={rows}
        setRows={setRows}
        page={page}
        onPrev={onPrev}
        onNext={onNext}
      />
    </div>
  )
}

const GET_SALES_TARGETS = gql`
  query SalesTargetTable(
    $first: Int
    $after: String
    $period: SalesTargetPeriod
    $date: String
    $search: String
  ) {
    salesTargetTable(
      first: $first
      after: $after
      period: $period
      date: $date
      search: $search
    ) {
      total
      pages
      edges {
        cursor
        node {
          _id
          userName
          totalSalesCount
          totalSales
          target
          achievedPercent
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`

const SET_SALES_TARGET = gql`
  mutation SetSalesTarget(
    $user: ID!
    $period: SalesTargetPeriod!
    $target: Float!
  ) {
    setSalesTarget(user: $user, period: $period, target: $target) {
      ok
      message
    }
  }
`

type SalesTargetNode = {
  _id: string
  userName: string
  totalSalesCount: number
  totalSales: number
  target: number
  achievedPercent: number
}

function TargetCell({
  userId,
  period,
  target,
  onSaved,
}: {
  userId: string
  period: string
  target: number
  onSaved: () => void
}) {
  const [value, setValue] = useState(target.toString())
  const [setSalesTarget, { loading }] = useMutation(SET_SALES_TARGET)

  const save = async () => {
    const parsed = Number(value)
    if (Number.isNaN(parsed) || parsed === target) {
      setValue(target.toString())
      return
    }
    try {
      const result: any = await setSalesTarget({
        variables: { user: userId, period, target: parsed },
      })
      if (result.data?.setSalesTarget?.ok) {
        toast.success(result.data.setSalesTarget.message)
        onSaved()
      }
    } catch (error: any) {
      toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
      setValue(target.toString())
    }
  }

  return (
    <InputGroup className="w-32">
      <InputGroupInput
        data-search-input
        type="number"
        min={0}
        disabled={loading}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
        }}
      />
    </InputGroup>
  )
}

function SalesTargetsTab({
  period,
  date,
}: {
  period: SalesTargetPeriod
  date: Date
}) {
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<number>(8)

  const baseVars = useMemo(
    () => ({ period, date: date.toISOString(), search }),
    [period, date, search]
  )

  const { data, loading, refetch, fetchMore } = useQuery(GET_SALES_TARGETS, {
    variables: { first: rows, ...baseVars },
    fetchPolicy: "network-only",
  })
  const { page, total, nodes, reset, onNext, onPrev } = useCursorPage(
    "salesTargetTable",
    data,
    fetchMore,
    rows,
    baseVars
  )

  useEffect(() => {
    reset()
  }, [baseVars, rows, reset])

  const columns: ColumnDef<SalesTargetNode>[] = useMemo(
    () => [
      {
        id: "userName",
        header: "User",
        cell: ({ row }) => (
          <span className="font-medium text-primary">
            {row.original.userName}
          </span>
        ),
      },
      {
        id: "totalSalesCount",
        header: "Total sales count",
        cell: ({ row }) => row.original.totalSalesCount,
      },
      {
        id: "totalSales",
        header: "Total sales",
        cell: ({ row }) => currency(row.original.totalSales),
      },
      {
        id: "target",
        header: "Target",
        cell: ({ row }) => (
          <TargetCell
            userId={row.original._id}
            period={period}
            target={row.original.target}
            onSaved={() => refetch()}
          />
        ),
      },
      {
        id: "achievedPercent",
        header: "Achieved %",
        cell: ({ row }) => `${row.original.achievedPercent.toFixed(1)}%`,
      },
    ],
    [period, refetch]
  )

  return (
    <div className="flex flex-col gap-1.5 pt-4">
      <SearchBox placeholder="Find user" onSearch={setSearch} />
      <TotalsTable
        nodes={nodes.slice((page.current - 1) * rows, page.current * rows)}
        total={total}
        loading={loading}
        columns={columns}
        emptyLabel="No active users found."
        rows={rows}
        setRows={setRows}
        page={page}
        onPrev={onPrev}
        onNext={onNext}
      />
    </div>
  )
}

// Exports must cover the whole result set, not just the pages the table has
// loaded. The server clamps first at MAX_PAGE_SIZE (500), so one big request
// would silently truncate - page through instead, with a hard cap so a huge
// date range can not build an unbounded workbook.
async function fetchAllPages<T>(
  client: ReturnType<typeof useApolloClient>,
  query: any,
  baseVars: Record<string, any>,
  field: string,
  cap: number
): Promise<T[]> {
  const collected: T[] = []
  let after: string | null = null
  for (;;) {
    const { data }: any = await client.query({
      query,
      variables: { ...baseVars, first: 500, after },
      fetchPolicy: "network-only",
    })
    const connection = data?.[field]
    if (!connection) break
    collected.push(...(connection.edges || []).map((edge: any) => edge.node))
    if (!connection.pageInfo?.hasNextPage || collected.length >= cap) break
    after = connection.pageInfo.endCursor
    if (!after) break
  }
  return collected.slice(0, cap)
}

async function exportActivityLogExcel(
  client: ReturnType<typeof useApolloClient>,
  range: DateRange
) {
  const start = startOfDay(range.from || startOfToday()).toISOString()
  const end = endOfDay(range.to || range.from || startOfToday()).toISOString()
  const nodes: ActivityLogNode[] = await fetchAllPages<ActivityLogNode>(
    client,
    GET_ACTIVITY_LOG,
    { start, end },
    "activityLogTable",
    2000
  )

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Major Activity Log")
  addTitleRows(sheet, "Major Activity Log", range, 6)
  sheet.columns = [
    { width: 20 },
    { width: 20 },
    { width: 26 },
    { width: 16 },
    { width: 20 },
    { width: 22 },
  ]
  const headerRow = sheet.addRow([
    "Time",
    "User Name",
    "Activity",
    "IP address",
    "Device name",
    "Browser",
  ])
  styleExcelHeaderRow(headerRow)
  nodes.forEach((n) =>
    sheet.addRow([
      n.date ? format(Number(n.date), "dd MMM yyyy · p") : "-",
      n.userName,
      n.activity,
      n.ipAddress || "-",
      n.deviceName || "-",
      n.browser || "-",
    ])
  )

  await downloadExcelWorkbook(workbook, "Major Activity Log", range)
}

async function exportSalesTargetsExcel(
  client: ReturnType<typeof useApolloClient>,
  period: SalesTargetPeriod,
  date: Date
) {
  const range = periodDateRange(period, date)
  const nodes: SalesTargetNode[] = await fetchAllPages<SalesTargetNode>(
    client,
    GET_SALES_TARGETS,
    { period, date: date.toISOString() },
    "salesTargetTable",
    2000
  )

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Sales Targets")
  addTitleRows(sheet, "Sales Targets", range, 5)
  sheet.columns = [
    { width: 26 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
  ]
  const headerRow = sheet.addRow([
    "User",
    "Total sales count",
    "Total sales",
    "Target",
    "Achieved %",
  ])
  styleExcelHeaderRow(headerRow)
  nodes.forEach((n) =>
    sheet.addRow([
      n.userName,
      n.totalSalesCount,
      n.totalSales,
      n.target,
      `${n.achievedPercent.toFixed(1)}%`,
    ])
  )

  await downloadExcelWorkbook(workbook, "Sales Targets", range)
}

function ExportButton({
  activeTab,
  range,
  period,
  date,
}: {
  activeTab: string
  range: DateRange
  period: SalesTargetPeriod
  date: Date
}) {
  const client = useApolloClient()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      if (activeTab === "activity-log")
        await exportActivityLogExcel(client, range)
      else await exportSalesTargetsExcel(client, period, date)
    } catch (error: any) {
      toast.error(error.message || "Failed to export.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      className="cursor-pointer gap-1.5 rounded-[10px]"
      disabled={isExporting}
      onClick={handleExport}
    >
      <DownloadSimpleIcon />
      {isExporting ? "Exporting..." : "Export"}
    </Button>
  )
}

export default function Page() {
  const [activeTab, setActiveTab] = useState("activity-log")
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: subDays(new Date(), 6),
    to: new Date(),
  })
  const [presetLabel, setPresetLabel] = useState("Last 7 Days")
  const [period, setPeriod] = useState<SalesTargetPeriod>("MONTHLY")
  const [targetDate, setTargetDate] = useState<Date>(new Date())

  const isSalesTargets = activeTab === "sales-targets"

  return (
    <div className="flex h-full w-full flex-col gap-1.5 p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <Label className="text-xl font-medium">Users</Label>
        <div className="flex items-center gap-1.5">
          {isSalesTargets ? (
            <>
              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as SalesTargetPeriod)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-1.5">
                    <CalendarBlankIcon />
                    {format(targetDate, "PP")}
                    <CaretDownIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={targetDate}
                    onSelect={(value) => value && setTargetDate(value)}
                  />
                </PopoverContent>
              </Popover>
            </>
          ) : (
            <DateRangeFilter
              appliedRange={appliedRange}
              presetLabel={presetLabel}
              onApply={(range, label) => {
                setAppliedRange(range)
                setPresetLabel(label)
              }}
            />
          )}
          <ExportButton
            activeTab={activeTab}
            range={appliedRange}
            period={period}
            date={targetDate}
          />
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="activity-log">Major Activity Log</TabsTrigger>
          <TabsTrigger value="sales-targets">Sales Targets</TabsTrigger>
        </TabsList>
        <TabsContent value="activity-log">
          <MajorActivityLogTab range={appliedRange} />
        </TabsContent>
        <TabsContent value="sales-targets">
          <SalesTargetsTab period={period} date={targetDate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
