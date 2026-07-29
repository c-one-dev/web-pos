"use client"
import { Label } from "@/components/ui/label"
import { useCallback, useMemo, useState } from "react"
import gql from "graphql-tag"
import { useQuery } from "@apollo/client/react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  ArrowElbowDownRightIcon,
  CalculatorIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  ChartLineUpIcon,
  CoinsIcon,
  CurrencyCircleDollarIcon,
  GearIcon,
  MagnifyingGlassIcon,
  PercentIcon,
  ReceiptIcon,
  ReceiptXIcon,
  TagIcon,
  TruckIcon,
} from "@phosphor-icons/react"
import { IPaymentNode } from "@/types/payment.type"
import { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/custom/data-table"
import ColumnFilter from "@/components/custom/column-filter"
import { FilterType } from "@/types/shared.type"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import SortHeader from "@/components/custom/sort-header"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  startOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
} from "date-fns"
import { formatDateRange } from "little-date"
import { DateRange } from "react-day-picker"
import RowViewDialog from "./_dialogs/row-view"
import UpdatePaymentNoteDialog from "./_dialogs/update-note"

const GET_PAYMENT_SUMMARY = gql`
  query PaymentSummary($start: String!, $end: String!) {
    paymentSummary(start: $start, end: $end) {
      salesInc
      salesEx
      refunds
      discounts
      netSales
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

function SummaryCard({
  icon,
  label,
  value,
  loading,
  tooltip,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  loading?: boolean
  tooltip?: string
}) {
  const card = (
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

  if (!tooltip) return card

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
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

function PaymentSummaryTab() {
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: startOfToday(),
    to: startOfToday(),
  })
  const [presetLabel, setPresetLabel] = useState("Today")

  const { data, loading } = useQuery(GET_PAYMENT_SUMMARY, {
    variables: {
      start: (appliedRange.from || startOfToday()).toISOString(),
      end: (
        appliedRange.to ||
        appliedRange.from ||
        startOfToday()
      ).toISOString(),
    },
    fetchPolicy: "network-only",
  })

  const summary = (data as any)?.paymentSummary

  return (
    <div className="flex flex-col gap-2.5 pt-4">
      <div className="flex items-center justify-end">
        <DateRangeFilter
          appliedRange={appliedRange}
          presetLabel={presetLabel}
          onApply={(range, label) => {
            setAppliedRange(range)
            setPresetLabel(label)
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          icon={<ChartLineUpIcon />}
          label="Sales (Inc)"
          value={currency(summary?.salesInc)}
          loading={loading}
        />
        <SummaryCard
          icon={<ChartLineUpIcon />}
          label="Sales (Ex)"
          value={currency(summary?.salesEx)}
          loading={loading}
        />
        <SummaryCard
          icon={<ReceiptXIcon />}
          label="Refunds"
          value={currency(summary?.refunds)}
          loading={loading}
          tooltip="This app has no refund feature — always ₱0.00."
        />
        <SummaryCard
          icon={<TagIcon />}
          label="Discounts"
          value={currency(summary?.discounts)}
          loading={loading}
        />
        <SummaryCard
          icon={<ReceiptIcon />}
          label="Net Sales"
          value={currency(summary?.netSales)}
          loading={loading}
        />
        <SummaryCard
          icon={<CalculatorIcon />}
          label="COGS"
          value="N/A"
          tooltip="Requires a product cost field, which doesn't exist yet."
        />
        <SummaryCard
          icon={<CoinsIcon />}
          label="Gross Profit"
          value="N/A"
          tooltip="Requires a product cost field, which doesn't exist yet."
        />
        <SummaryCard
          icon={<PercentIcon />}
          label="Margin %"
          value="N/A"
          tooltip="Requires a product cost field, which doesn't exist yet."
        />
        <SummaryCard
          icon={<CurrencyCircleDollarIcon />}
          label="Net Sales Tax"
          value={currency(0)}
          tooltip="This app has no tax feature — always ₱0.00."
        />
        <SummaryCard
          icon={<TruckIcon />}
          label="Surcharge / Shipping"
          value={currency(0)}
          tooltip="This app has no surcharge/shipping feature — always ₱0.00."
        />
      </div>
    </div>
  )
}

const GET_PAYMENT_TYPE_SUMMARY = gql`
  query PaymentTypeSummary($start: String!, $end: String!) {
    paymentTypeSummary(start: $start, end: $end) {
      _id
      name
      totalCollected
      refunds
      net
    }
  }
