"use client"
import { Label } from "@/components/ui/label"
import { useCallback, useMemo, useState } from "react"
import gql from "graphql-tag"
import { useApolloClient, useQuery } from "@apollo/client/react"
import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import {
  addExcelTitleRows as addTitleRows,
  styleExcelHeaderRow as styleHeaderRow,
  downloadExcelWorkbook,
  addPdfHeader,
  addPdfFooter,
  savePdfDocument,
  pdfTableStyles,
  pdfCurrency,
} from "@/lib/report-export"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import {
  CalendarBlankIcon,
  CaretDownIcon,
  ChartLineUpIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  FileXlsIcon,
  MagnifyingGlassIcon,
  ReceiptIcon,
  ReceiptXIcon,
  TagIcon,
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/custom/data-table"
import SortHeader from "@/components/custom/sort-header"
import { StatusBadge } from "@/components/custom/status-badge"
import { CustomerBadge } from "@/components/custom/customer-badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  startOfToday,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
} from "date-fns"
import { formatDateRange } from "little-date"
import { DateRange } from "react-day-picker"
import SaleRowViewDialog from "@/app/(auth)/sale-history/_dialogs/row-view"

const GET_PAYMENT_SUMMARY = gql`
  query SalesReportSummary($start: String!, $end: String!) {
    paymentSummary(start: $start, end: $end) {
      salesInc
      refunds
      discounts
      netSales
    }
  }
`

const GET_DASHBOARD_BREAKDOWN = gql`
  query SalesReportBreakdown(
    $start: String!
    $end: String!
    $timezone: String
  ) {
    dashboardSummary(start: $start, end: $end, timezone: $timezone) {
      salesByDate {
        key
        label
        total
        count
      }
      salesByProductType {
        key
        label
        total
      }
      salesByTeam {
        key
        label
        total
      }
    }
  }
`

const GET_SALES_BY_ITEMS = gql`
  query SalesByItems($start: String!, $end: String!) {
    salesByItemTable(start: $start, end: $end) {
      _id
      name
      sku
      quantitySold
      salesExTax
      discounts
    }
  }
`

const GET_SALES_OUTLETS = gql`
  query SalesOutlets($start: String!, $end: String!) {
    salesOutlets(start: $start, end: $end)
  }
`

