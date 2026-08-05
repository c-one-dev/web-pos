"use client"
import { useMemo, useState } from "react"
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
import { toast } from "sonner"
import { downloadExcelWorkbook, styleExcelHeaderRow } from "@/lib/report-export"

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

const formatHours = (hours?: number | null) => {
  const totalMinutes = Math.max(0, Math.round((hours || 0) * 60))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}:${m.toString().padStart(2, "0")}`
}

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

// Users report has no outlet dimension (timecards/activity/targets aren't
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
  data,
  loading,
  columns,
  emptyLabel,
}: {
  data?: T[]
  loading: boolean
  columns: ColumnDef<T>[]
  emptyLabel: string
}) {
  const [rows, setRows] = useState<number>(8)
  const [page, setPage] = useState<{ current: number; max: number }>({
    current: 1,
    max: 1,
  })

  const points = useMemo(() => data || [], [data])
  const total = points.length
  const max = Math.max(1, Math.ceil(total / rows))
  if (max !== page.max)
    setPage((prev) => ({ ...prev, max, current: Math.min(prev.current, max) }))

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
            onValueChange={(value) => {
              setRows(Number(value))
              setPage({ current: 1, max: 1 })
            }}
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
              onClick={() =>
                setPage((prev) => ({ ...prev, current: prev.current - 1 }))
              }
              disabled={page.current === 1}
              variant="outline"
            >
              Prev
            </Button>
            <ButtonGroupText>{`Page ${page.current} of ${page.max}`}</ButtonGroupText>
            <Button
              onClick={() =>
                setPage((prev) => ({ ...prev, current: prev.current + 1 }))
              }
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

const GET_TIMECARD_BY_USER = gql`
  query TimeCardByUserTable($start: String!, $end: String!, $search: String) {
    timeCardByUserTable(start: $start, end: $end, search: $search) {
      _id
      userName
      hoursLogged
    }
  }
`

type TimeCardByUserNode = { _id: string; userName: string; hoursLogged: number }

function TimecardsByUserTab({ range }: { range: DateRange }) {
  const [search, setSearch] = useState("")

  const { data, loading } = useQuery(GET_TIMECARD_BY_USER, {
    variables: {
      start: startOfDay(range.from || startOfToday()).toISOString(),
      end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
      search,
    },
    fetchPolicy: "network-only",
  })
  const nodes: TimeCardByUserNode[] = (data as any)?.timeCardByUserTable || []

  const columns: ColumnDef<TimeCardByUserNode>[] = useMemo(
    () => [
      {
        id: "userName",
        header: "Staff Member",
        cell: ({ row }) => (
          <span className="font-medium text-primary">
            {row.original.userName}
          </span>
        ),
      },
      {
        id: "hoursLogged",
        header: "Hours logged",
        cell: ({ row }) => formatHours(row.original.hoursLogged),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-1.5 pt-4">
      <SearchBox placeholder="Find staff member" onSearch={setSearch} />
      <TotalsTable
        data={nodes}
        loading={loading}
        columns={columns}
        emptyLabel="No timecards in this period."
      />
    </div>
  )
}

const GET_TIMECARD_BY_DATE = gql`
  query TimeCardByDateTable($start: String!, $end: String!, $search: String) {
    timeCardByDateTable(start: $start, end: $end, search: $search) {
      _id
      date
      clockIn
      clockOut
      userName
      hoursLogged
    }
  }
`

type TimeCardByDateNode = {
  _id: string
  date: string
  clockIn: string
  clockOut: string | null
  userName: string
  hoursLogged: number
}

function TimecardsByDateTab({ range }: { range: DateRange }) {
  const [search, setSearch] = useState("")

  const { data, loading } = useQuery(GET_TIMECARD_BY_DATE, {
    variables: {
      start: startOfDay(range.from || startOfToday()).toISOString(),
      end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
      search,
    },
    fetchPolicy: "network-only",
  })
  const nodes: TimeCardByDateNode[] = (data as any)?.timeCardByDateTable || []

  const columns: ColumnDef<TimeCardByDateNode>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        cell: ({ row }) =>
          row.original.date ? format(Number(row.original.date), "PP") : "-",
      },
      {
        id: "timeInOut",
        header: "Time in/out",
        cell: ({ row }) =>
          `${format(Number(row.original.clockIn), "p")} - ${
            row.original.clockOut
              ? format(Number(row.original.clockOut), "p")
              : "-"
          }`,
      },
      {
        id: "userName",
        header: "Staff Member",
        cell: ({ row }) => row.original.userName,
      },
      {
        id: "hoursLogged",
        header: "Hours logged",
        cell: ({ row }) => formatHours(row.original.hoursLogged),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-1.5 pt-4">
      <SearchBox placeholder="Find staff member" onSearch={setSearch} />
      <TotalsTable
        data={nodes}
        loading={loading}
        columns={columns}
        emptyLabel="No timecards in this period."
      />
    </div>
  )
}

const GET_ACTIVITY_LOG = gql`
  query ActivityLogTable($start: String!, $end: String!, $search: String) {
    activityLogTable(start: $start, end: $end, search: $search) {
      _id
      userName
      activity
      ipAddress
      deviceName
      browser
      date
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

  const { data, loading } = useQuery(GET_ACTIVITY_LOG, {
    variables: {
      start: startOfDay(range.from || startOfToday()).toISOString(),
      end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
      search,
    },
    fetchPolicy: "network-only",
  })
  const nodes: ActivityLogNode[] = (data as any)?.activityLogTable || []

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
        data={nodes}
        loading={loading}
        columns={columns}
        emptyLabel="No activity recorded in this period."
      />
    </div>
  )
}

