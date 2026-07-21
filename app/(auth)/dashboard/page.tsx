"use client"
import { useMemo, useState } from "react"
import gql from "graphql-tag"
import { useQuery } from "@apollo/client/react"
import Image from "next/image"
import { ColumnDef } from "@tanstack/react-table"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  startOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from "date-fns"
import { formatDateRange } from "little-date"
import { DateRange } from "react-day-picker"
import {
  CalendarBlankIcon,
  CaretDownIcon,
  ChartLineUpIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import DataTable from "@/components/custom/data-table"
import SortHeader from "@/components/custom/sort-header"
import type { Sort } from "@/types/shared.type"

const GET_DASHBOARD_SUMMARY = gql`
  query DashboardSummary($start: String!, $end: String!, $timezone: String) {
    dashboardSummary(start: $start, end: $end, timezone: $timezone) {
      totalSales
      totalTransactions
      avgSaleValue
      newCustomers
      salesByDate {
        key
        label
        total
        count
        paid
        unpaid
        partiallyPaid
      }
      salesByHour {
        key
        label
        total
        count
        paid
        unpaid
        partiallyPaid
      }
      salesByWeekday {
        key
        label
        total
      }
      salesByProductType {
        key
        label
        total
      }
      salesByTeam {
        key
        label
        image
        total
      }
    }
  }
`

const DATE_PRESETS: { label: string; getRange: () => DateRange }[] = [
  { label: "Today", getRange: () => ({ from: startOfToday(), to: startOfToday() }) },
  {
    label: "This Week",
    getRange: () => ({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) }),
  },
  {
    label: "Last 7 Days",
    getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: "This Month",
    getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
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

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0)

const compactCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0)

type SalesPoint = {
  key: string
  label: string
  total: number
  count: number
  paid: number
  unpaid: number
  partiallyPaid: number
}

type CategoryPoint = {
  key: string
  label: string
  total: number
}