const GET_SALES_TRANSACTIONS = gql`
  query SalesTransactionTable(
    $first: Int
    $after: String
    $search: String
    $start: String
    $end: String
    $sort: Sort
  ) {
    salesTransactionTable(
      first: $first
      after: $after
      search: $search
      start: $start
      end: $end
      sort: $sort
    ) {
      total
      pages
      edges {
        cursor
        node {
          _id
          saleNumber
          date
          customerName
          itemsSummary
          items {
            name
            sku
            quantitySold
            sales
            discounts
          }
          outletName
          currentSaleStatus
          isOnAccount
          paymentTypes
          total
          byName
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

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
  {
    label: "All",
    getRange: () => ({ from: new Date(2000, 0, 1), to: new Date() }),
  },
]

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

const compactCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0)

function SummaryCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  loading?: boolean
}) {
  return (
    <Card size="sm" className="rounded-lg">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          {loading ? (
            <Skeleton className="h-6 w-24 rounded-lg" />
          ) : (
            <span className="text-xl font-semibold text-primary">{value}</span>
          )}
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
        </div>
        <span className="text-muted-foreground [&_svg]:size-6">{icon}</span>
      </CardContent>
    </Card>
  )
}

const TAB_LABELS: Record<string, string> = {
  summary: "Sales Summary",
  "by-items": "Sales (By Items)",
  transactions: "Sales Transactions",
  "by-category": "Sales by Category",
  users: "Sales by User",
}

async function exportSalesReportExcel({
  client,
  activeTab,
  range,
}: {
  client: ReturnType<typeof useApolloClient>
  activeTab: string
  range: DateRange
}) {
  const start = startOfDay(range.from || startOfToday()).toISOString()
  const end = endOfDay(range.to || range.from || startOfToday()).toISOString()
  const title = TAB_LABELS[activeTab] || "Sales Report"

  const { data: outletsData } = await client.query({
    query: GET_SALES_OUTLETS,
    variables: { start, end },
    fetchPolicy: "network-only",
  })
  const outlets: string[] = (outletsData as any)?.salesOutlets || []

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(title.slice(0, 31))

  if (activeTab === "summary") {
    const [{ data: summaryData }, { data: breakdownData }] = await Promise.all([
      client.query({
        query: GET_PAYMENT_SUMMARY,
        variables: { start, end },
        fetchPolicy: "network-only",
      }),
      client.query({
        query: GET_DASHBOARD_BREAKDOWN,
        variables: {
          start,
          end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        fetchPolicy: "network-only",
      }),
    ])
    const summary = (summaryData as any)?.paymentSummary
    const salesByDate =
      (breakdownData as any)?.dashboardSummary?.salesByDate || []

    addTitleRows(sheet, title, range, 2, outlets)
    sheet.columns = [{ width: 22 }, { width: 18 }]
    ;[
      ["Sales", summary?.salesInc || 0],
      ["Refunds", summary?.refunds || 0],
      ["Discounts", summary?.discounts || 0],
      ["Net Sales", summary?.netSales || 0],
    ].forEach((r) => sheet.addRow(r))
    sheet.addRow([])
    const headerRow = sheet.addRow([
      "Date",
      "Sales",
      "Transactions",
      "Avg. sale value",
    ])
    styleHeaderRow(headerRow)
    salesByDate.forEach((point: any) => {
      sheet.addRow([
        point.label,
        point.total,
        point.count,
        point.count ? point.total / point.count : 0,
      ])
    })
  } else if (activeTab === "by-items") {
    const { data } = await client.query({
      query: GET_SALES_BY_ITEMS,
      variables: { start, end },
      fetchPolicy: "network-only",
    })
    const nodes: SalesByItemNode[] = (data as any)?.salesByItemTable || []

    addTitleRows(sheet, title, range, 5, outlets)
    sheet.columns = [
      { width: 28 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
    ]
    const headerRow = sheet.addRow([
      "Item",
      "SKU",
      "Quantity sold",
      "Sales",
      "Discounts",
    ])
    styleHeaderRow(headerRow)
    nodes.forEach((n) =>
      sheet.addRow([n.name, n.sku, n.quantitySold, n.salesExTax, n.discounts])
    )
    const totalRow = sheet.addRow([
      "TOTAL",
      "",
      nodes.reduce((sum, n) => sum + n.quantitySold, 0),
      nodes.reduce((sum, n) => sum + n.salesExTax, 0),
      nodes.reduce((sum, n) => sum + n.discounts, 0),
    ])
    totalRow.font = { bold: true }
  } else if (activeTab === "transactions") {
    const { data } = await client.query({
      query: GET_SALES_TRANSACTIONS,
      variables: { first: 500, start, end },
      fetchPolicy: "network-only",
    })
    const nodes: SalesTransactionNode[] =
      (data as any)?.salesTransactionTable?.edges?.map((e: any) => e.node) || []

    addTitleRows(sheet, title, range, 9, outlets)
    sheet.columns = [
      { width: 14 },
      { width: 20 },
      { width: 28 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ]
    const headerRow = sheet.addRow([
      "Order total",
      "User",
      "Item",
      "SKU",
      "Quantity sold",
      "Sales",
      "Discounts",
      "Purchase cost",
      "Gross profit",
    ])
    styleHeaderRow(headerRow)

    let qtyTotal = 0
    let salesTotal = 0
    let discountsTotal = 0
    nodes.forEach((sale) => {
      const orderRow = sheet.addRow([sale.total, sale.byName])
      orderRow.font = { bold: true }
      sale.items.forEach((item) => {
        sheet.addRow([
          "",
          "",
          item.name,
          item.sku,
          item.quantitySold,
          item.sales,
          item.discounts,
          "N/A",
          "N/A",
        ])
        qtyTotal += item.quantitySold
        salesTotal += item.sales
        discountsTotal += item.discounts
      })
    })
    const totalRow = sheet.addRow([
      nodes.reduce((sum, s) => sum + s.total, 0),
      "",
      "",
      "",
      qtyTotal,
      salesTotal,
      discountsTotal,
      "N/A",
      "N/A",
    ])
    totalRow.font = { bold: true }
  } else {
    // by-category / users share the same shape
    const { data } = await client.query({
      query: GET_DASHBOARD_BREAKDOWN,
      variables: { start, end },
      fetchPolicy: "network-only",
    })
    const nodes: TotalPoint[] =
      (activeTab === "by-category"
        ? (data as any)?.dashboardSummary?.salesByProductType
        : (data as any)?.dashboardSummary?.salesByTeam) || []
    const labelHeader = activeTab === "by-category" ? "Category" : "User"

    addTitleRows(sheet, title, range, 2, outlets)
    sheet.columns = [{ width: 28 }, { width: 16 }]
    const headerRow = sheet.addRow([labelHeader, "Sales"])
    styleHeaderRow(headerRow)
    nodes.forEach((n) => sheet.addRow([n.label, n.total]))
    const totalRow = sheet.addRow([
      "TOTAL",
      nodes.reduce((sum, n) => sum + n.total, 0),
    ])
    totalRow.font = { bold: true }
  }

  await downloadExcelWorkbook(workbook, title, range)
}

async function exportSalesReportPdf({
  client,
  activeTab,
  range,
  userName,
}: {
  client: ReturnType<typeof useApolloClient>
  activeTab: string
  range: DateRange
  userName: string
}) {
  const start = startOfDay(range.from || startOfToday()).toISOString()
  const end = endOfDay(range.to || range.from || startOfToday()).toISOString()
  const title = TAB_LABELS[activeTab] || "Sales Report"

  const { data: outletsData } = await client.query({
    query: GET_SALES_OUTLETS,
    variables: { start, end },
    fetchPolicy: "network-only",
  })
  const outlets: string[] = (outletsData as any)?.salesOutlets || []

  const doc = new jsPDF({
    orientation: activeTab === "transactions" ? "landscape" : "portrait",
    unit: "pt",
  })
  const startY = addPdfHeader(doc, title, range, outlets)
  const tableStyles = pdfTableStyles

  if (activeTab === "transactions") {
    const { data } = await client.query({
      query: GET_SALES_TRANSACTIONS,
      variables: { first: 500, start, end },
      fetchPolicy: "network-only",
    })
    const nodes: SalesTransactionNode[] =
      (data as any)?.salesTransactionTable?.edges?.map((e: any) => e.node) || []

    autoTable(doc, {
      startY,
      head: [
        [
          "Order #",
          "Date",
          "Time",
          "Customer name",
          "Items (Quantity)",
          "Outlet",
          "Status",
          "Payment types",
          "Order total",
          "User",
        ],
      ],
      body: nodes.map((sale) => [
        sale.saleNumber,
        sale.date ? format(Number(sale.date), "dd MMM yyyy") : "-",
        sale.date ? format(Number(sale.date), "h:mmaaa") : "-",
        sale.customerName,
        sale.itemsSummary || "-",
        sale.outletName,
        sale.isOnAccount ? "On Account" : sale.currentSaleStatus,
        sale.paymentTypes?.join(", ") || "-",
        pdfCurrency(sale.total),
        sale.byName,
      ]),
      columnStyles: { 8: { halign: "right" } },
      ...tableStyles,
    })
  } else if (activeTab === "summary") {
    const [{ data: summaryData }, { data: breakdownData }] = await Promise.all([
      client.query({
        query: GET_PAYMENT_SUMMARY,
        variables: { start, end },
        fetchPolicy: "network-only",
      }),
      client.query({
        query: GET_DASHBOARD_BREAKDOWN,
        variables: {
          start,
          end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        fetchPolicy: "network-only",
      }),
    ])
    const summary = (summaryData as any)?.paymentSummary
    const salesByDate =
      (breakdownData as any)?.dashboardSummary?.salesByDate || []

    autoTable(doc, {
      startY,
      head: [["Sales", "Refunds", "Discounts", "Net Sales"]],
      body: [
        [
          pdfCurrency(summary?.salesInc),
          pdfCurrency(summary?.refunds),
          pdfCurrency(summary?.discounts),
          pdfCurrency(summary?.netSales),
        ],
      ],
      ...tableStyles,
    })
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Date", "Sales", "Transactions", "Avg. sale value"]],
      body: salesByDate.map((point: any) => [
        point.label,
        pdfCurrency(point.total),
        point.count,
        pdfCurrency(point.count ? point.total / point.count : 0),
      ]),
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
      ...tableStyles,
    })
  } else if (activeTab === "by-items") {
    const { data } = await client.query({
      query: GET_SALES_BY_ITEMS,
      variables: { start, end },
      fetchPolicy: "network-only",
    })
    const nodes: SalesByItemNode[] = (data as any)?.salesByItemTable || []

    autoTable(doc, {
      startY,
      head: [["Item", "SKU", "Quantity sold", "Sales", "Discounts"]],
      body: nodes.map((n) => [
        n.name,
        n.sku,
        n.quantitySold,
        pdfCurrency(n.salesExTax),
        pdfCurrency(n.discounts),
      ]),
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
      ...tableStyles,
    })
  } else {
    const { data } = await client.query({
      query: GET_DASHBOARD_BREAKDOWN,
      variables: { start, end },
      fetchPolicy: "network-only",
    })
    const nodes: TotalPoint[] =
      (activeTab === "by-category"
        ? (data as any)?.dashboardSummary?.salesByProductType
        : (data as any)?.dashboardSummary?.salesByTeam) || []
    const labelHeader = activeTab === "by-category" ? "Category" : "User"

    autoTable(doc, {
      startY,
      head: [[labelHeader, "Sales"]],
      body: nodes.map((n) => [n.label, pdfCurrency(n.total)]),
      columnStyles: { 1: { halign: "right" } },
      ...tableStyles,
    })
  }

  addPdfFooter(doc, title, userName)
  savePdfDocument(doc, title, range)
}

function ExportButton({
  activeTab,
  range,
}: {
  activeTab: string
  range: DateRange
}) {
  const client = useApolloClient()
  const { data: session } = useSession()
  const userName = (session as any)?.user?.name || "Unknown"
  const [isExporting, setIsExporting] = useState(false)

  const handleExcelExport = async () => {
    setIsExporting(true)
    try {
      await exportSalesReportExcel({ client, activeTab, range })
    } catch (error: any) {
      toast.error(error.message || "Failed to export.")
    } finally {
      setIsExporting(false)
    }
  }

  const handlePdfExport = async () => {
    setIsExporting(true)
    try {
      await exportSalesReportPdf({ client, activeTab, range, userName })
    } catch (error: any) {
      toast.error(error.message || "Failed to export.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="cursor-pointer gap-1.5 rounded-[10px]"
          disabled={isExporting}
        >
          <DownloadSimpleIcon />
          {isExporting ? "Exporting..." : "Export"}
          <CaretDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleExcelExport}>
          <FileXlsIcon />
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handlePdfExport}>
          <FilePdfIcon />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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

function DailySalesTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  const avg = point.count ? point.total / point.count : 0
  return (
    <div className="grid min-w-48 gap-1.5 rounded-none border border-border/50 bg-background px-3 py-2.5 text-xs shadow-xl">
      <span className="font-medium text-foreground">{point.label}</span>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Sales</span>
        <span className="font-mono font-semibold text-foreground">
          {currency(point.total)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Avg. sale value</span>
        <span className="font-mono">{currency(avg)}</span>
      </div>
    </div>
  )
}

const chartConfig = { total: { label: "Sales", color: "var(--chart-2)" } }

// Generic client-side sortable/paginated table for the small aggregate lists
// (By Category, Users, By Items) that don't need server-side pagination.
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
  const [rows, setRows] = useState<number>(10)
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
                <SelectItem value="10">10</SelectItem>
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

function SalesSummaryTab({ range }: { range: DateRange }) {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  )
  const variables = {
    start: startOfDay(range.from || startOfToday()).toISOString(),
    end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
  }
  const { data: summaryData, loading: summaryLoading } = useQuery(
    GET_PAYMENT_SUMMARY,
    { variables, fetchPolicy: "network-only" }
  )
  const { data: breakdownData, loading: breakdownLoading } = useQuery(
    GET_DASHBOARD_BREAKDOWN,
    { variables: { ...variables, timezone }, fetchPolicy: "network-only" }
  )
  const summary = (summaryData as any)?.paymentSummary
  const salesByDate =
    (breakdownData as any)?.dashboardSummary?.salesByDate || []

  return (
    <div className="flex flex-col gap-2.5 pt-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <SummaryCard
          icon={<ChartLineUpIcon />}
          label="Sales"
          value={currency(summary?.salesInc)}
          loading={summaryLoading}
        />
        <SummaryCard
          icon={<ReceiptXIcon />}
          label="Refunds"
          value={currency(summary?.refunds)}
          loading={summaryLoading}
        />
        <SummaryCard
          icon={<TagIcon />}
          label="Discounts"
          value={currency(summary?.discounts)}
          loading={summaryLoading}
        />
        <SummaryCard
          icon={<ReceiptIcon />}
          label="Net Sales"
          value={currency(summary?.netSales)}
          loading={summaryLoading}
        />
      </div>
      <Card className="rounded-lg">
        <CardContent>
          {breakdownLoading ? (
            <Skeleton className="h-72 w-full rounded-lg" />
          ) : !salesByDate.some((p: any) => p.total > 0) ? (
            <div className="flex h-72 w-full items-center justify-center text-sm text-muted-foreground">
              No sales in this period.
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-72 w-full"
            >
              <BarChart data={salesByDate}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={compactCurrency}
                  width={64}
                />
                <ChartTooltip
                  content={<DailySalesTooltip />}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="total"
                  fill="var(--color-total)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type SalesByItemNode = {
  _id: string
  name: string
  sku: string
  quantitySold: number
  salesExTax: number
  discounts: number
}

function SalesByItemsTab({ range }: { range: DateRange }) {
  const { data, loading } = useQuery(GET_SALES_BY_ITEMS, {
    variables: {
      start: startOfDay(range.from || startOfToday()).toISOString(),
      end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
    },
    fetchPolicy: "network-only",
  })
  const nodes: SalesByItemNode[] = (data as any)?.salesByItemTable || []

  const columns: ColumnDef<SalesByItemNode>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Item",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "sku",
        header: "SKU",
        cell: ({ row }) => row.original.sku || "-",
      },
      {
        id: "quantitySold",
        header: "Quantity sold",
        cell: ({ row }) => row.original.quantitySold,
      },
      {
        id: "salesExTax",
        header: "Sales",
        cell: ({ row }) => currency(row.original.salesExTax),
      },
      {
        id: "discounts",
        header: "Discounts",
        cell: ({ row }) => currency(row.original.discounts),
      },
    ],
    []
  )

  return (
    <div className="pt-4">
      <TotalsTable
        data={nodes}
        loading={loading}
        columns={columns}
        emptyLabel="No items sold in this period."
      />
    </div>
  )
}

type TotalPoint = { key: string; label: string; total: number }

function ByCategoryTab({ range }: { range: DateRange }) {
  const { data, loading } = useQuery(GET_DASHBOARD_BREAKDOWN, {
    variables: {
      start: startOfDay(range.from || startOfToday()).toISOString(),
      end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
    },
    fetchPolicy: "network-only",
  })
  const nodes: (TotalPoint & { _id: string })[] = (
    (data as any)?.dashboardSummary?.salesByProductType || []
  ).map((point: TotalPoint) => ({ ...point, _id: point.key }))

  const columns: ColumnDef<TotalPoint & { _id: string }>[] = useMemo(
    () => [
      {
        id: "label",
        header: "Category",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.label}</span>
        ),
      },
      {
        id: "total",
        header: "Sales",
        cell: ({ row }) => currency(row.original.total),
      },
    ],
    []
  )

  return (
    <div className="pt-4">
      <TotalsTable
        data={nodes}
        loading={loading}
        columns={columns}
        emptyLabel="No sales in this period."
      />
    </div>
  )
}

function UsersTab({ range }: { range: DateRange }) {
  const { data, loading } = useQuery(GET_DASHBOARD_BREAKDOWN, {
    variables: {
      start: startOfDay(range.from || startOfToday()).toISOString(),
      end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
    },
    fetchPolicy: "network-only",
  })
  const nodes: (TotalPoint & { _id: string })[] = (
    (data as any)?.dashboardSummary?.salesByTeam || []
  ).map((point: TotalPoint) => ({ ...point, _id: point.key }))

  const columns: ColumnDef<TotalPoint & { _id: string }>[] = useMemo(
    () => [
      {
        id: "label",
        header: "User",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.label}</span>
        ),
      },
      {
        id: "total",
        header: "Sales",
        cell: ({ row }) => currency(row.original.total),
      },
    ],
    []
  )

  return (
    <div className="pt-4">
      <TotalsTable
        data={nodes}
        loading={loading}
        columns={columns}
        emptyLabel="No sales in this period."
      />
    </div>
  )
}

type SalesTransactionItem = {
  name: string
  sku: string
  quantitySold: number
  sales: number
  discounts: number
}

type SalesTransactionNode = {
  _id: string
  saleNumber: string
  date: string
  customerName: string
  itemsSummary: string
  items: SalesTransactionItem[]
  outletName: string
  currentSaleStatus: string
  isOnAccount: boolean
  paymentTypes: string[]
  total: number
  byName: string
}

function SalesTransactionsTab({ range }: { range: DateRange }) {
  const [rows, setRows] = useState<number>(10)
  const [page, setPage] = useState<{
    current: number
    loaded: number
    max: number
  }>({
    current: 1,
    loaded: 1,
    max: 1,
  })
  const [search, setSearch] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [sort, setSort] = useState<{
    key: string
    order: "ASC" | "DESC"
  } | null>(null)

  const variables = {
    first: rows,
    search,
    start: startOfDay(range.from || startOfToday()).toISOString(),
    end: endOfDay(range.to || range.from || startOfToday()).toISOString(),
    sort,
  }

  const { data, fetchMore, loading } = useQuery(GET_SALES_TRANSACTIONS, {
    variables,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  })

  const { total, nodes, endCursor } = useMemo(() => {
    const result = data as any
    const nodes =
      result?.salesTransactionTable?.edges?.map((edge: any) => edge.node) || []
    const endCursor = result?.salesTransactionTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.salesTransactionTable?.pages || 1,
    }))

    return {
      total: result?.salesTransactionTable?.total || 0,
      nodes,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<SalesTransactionNode>[] = useMemo(
    () => [
      {
        id: "saleNumber",
        header: () => (
          <SortHeader
            label="Order #"
            sortKey="saleNumber"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-primary">
            {row.original.saleNumber}
          </span>
        ),
      },
      {
        id: "date",
        header: () => (
          <SortHeader
            label="Date"
            sortKey="date"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.date
              ? format(Number(row.original.date), "PP · p")
              : "-"}
          </span>
        ),
      },
      {
        id: "customerName",
        header: "Customer",
        cell: ({ row }) => <CustomerBadge name={row.original.customerName} />,
      },
      {
        id: "itemsSummary",
        header: "Items (Quantity)",
        // A multi-item sale runs long enough to push the columns after it off
        // screen, so the list is clamped and the full text moved to the
        // tooltip. The PDF export still writes it out in full.
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block max-w-[22rem] truncate text-muted-foreground">
                {row.original.itemsSummary || "-"}
              </span>
            </TooltipTrigger>
            {!!row.original.itemsSummary && (
              <TooltipContent className="max-w-sm">
                <p>{row.original.itemsSummary}</p>
              </TooltipContent>
            )}
          </Tooltip>
        ),
      },
      {
        id: "currentSaleStatus",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.currentSaleStatus} />
        ),
      },
      {
        id: "paymentTypes",
        header: "Payment Types",
        cell: ({ row }) => row.original.paymentTypes?.join(", ") || "-",
      },
      {
        id: "total",
        header: () => (
          <div className="text-right">
            <SortHeader
              label="Order total"
              sortKey="total"
              sortState={sort}
              onSortChange={setSort}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {currency(row.original.total)}
          </div>
        ),
      },
      {
        id: "byName",
        header: "User",
        cell: ({ row }) => row.original.byName,
      },
    ],
    [sort]
  )

  const resetPage = () => setPage({ current: 1, loaded: 1, max: 1 })

  const onSearch = useCallback((value: string) => {
    setSearch(value)
    resetPage()
  }, [])

  const onNextPage = async () => {
    if (page.current == page.loaded) {
      await fetchMore({
        variables: { ...variables, after: endCursor },
        updateQuery: (prev: any, { fetchMoreResult: more }: any) => {
          if (!more) return prev
          const cursorSet = new Set([
            ...prev.salesTransactionTable.edges.map((edge: any) => edge.cursor),
            ...more.salesTransactionTable.edges.map((edge: any) => edge.cursor),
          ])
          const filteredEdges = [
            ...prev.salesTransactionTable.edges,
            ...more.salesTransactionTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          return {
            salesTransactionTable: {
              ...more.salesTransactionTable,
              edges: filteredEdges,
              pageInfo: more.salesTransactionTable.pageInfo,
            },
          }
        },
      })
      setPage((prev) => ({ ...prev, loaded: prev.loaded + 1 }))
    }
    setPage((prev) => ({ ...prev, current: prev.current + 1 }))
  }

  const onPrevPage = () => {
    if (page.current === 1) return
    setPage((prev) => ({ ...prev, current: prev.current - 1 }))
  }

  return (
    <div className="flex flex-col gap-1.5 pt-4">
      <InputGroup>
        <InputGroupInput
          data-search-input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          placeholder="Find by order number..."
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch(searchTerm)
            if (e.key === "Escape") {
              setSearchTerm("")
              onSearch("")
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={() => onSearch(searchTerm)}>
            <MagnifyingGlassIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <div className="flex items-center justify-between">
        <span className="text-sm">
          Showing {total === 0 ? 0 : (page.current - 1) * rows + 1}-
          {page.current === page.max ? total : page.current * rows} out of{" "}
          {total} result{total === 1 ? "" : "s"}.
        </span>
        <div className="flex gap-1.5">
          <Select
            value={rows.toString()}
            onValueChange={(value) => {
              setRows(Number(value))
              resetPage()
            }}
          >
            <SelectTrigger className="w-18">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <ButtonGroup>
            <Button
              onClick={onPrevPage}
              disabled={page.current === 1}
              variant="outline"
            >
              Prev
            </Button>
            <ButtonGroupText>{`Page ${page.current} of ${page.max}`}</ButtonGroupText>
            <Button
              onClick={onNextPage}
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
        data={nodes.slice((page.current - 1) * rows, page.current * rows)}
        rowView={<SaleRowViewDialog external />}
      />
    </div>
  )
}

export default function Page() {
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: startOfToday(),
    to: startOfToday(),
  })
  const [presetLabel, setPresetLabel] = useState("Today")
  const [activeTab, setActiveTab] = useState("summary")

  return (
    <div className="flex h-full w-full flex-col gap-1.5 p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <Label className="text-xl font-medium">Sales</Label>
        <div className="flex items-center gap-1.5">
          <DateRangeFilter
            appliedRange={appliedRange}
            presetLabel={presetLabel}
            onApply={(range, label) => {
              setAppliedRange(range)
              setPresetLabel(label)
            }}
          />
          <ExportButton activeTab={activeTab} range={appliedRange} />
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="summary">Sales Summary</TabsTrigger>
          <TabsTrigger value="by-items">Sales (By Items)</TabsTrigger>
          <TabsTrigger value="transactions">Sales Transactions</TabsTrigger>
          <TabsTrigger value="by-category">By Category</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <SalesSummaryTab range={appliedRange} />
        </TabsContent>
        <TabsContent value="by-items">
          <SalesByItemsTab range={appliedRange} />
        </TabsContent>
        <TabsContent value="transactions">
          <SalesTransactionsTab range={appliedRange} />
        </TabsContent>
        <TabsContent value="by-category">
          <ByCategoryTab range={appliedRange} />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab range={appliedRange} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