const GET_SALES_TARGETS = gql`
  query SalesTargetTable(
    $period: SalesTargetPeriod
    $date: String
    $search: String
  ) {
    salesTargetTable(period: $period, date: $date, search: $search) {
      _id
      userName
      totalSalesCount
      totalSales
      target
      achievedPercent
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
        type="number"
        min={0}
        disabled={loading}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
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

  const { data, loading, refetch } = useQuery(GET_SALES_TARGETS, {
    variables: { period, date: date.toISOString(), search },
    fetchPolicy: "network-only",
  })
  const nodes: SalesTargetNode[] = (data as any)?.salesTargetTable || []

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
        data={nodes}
        loading={loading}
        columns={columns}
        emptyLabel="No active users found."
      />
    </div>
  )
}

async function exportTimecardsByUserExcel(
  client: ReturnType<typeof useApolloClient>,
  range: DateRange
) {
  const start = startOfDay(range.from || startOfToday()).toISOString()
  const end = endOfDay(range.to || range.from || startOfToday()).toISOString()
  const { data } = await client.query({
    query: GET_TIMECARD_BY_USER,
    variables: { start, end },
    fetchPolicy: "network-only",
  })
  const nodes: TimeCardByUserNode[] = (data as any)?.timeCardByUserTable || []

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Timecards by User")
  addTitleRows(sheet, "Timecards by User", range, 2)
  sheet.columns = [{ width: 28 }, { width: 16 }]
  const headerRow = sheet.addRow(["Staff Member", "Hours logged"])
  styleExcelHeaderRow(headerRow)
  nodes.forEach((n) => sheet.addRow([n.userName, formatHours(n.hoursLogged)]))

  await downloadExcelWorkbook(workbook, "Timecards by User", range)
}

async function exportTimecardsByDateExcel(
  client: ReturnType<typeof useApolloClient>,
  range: DateRange
) {
  const start = startOfDay(range.from || startOfToday()).toISOString()
  const end = endOfDay(range.to || range.from || startOfToday()).toISOString()
  const { data } = await client.query({
    query: GET_TIMECARD_BY_DATE,
    variables: { start, end },
    fetchPolicy: "network-only",
  })
  const nodes: TimeCardByDateNode[] = (data as any)?.timeCardByDateTable || []

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Timecards by Date")
  addTitleRows(sheet, "Timecards by Date", range, 4)
  sheet.columns = [{ width: 16 }, { width: 22 }, { width: 26 }, { width: 16 }]
  const headerRow = sheet.addRow([
    "Date",
    "Time in/out",
    "Staff Member",
    "Hours logged",
  ])
  styleExcelHeaderRow(headerRow)
  nodes.forEach((n) =>
    sheet.addRow([
      n.date ? format(Number(n.date), "dd MMM yyyy") : "-",
      `${format(Number(n.clockIn), "p")} - ${n.clockOut ? format(Number(n.clockOut), "p") : "-"}`,
      n.userName,
      formatHours(n.hoursLogged),
    ])
  )

  await downloadExcelWorkbook(workbook, "Timecards by Date", range)
}

async function exportActivityLogExcel(
  client: ReturnType<typeof useApolloClient>,
  range: DateRange
) {
  const start = startOfDay(range.from || startOfToday()).toISOString()
  const end = endOfDay(range.to || range.from || startOfToday()).toISOString()
  const { data } = await client.query({
    query: GET_ACTIVITY_LOG,
    variables: { start, end },
    fetchPolicy: "network-only",
  })
  const nodes: ActivityLogNode[] = (data as any)?.activityLogTable || []

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
  const { data } = await client.query({
    query: GET_SALES_TARGETS,
    variables: { period, date: date.toISOString() },
    fetchPolicy: "network-only",
  })
  const nodes: SalesTargetNode[] = (data as any)?.salesTargetTable || []

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
      if (activeTab === "timecards-user")
        await exportTimecardsByUserExcel(client, range)
      else if (activeTab === "timecards-date")
        await exportTimecardsByDateExcel(client, range)
      else if (activeTab === "activity-log")
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
  const [activeTab, setActiveTab] = useState("timecards-user")
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
          <TabsTrigger value="timecards-user">Timecards by User</TabsTrigger>
          <TabsTrigger value="timecards-date">Timecards by Date</TabsTrigger>
          <TabsTrigger value="activity-log">Major Activity Log</TabsTrigger>
          <TabsTrigger value="sales-targets">Sales Targets</TabsTrigger>
        </TabsList>
        <TabsContent value="timecards-user">
          <TimecardsByUserTab range={appliedRange} />
        </TabsContent>
        <TabsContent value="timecards-date">
          <TimecardsByDateTab range={appliedRange} />
        </TabsContent>
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