type TeamPoint = {
  key: string
  label: string
  image?: string | null
  total: number
}

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  loading: boolean
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          {loading ? (
            <Skeleton className="h-6 w-24" />
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

function SalesTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point: SalesPoint | undefined = payload[0]?.payload
  if (!point) return null
  const avgSaleValue = point.count ? point.total / point.count : 0
  return (
    <div className="grid min-w-52 gap-2 rounded-none border border-border/50 bg-background px-3 py-2.5 text-xs shadow-xl">
      <span className="font-medium text-foreground">{point.label}</span>
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium text-foreground">Sales</span>
          <span className="font-mono font-semibold text-foreground">
            {currency(point.total)}
          </span>
        </div>
        <div className="ml-2 flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Paid</span>
          <span className="font-mono">{currency(point.paid)}</span>
        </div>
        <div className="ml-2 flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Partially paid</span>
          <span className="font-mono">{currency(point.partiallyPaid)}</span>
        </div>
        <div className="ml-2 flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Unpaid</span>
          <span className="font-mono">{currency(point.unpaid)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-1.5">
        <span className="font-medium text-foreground">Avg. sale value</span>
        <span className="font-mono font-semibold text-foreground">
          {currency(avgSaleValue)}
        </span>
      </div>
    </div>
  )
}

function DonutTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null
  const point: CategoryPoint | undefined = payload[0]?.payload
  if (!point) return null
  const pct = total ? ((point.total / total) * 100).toFixed(2) : "0.00"
  return (
    <div className="grid gap-1 rounded-none border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <span className="font-medium">{point.label}</span>
      <span className="font-mono text-base font-semibold text-foreground">{pct}%</span>
    </div>
  )
}

function EmptyChartState() {
  return (
    <div className="flex h-72 w-full items-center justify-center text-sm text-muted-foreground">
      No sales in this period.
    </div>
  )
}

function CategoryDonut({
  data,
  loading,
}: {
  data?: CategoryPoint[]
  loading: boolean
}) {
  if (loading) return <Skeleton className="h-72 w-full" />
  const points = (data || []).filter((point) => point.total > 0)
  if (!points.length) return <EmptyChartState />
  const total = points.reduce((sum, point) => sum + point.total, 0)

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-4 sm:flex-row">
      <PieChart width={260} height={260}>
        <Pie
          data={points}
          dataKey="total"
          nameKey="label"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={points.length > 1 ? 2 : 0}
          strokeWidth={0}
        >
          {points.map((point, index) => (
            <Cell key={point.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <ChartTooltip content={<DonutTooltip total={total} />} />
      </PieChart>
      <div className="grid gap-2">
        {points.map((point, index) => (
          <div key={point.key} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="min-w-28 text-foreground">{point.label}</span>
            <span className="font-mono text-muted-foreground">
              {currency(point.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamTable({ data, loading }: { data?: TeamPoint[]; loading: boolean }) {
  const [rows, setRows] = useState<number>(5)
  const [page, setPage] = useState<{ current: number; max: number }>({
    current: 1,
    max: 1,
  })
  const [sort, setSort] = useState<Sort | null>({ key: "total", order: "DESC" })

  const points = useMemo(() => data || [], [data])
  const grandTotal = points.reduce((sum, point) => sum + point.total, 0)

  const sorted = useMemo(() => {
    if (!sort) return points
    const copy = [...points]
    copy.sort((a, b) => {
      const result =
        sort.key === "total"
          ? a.total - b.total
          : a.label.localeCompare(b.label)
      return sort.order === "ASC" ? result : -result
    })
    return copy
  }, [points, sort])

  const total = sorted.length
  const max = Math.max(1, Math.ceil(total / rows))
  if (max !== page.max)
    setPage((prev) => ({ ...prev, max, current: Math.min(prev.current, max) }))

  const columns: ColumnDef<TeamPoint>[] = useMemo(
    () => [
      {
        id: "image",
        cell: ({ row }) =>
          row.original.image ? (
            <Image
              src={row.original.image}
              alt={row.original.label}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <Avatar className="h-8 w-8">
              <AvatarFallback>{row.original.label[0]}</AvatarFallback>
            </Avatar>
          ),
        size: 10,
      },
      {
        id: "label",
        header: () => (
          <SortHeader
            label="Member"
            sortKey="label"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.label}</span>
        ),
      },
      {
        id: "total",
        header: () => (
          <SortHeader
            label="Sales"
            sortKey="total"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono">{currency(row.original.total)}</span>
        ),
      },
      {
        id: "rate",
        header: () => <span>Rate (%)</span>,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {grandTotal ? ((row.original.total / grandTotal) * 100).toFixed(2) : "0.00"}
            %
          </span>
        ),
      },
    ],
    [sort, grandTotal]
  )

  if (!loading && !points.length) return <EmptyChartState />

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {(page.current - 1) * rows + 1}-
          {page.current === page.max ? total : page.current * rows} out of {total}{" "}
          member{total === 1 ? "" : "s"}.
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
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <ButtonGroup>
            <Button
              onClick={() => setPage((prev) => ({ ...prev, current: prev.current - 1 }))}
              disabled={page.current === 1}
              variant="outline"
            >
              Prev
            </Button>
            <ButtonGroupText>{`Page ${page.current} of ${page.max}`}</ButtonGroupText>
            <Button
              onClick={() => setPage((prev) => ({ ...prev, current: prev.current + 1 }))}
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
        data={sorted.slice((page.current - 1) * rows, page.current * rows)}
        noFooter
      />
    </div>
  )
}

const chartConfig = { total: { label: "Sales", color: "var(--chart-2)" } }

export default function Page() {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  )
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: startOfToday(),
    to: startOfToday(),
  })
  const [presetLabel, setPresetLabel] = useState("Today")
  const [stagedRange, setStagedRange] = useState<DateRange | undefined>(appliedRange)
  const [open, setOpen] = useState(false)

  const { data, loading } = useQuery(GET_DASHBOARD_SUMMARY, {
    variables: {
      start: (appliedRange.from || startOfToday()).toISOString(),
      end: (appliedRange.to || appliedRange.from || startOfToday()).toISOString(),
      timezone,
    },
    fetchPolicy: "network-only",
  })

  const summary = (data as any)?.dashboardSummary

  return (
    <div className="flex h-full w-full flex-col gap-2.5 p-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xl font-medium">Dashboard</Label>
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
          <PopoverContent className="w-auto p-0 pt-4 px-1" align="end">
            <div className="flex">
              <div className="flex flex-col gap-1 border-r p-2 pr-3">
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="justify-start font-normal"
                    onClick={() => {
                      setAppliedRange(preset.getRange())
                      setPresetLabel(preset.label)
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
                      setAppliedRange(stagedRange)
                      setPresetLabel("Custom")
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
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          icon={<ChartLineUpIcon />}
          label="Sales"
          value={currency(summary?.totalSales)}
          loading={loading}
        />
        <StatCard
          icon={<ReceiptIcon />}
          label="Transactions"
          value={summary?.totalTransactions ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<ShoppingCartIcon />}
          label="Avg. sale value"
          value={currency(summary?.avgSaleValue)}
          loading={loading}
        />
        <StatCard
          icon={<UsersThreeIcon />}
          label="New customers"
          value={summary?.newCustomers ?? 0}
          loading={loading}
        />
      </div>

      <Card className="flex-1">
        <CardContent>
          <Tabs defaultValue="sales">
            <TabsList variant="line">
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="product-types">Product types</TabsTrigger>
              <TabsTrigger value="days">Days</TabsTrigger>
              <TabsTrigger value="time">Time</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="pt-4">
              {loading ? (
                <Skeleton className="h-72 w-full" />
              ) : !summary?.salesByDate?.some((p: SalesPoint) => p.total > 0) ? (
                <EmptyChartState />
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
                  <AreaChart data={summary.salesByDate}>
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
                    <ChartTooltip content={<SalesTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="var(--color-total)"
                      fill="var(--color-total)"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </TabsContent>

            <TabsContent value="product-types" className="pt-4">
              <CategoryDonut data={summary?.salesByProductType} loading={loading} />
            </TabsContent>

            <TabsContent value="days" className="pt-4">
              <CategoryDonut data={summary?.salesByWeekday} loading={loading} />
            </TabsContent>

            <TabsContent value="time" className="pt-4">
              {loading ? (
                <Skeleton className="h-72 w-full" />
              ) : !summary?.salesByHour?.some((p: SalesPoint) => p.total > 0) ? (
                <EmptyChartState />
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
                  <BarChart data={summary.salesByHour}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval={2}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={compactCurrency}
                      width={64}
                    />
                    <ChartTooltip
                      content={<SalesTooltip />}
                      cursor={{ fill: "var(--muted)" }}
                    />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </TabsContent>

            <TabsContent value="team" className="pt-4">
              <TeamTable data={summary?.salesByTeam} loading={loading} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
