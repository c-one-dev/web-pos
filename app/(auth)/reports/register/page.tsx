"use client"
import { useCallback, useMemo, useState } from "react"
import gql from "graphql-tag"
import { useQuery } from "@apollo/client/react"
import { useRouter } from "next/navigation"
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
import { CalendarBlankIcon, CaretDownIcon } from "@phosphor-icons/react"
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
import { Checkbox } from "@/components/ui/checkbox"
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
import SortHeader from "@/components/custom/sort-header"
import { StatusBadge } from "@/components/custom/status-badge"
import { IRegisterSessionTableNode } from "@/types/registerSession.type"
import { IVoidedSaleNode } from "@/types/sale.type"
import SaleRowViewDialog from "@/app/(auth)/sale-history/_dialogs/row-view"

const GET_SHIFT_REPORT = gql`
  query ShiftReportTable(
    $first: Int
    $after: String
    $search: String
    $start: String
    $end: String
    $includeDeleted: Boolean
    $sort: Sort
  ) {
    registerSessionTable(
      first: $first
      after: $after
      search: $search
      start: $start
      end: $end
      includeDeleted: $includeDeleted
      sort: $sort
    ) {
      total
      pages
      edges {
        cursor
        node {
          _id
          registerName
          outletName
          openedAt
          openedByName
          closedAt
          status
          expected
          actual
          difference
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

const GET_VOIDED_SALES = gql`
  query VoidedSaleTable(
    $first: Int
    $after: String
    $search: String
    $start: String
    $end: String
    $sort: Sort
  ) {
    voidedSaleTable(
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
          registerName
          outletName
          amount
          voidedAt
          voidedByName
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

function ShiftReportTab() {
  const router = useRouter()
  const [rows, setRows] = useState<number>(8)
  const [page, setPage] = useState<{
    current: number
    loaded: number
    max: number
  }>({ current: 1, loaded: 1, max: 1 })
  const [search, setSearch] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [includeDeleted, setIncludeDeleted] = useState<boolean>(false)
  const [sort, setSort] = useState<{
    key: string
    order: "ASC" | "DESC"
  } | null>(null)
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: subDays(new Date(), 6),
    to: new Date(),
  })
  const [presetLabel, setPresetLabel] = useState("Last 7 Days")

  const { data, fetchMore, loading } = useQuery(GET_SHIFT_REPORT, {
    variables: {
      first: rows,
      search,
      start: startOfDay(appliedRange.from || startOfToday()).toISOString(),
      end: endOfDay(
        appliedRange.to || appliedRange.from || startOfToday()
      ).toISOString(),
      includeDeleted,
      sort,
    },
    fetchPolicy: "cache-and-network",
  })

  const { total, nodes, endCursor } = useMemo(() => {
    const result = data as any
    const nodes =
      result?.registerSessionTable?.edges?.map((edge: any) => edge.node) || []
    const endCursor = result?.registerSessionTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.registerSessionTable?.pages || 1,
    }))

    return {
      total: result?.registerSessionTable?.total || 0,
      nodes,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<IRegisterSessionTableNode>[] = useMemo(
    () => [
      {
        id: "registerName",
        header: "Register (Outlet)",
        cell: ({ row }) => (
          <span className="font-medium text-primary">
            {row.original.registerName} / {row.original.outletName}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "openedAt",
        header: () => (
          <SortHeader
            label="Time opened"
            sortKey="openedAt"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) =>
          row.original.openedAt
            ? format(Number(row.original.openedAt), "PP · p")
            : "-",
      },
      {
        id: "openedByName",
        header: "Opened By",
        cell: ({ row }) => row.original.openedByName || "-",
      },
      {
        id: "closedAt",
        header: () => (
          <SortHeader
            label="Time closed"
            sortKey="closedAt"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) =>
          row.original.closedAt
            ? format(Number(row.original.closedAt), "PP · p")
            : "-",
      },
      {
        id: "expected",
        header: () => <div className="text-right">Expected</div>,
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.status === "OPEN"
              ? "-"
              : currency(row.original.expected)}
          </div>
        ),
      },
      {
        id: "actual",
        header: () => <div className="text-right">Actual</div>,
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.status === "OPEN"
              ? "-"
              : currency(row.original.actual)}
          </div>
        ),
      },
      {
        id: "difference",
        header: () => <div className="text-right">Difference</div>,
        cell: ({ row }) =>
          row.original.status === "OPEN" ? (
            <div className="text-right">-</div>
          ) : (
            <div
              className={
                row.original.difference !== 0
                  ? "text-right font-medium text-destructive"
                  : "text-right font-medium"
              }
            >
              {currency(row.original.difference)}
            </div>
          ),
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
        variables: {
          first: rows,
          after: endCursor,
          search,
          start: startOfDay(appliedRange.from || startOfToday()).toISOString(),
          end: endOfDay(
            appliedRange.to || appliedRange.from || startOfToday()
          ).toISOString(),
          includeDeleted,
          sort,
        },
        updateQuery: (prev: any, { fetchMoreResult: more }: any) => {
          if (!more) return prev
          const cursorSet = new Set([
            ...prev.registerSessionTable.edges.map((edge: any) => edge.cursor),
            ...more.registerSessionTable.edges.map((edge: any) => edge.cursor),
          ])
          const filteredEdges = [
            ...prev.registerSessionTable.edges,
            ...more.registerSessionTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.registerSessionTable.pageInfo
          return {
            registerSessionTable: {
              ...more.registerSessionTable,
              edges: filteredEdges,
              pageInfo,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <InputGroup className="w-80">
            <InputGroupInput
              onChange={(e) => setSearchTerm(e.currentTarget.value)}
              placeholder="Find by register"
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
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={includeDeleted}
              onCheckedChange={(checked) => {
                setIncludeDeleted(checked === true)
                resetPage()
              }}
            />
            Include deleted
          </label>
        </div>
        <DateRangeFilter
          appliedRange={appliedRange}
          presetLabel={presetLabel}
          onApply={(range, label) => {
            setAppliedRange(range)
            setPresetLabel(label)
            resetPage()
          }}
        />
      </div>
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
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="100">100</SelectItem>
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
        noFooter
        onRowClick={(row: any) => router.push(`/reports/register/${row._id}`)}
      />
    </div>
  )
}

function VoidedTransactionsTab() {
  const [rows, setRows] = useState<number>(8)
  const [page, setPage] = useState<{
    current: number
    loaded: number
    max: number
  }>({ current: 1, loaded: 1, max: 1 })
  const [search, setSearch] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [sort, setSort] = useState<{
    key: string
    order: "ASC" | "DESC"
  } | null>(null)
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: subDays(new Date(), 6),
    to: new Date(),
  })
  const [presetLabel, setPresetLabel] = useState("Last 7 Days")

  const { data, fetchMore, loading } = useQuery(GET_VOIDED_SALES, {
    variables: {
      first: rows,
      search,
      start: startOfDay(appliedRange.from || startOfToday()).toISOString(),
      end: endOfDay(
        appliedRange.to || appliedRange.from || startOfToday()
      ).toISOString(),
      sort,
    },
    fetchPolicy: "cache-and-network",
  })

  const { total, nodes, endCursor } = useMemo(() => {
    const result = data as any
    const nodes =
      result?.voidedSaleTable?.edges?.map((edge: any) => edge.node) || []
    const endCursor = result?.voidedSaleTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.voidedSaleTable?.pages || 1,
    }))

    return {
      total: result?.voidedSaleTable?.total || 0,
      nodes,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<IVoidedSaleNode>[] = useMemo(
    () => [
      {
        id: "saleNumber",
        header: "Sale #",
        cell: ({ row }) => (
          <span className="font-medium text-primary">
            {row.original.saleNumber}
          </span>
        ),
      },
      {
        id: "registerName",
        header: "Register (Outlet)",
        cell: ({ row }) =>
          `${row.original.registerName} / ${row.original.outletName}`,
      },
      {
        id: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {currency(row.original.amount)}
          </div>
        ),
      },
      {
        id: "voidedAt",
        header: () => (
          <SortHeader
            label="Voided Date"
            sortKey="voidedAt"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) =>
          row.original.voidedAt
            ? format(Number(row.original.voidedAt), "PP · p")
            : "-",
      },
      {
        id: "voidedByName",
        header: "Voided By",
        cell: ({ row }) => row.original.voidedByName || "-",
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
        variables: {
          first: rows,
          after: endCursor,
          search,
          start: startOfDay(appliedRange.from || startOfToday()).toISOString(),
          end: endOfDay(
            appliedRange.to || appliedRange.from || startOfToday()
          ).toISOString(),
          sort,
        },
        updateQuery: (prev: any, { fetchMoreResult: more }: any) => {
          if (!more) return prev
          const cursorSet = new Set([
            ...prev.voidedSaleTable.edges.map((edge: any) => edge.cursor),
            ...more.voidedSaleTable.edges.map((edge: any) => edge.cursor),
          ])
          const filteredEdges = [
            ...prev.voidedSaleTable.edges,
            ...more.voidedSaleTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.voidedSaleTable.pageInfo
          return {
            voidedSaleTable: {
              ...more.voidedSaleTable,
              edges: filteredEdges,
              pageInfo,
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
      <div className="flex items-center justify-between">
        <InputGroup className="w-80">
          <InputGroupInput
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            placeholder="Find by sale #, register, or user"
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
        <DateRangeFilter
          appliedRange={appliedRange}
          presetLabel={presetLabel}
          onApply={(range, label) => {
            setAppliedRange(range)
            setPresetLabel(label)
            resetPage()
          }}
        />
      </div>
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
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="100">100</SelectItem>
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
        noFooter
        rowView={<SaleRowViewDialog external />}
      />
    </div>
  )
}

export default function Page() {
  return (
    <div className="flex h-full w-full flex-col gap-1.5 p-2.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xl font-medium">Register</Label>
      </div>
      <Tabs defaultValue="shift">
        <TabsList variant="line">
          <TabsTrigger value="shift">Shift Report</TabsTrigger>
          <TabsTrigger value="voided">Voided Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="shift">
          <ShiftReportTab />
        </TabsContent>
        <TabsContent value="voided">
          <VoidedTransactionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