`

type PaymentTypeSummaryNode = {
  _id: string
  name: string
  totalCollected: number
  refunds: number
  net: number
}

function PaymentTypesTab() {
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: startOfToday(),
    to: startOfToday(),
  })
  const [presetLabel, setPresetLabel] = useState("Today")
  const [rows, setRows] = useState<number>(8)
  const [page, setPage] = useState<number>(1)
  const [sort, setSort] = useState<{
    key: string
    order: "ASC" | "DESC"
  } | null>(null)

  const { data, loading } = useQuery(GET_PAYMENT_TYPE_SUMMARY, {
    variables: {
      start: (appliedRange.from || startOfToday()).toISOString(),
      end: (
        appliedRange.to ||
        appliedRange.from ||
        startOfToday()
      ).toISOString(),
    },
    fetchPolicy: "network-only",
  })

  const nodes: PaymentTypeSummaryNode[] = useMemo(() => {
    const result: PaymentTypeSummaryNode[] =
      (data as any)?.paymentTypeSummary || []
    if (!sort) return result
    const sorted = [...result].sort((a, b) => {
      const aValue = a[sort.key as keyof PaymentTypeSummaryNode]
      const bValue = b[sort.key as keyof PaymentTypeSummaryNode]
      if (aValue < bValue) return sort.order === "ASC" ? -1 : 1
      if (aValue > bValue) return sort.order === "ASC" ? 1 : -1
      return 0
    })
    return sorted
  }, [data, sort])

  const total = nodes.length
  const maxPage = Math.max(Math.ceil(total / rows), 1)

  const columns: ColumnDef<PaymentTypeSummaryNode>[] = useMemo(
    () => [
      {
        id: "name",
        header: () => (
          <SortHeader
            label="Payment type"
            sortKey="name"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "totalCollected",
        header: () => (
          <SortHeader
            label="Total collected"
            sortKey="totalCollected"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => currency(row.original.totalCollected),
      },
      {
        id: "refunds",
        header: () => (
          <SortHeader
            label="Refunds"
            sortKey="refunds"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => currency(row.original.refunds),
      },
      {
        id: "net",
        header: () => (
          <SortHeader
            label="Net"
            sortKey="net"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{currency(row.original.net)}</span>
        ),
      },
    ],
    [sort]
  )

  return (
    <div className="flex flex-col gap-1.5 pt-4">
      <div className="flex justify-end">
        <DateRangeFilter
          appliedRange={appliedRange}
          presetLabel={presetLabel}
          onApply={(range, label) => {
            setAppliedRange(range)
            setPresetLabel(label)
            setPage(1)
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">
          Showing {total === 0 ? 0 : (page - 1) * rows + 1}-
          {page === maxPage ? total : page * rows} out of {total} result
          {total === 1 ? "" : "s"}.
        </span>
        <div className="flex gap-1.5">
          <Select
            value={rows.toString()}
            onValueChange={(value) => {
              setRows(Number(value))
              setPage(1)
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
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              variant="outline"
            >
              Prev
            </Button>
            <ButtonGroupText>{`Page ${page} of ${maxPage}`}</ButtonGroupText>
            <Button
              onClick={() => setPage((prev) => Math.min(prev + 1, maxPage))}
              disabled={page === maxPage}
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
        data={nodes.slice((page - 1) * rows, page * rows)}
        noFooter
      />
    </div>
  )
}

const GET_PAYMENTS = gql`
  query PaymentTable(
    $first: Int
    $after: String
    $search: String
    $filter: [Filter]
    $sort: Sort
  ) {
    paymentTable(
      first: $first
      after: $after
      search: $search
      filter: $filter
      sort: $sort
    ) {
      total
      pages
      edges {
        cursor
        node {
          _id
          amount
          note
          byName
          saleList
          methodName
          paymentDate
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

const GET_PAYMENT_METHOD_OPTIONS = gql`
  query PaymentMethodOptions {
    paymentMethodOptions {
      label
      value
    }
  }
`

function Actions({ row }: { row?: IPaymentNode }) {
  const [open, setOpen] = useState(false)
  const data = useMemo(() => row, [row])

  return (
    <DropdownMenu modal open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <GearIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="start">
        <UpdatePaymentNoteDialog
          _id={data?._id?.toString() || ""}
          onClose={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function Page() {
  // Pagination state
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
  // Search state
  const [search, setSearch] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState<string>("")
  // Sorting state
  const [sort, setSort] = useState<{
    key: string
    order: "ASC" | "DESC"
  } | null>(null)
  // Filter state
  const [filter, setFilter] = useState<
    { key: string; value: string; type: FilterType }[]
  >([])
  const { data, fetchMore, loading } = useQuery(GET_PAYMENTS, {
    variables: {
      first: rows,
      search,
      filter,
      sort,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  })
  // Payment Method options for filter dropdown
  const { data: methodOptionsData } = useQuery(GET_PAYMENT_METHOD_OPTIONS, {
    fetchPolicy: "cache-first",
  })
  const paymentMethodOptions = useMemo(
    () => (methodOptionsData as any)?.paymentMethodOptions,
    [methodOptionsData]
  )
  // Responsiveness
  useIsMobile()

  const { total, nodes, endCursor } = useMemo(() => {
    const result = data as any
    const nodes =
      result?.paymentTable?.edges?.map((edge: any) => edge.node) || []
    const hasNextPage = result?.paymentTable?.pageInfo?.hasNextPage || false
    const endCursor = result?.paymentTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.paymentTable?.pages || 1,
    }))

    return {
      total: result?.paymentTable?.total || 0,
      pages: result?.paymentTable?.pages || 0,
      nodes,
      hasNextPage,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<IPaymentNode>[] = useMemo(
    () => [
      {
        id: "saleList",
        header: () => (
          <SortHeader
            label="Receipt #"
            sortKey="saleList"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-primary">
            {row.original.saleList.join(", ") || "—"}
          </span>
        ),
        footer: () => (
          <ColumnFilter
            label="Receipt #"
            filterKey="saleList"
            filterType={FilterType.TEXT}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "paymentDate",
        header: () => (
          <SortHeader
            label="Date & Time"
            sortKey="paymentDate"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.paymentDate
              ? format(Number(row.original.paymentDate), "PP · p")
              : "-"}
          </span>
        ),
      },
      {
        id: "methodName",
        header: () => (
          <SortHeader
            label="Method"
            sortKey="methodName"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.methodName}</span>
        ),
        footer: () => (
          <ColumnFilter
            label="Method"
            filterKey="methodName"
            filterType={FilterType.SELECT}
            filter={filter}
            onFilterChange={onFilter}
            options={paymentMethodOptions}
          />
        ),
      },
      {
        id: "amount",
        header: () => (
          <div className="text-right">
            <SortHeader
              label="Amount"
              sortKey="amount"
              sortState={sort}
              onSortChange={setSort}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <span className="block font-medium">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(row.original.amount)}
            </span>
            {row.original.note && (
              <span className="text-xs text-muted-foreground">
                <ArrowElbowDownRightIcon className="inline" />{" "}
                {row.original.note}
              </span>
            )}
          </div>
        ),
        footer: () => (
          <ColumnFilter
            label="Amount"
            filterKey="amount"
            filterType={FilterType.NUMBER}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "by",
        header: () => (
          <SortHeader
            label="User"
            sortKey="byName"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.byName}</span>
        ),
        footer: () => (
          <ColumnFilter
            label="User"
            filterKey="byName"
            filterType={FilterType.TEXT}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, filter, paymentMethodOptions]
  )

  const resetPage = () => setPage({ current: 1, loaded: 1, max: 1 })

  const onSearch = useCallback((value: string) => {
    setSearch(value)
    resetPage()
  }, [])

  const onFilter = useCallback((value: any) => {
    setFilter(value)
    resetPage()
  }, [])

  const onNextPage = async () => {
    if (page.current == page.loaded) {
      await fetchMore({
        variables: {
          first: rows,
          after: endCursor,
          search,
          filter,
          sort,
        },
        updateQuery: (prev: any, { fetchMoreResult: more }: any) => {
          if (!more) return prev
          const cursorSet = new Set([
            ...prev.paymentTable.edges.map((edge: any) => edge.cursor),
            ...more.paymentTable.edges.map((edge: any) => edge.cursor),
          ])
          const filteredEdges = [
            ...prev.paymentTable.edges,
            ...more.paymentTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.paymentTable.pageInfo
          return {
            paymentTable: {
              ...more.paymentTable,
              edges: filteredEdges,
              pageInfo,
            },
          }
        },
      })
      setPage((prev) => ({
        ...prev,
        loaded: prev.loaded + 1,
      }))
    }
    setPage((prev) => ({
      ...prev,
      current: prev.current + 1,
    }))
  }

  const onPrevPage = () => {
    if (page.current === 1) return
    setPage((prev) => ({
      ...prev,
      current: prev.current - 1,
    }))
  }

  return (
    <div className="flex h-full w-full flex-col gap-1.5 p-2.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xl font-medium">Payment</Label>
      </div>
      <Tabs defaultValue="summary">
        <TabsList variant="line">
          <TabsTrigger value="summary">Payment Summary</TabsTrigger>
          <TabsTrigger value="types">Types</TabsTrigger>
          <TabsTrigger value="transactions">Payment Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <PaymentSummaryTab />
        </TabsContent>
        <TabsContent value="types">
          <PaymentTypesTab />
        </TabsContent>
        <TabsContent
          value="transactions"
          className="flex flex-col gap-1.5 pt-4"
        >
          <div className="flex justify-between">
            <InputGroup>
              <InputGroupInput
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                placeholder="Find by transaction number, method, or user..."
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
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              Showing {(page.current - 1) * rows + 1}-
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
            actionsColumn={<Actions />}
            rowView={<RowViewDialog />}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
