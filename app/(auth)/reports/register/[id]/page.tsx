"use client"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import gql from "graphql-tag"
import { useQuery } from "@apollo/client/react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowLeftIcon,
  PrinterIcon,
  EnvelopeSimpleIcon,
  BuildingsIcon,
  UserCircleIcon,
  HandCoinsIcon,
  ReceiptXIcon,
  WalletIcon,
  ChartLineUpIcon,
  ReceiptIcon,
  SealPercentIcon,
  TagIcon,
  TagChevronIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ReportPageSkeleton } from "@/components/custom/skeletons"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/custom/status-badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/custom/data-table"
import SaleRowViewDialog from "@/app/(auth)/sale-history/_dialogs/row-view"
import { useCursorPage } from "@/hooks/use-cursor-page"
import { cn } from "@/lib/utils"

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

// This report gets read at the counter, often quickly and not always by
// someone with sharp near vision, so the whole tab strip and its tables are
// deliberately larger and higher-contrast than the shared defaults. All of it
// is applied here rather than in components/ui/{tabs,table}.tsx, which every
// other page uses.
const CLOSURE_TABS_LIST =
  "relative w-full flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-auto"

// 16px labels instead of 12px. The active tab is a solid green pill rather
// than an underline - the pill is a single element behind the strip
// (ClosureTabs below) that slides between tabs, so it cannot be a per-trigger
// background.
const CLOSURE_TAB_TRIGGER = [
  // z-10 keeps the label above the sliding pill, which is painted behind it.
  "relative z-10 flex-none px-4 py-2.5 text-base text-muted-foreground",
  "hover:text-foreground data-active:font-semibold",
  // White-ish label on the green pill. The second rule re-states it for the
  // hovered-active case: plain `hover:text-foreground` above would otherwise
  // darken the label to near-black against the green fill. Stacking the
  // variants raises specificity, so this wins without !important.
  "data-active:text-primary-foreground",
  "data-active:hover:text-primary-foreground",
  // 2px side rules give each inactive label a visible edge, so the strip reads
  // as a row of buttons rather than as a sentence. Dropped on hover and on the
  // active tab, where the fill already defines the shape - keeping both would
  // read as two competing outlines.
  "border-x-2 border-x-primary data-active:border-x-transparent",
  "hover:border-x-transparent",
  // The trigger never paints its own background - the pill owns that.
  "cursor-pointer hover:bg-primary/5 data-active:bg-transparent",
].join(" ")

// Row text at 14px - still well above the shared 12px default, but a notch
// under the 16px tab labels so the wide tabs (Transaction by SKU has nine
// columns) do not force horizontal scrolling. Rows stay taller than default
// so the denser type is not cramped.
const CLOSURE_TABLE_TEXT = "text-sm [&_td]:py-2.5 [&_th]:h-11 [&_th]:text-sm"

const GET_CLOSURE_DETAIL = gql`
  query RegisterSessionClosureDetail($_id: ID!) {
    registerSessionClosureDetail(_id: $_id) {
      _id
      registerName
      outletName
      openedAt
      openedByName
      closedAt
      closedByName
      paymentReceived
      refunds
      netReceipts
      totalSalesInc
      totalSalesEx
      salesTaxCollected
      itemDiscounts
      discounts
      surcharge
      paymentSummary {
        method {
          _id
          name
        }
        expected
        counted
        difference
      }
      addsPayouts {
        type
        amount
        note
        date
        by {
          _id
          name
          surname
        }
      }
    }
  }
`

type PaymentSummaryRow = {
  method: { _id: string; name: string }
  expected: number
  counted: number
  difference: number
}
type PaymentDetailRow = {
  _id: string
  date: string
  saleNumber: string
  saleTotal: number
  paymentAmount: number
  type: string
  isOnAccount?: boolean
  userName: string
}
type AddsPayoutRow = {
  type: "IN" | "OUT"
  amount: number
  note?: string
  date: string
  by: { _id: string; name: string; surname: string }
}
type TransactionRow = {
  _id: string
  date: string
  saleNumber: string
  status: string
  customerName: string
  discount: number
  saleTotal: number
  userName: string
}
type SkuRow = {
  _id: string
  sku: string
  date: string
  saleNumber: string
  quantity: number
  salesExTax: number
  salesInc: number
  discountOffers: number
  orderDiscounts: number
  saleTotal: number
  payments: string
}
type CogsRow = {
  itemName: string
  sku: string
  quantitySold: number
  salesInc: number
  salesExTax: number
  purchaseCost: number
  retailPrice: number
}

function SummaryCard({
  icon,
  label,
  value,
  emphasis,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  emphasis?: boolean
}) {
  return (
    <Card size="sm" className="rounded-lg">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span
            className={
              emphasis
                ? "text-xl font-semibold text-primary"
                : "text-xl font-semibold"
            }
          >
            {value}
          </span>
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
        </div>
        <span className="text-muted-foreground [&_svg]:size-6">{icon}</span>
      </CardContent>
    </Card>
  )
}

// Tab labels in render order. Kept as data so the strip and the sliding pill
// stay in step without repeating the list.
const CLOSURE_TAB_DEFS = [
  { value: "payment-summary", label: "Payment Summary" },
  { value: "payment-details", label: "Payment Details" },
  { value: "on-account", label: "On Account Sale" },
  { value: "adds-payouts", label: "Adds / Payouts" },
  { value: "transactions", label: "Transactions" },
  { value: "by-sku", label: "Transaction by SKU" },
  { value: "cogs", label: "Cost of Goods Sold" },
]

/**
 * Tab strip whose active state is a green pill that slides to the tab you
 * pick. Radix has no built-in moving indicator, so the pill is one absolutely
 * positioned element measured from the active trigger's offset box - which
 * also handles the strip wrapping to a second line, since offsetTop moves with
 * it. Falls back to sitting still (not disappearing) if measurement fails.
 */
function ClosureTabs({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(CLOSURE_TAB_DEFS[0].value)
  const listRef = useRef<HTMLDivElement>(null)
  // Keyed by tab value rather than read off a data attribute, so this does not
  // depend on which state attribute the Radix version happens to set.
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [pill, setPill] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    measured: false,
  })

  useLayoutEffect(() => {
    const measure = () => {
      const el = triggerRefs.current[value]
      if (!el) return
      setPill({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        measured: true,
      })
    }
    measure()
    // Re-measure when the strip reflows - a resize can rewrap the tabs and
    // leave the pill stranded over the wrong one.
    const list = listRef.current
    if (!list || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [value])

  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList ref={listRef} className={CLOSURE_TABS_LIST}>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 left-0 z-0 rounded-md bg-primary",
            // The slide itself. Held still for anyone who asked the OS for
            // reduced motion.
            "transition-all duration-300 ease-out motion-reduce:transition-none"
          )}
          style={{
            transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
            width: pill.width,
            height: pill.height,
            opacity: pill.measured ? 1 : 0,
          }}
        />
        {CLOSURE_TAB_DEFS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            ref={(el) => {
              triggerRefs.current[tab.value] = el
            }}
            className={CLOSURE_TAB_TRIGGER}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}

// Paged tab queries. The summary cards stay on GET_CLOSURE_DETAIL, which
// still computes them over the whole shift, so paging a tab can never move a
// total.
const GET_CLOSURE_TRANSACTIONS = gql`
  query ClosureTransactions($_id: ID!, $first: Int, $after: String) {
    closureTransactions(_id: $_id, first: $first, after: $after) {
      total
      pages
      edges {
        cursor
        node {
          _id
          date
          saleNumber
          status
          customerName
          discount
          saleTotal
          userName
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`

const GET_CLOSURE_BY_SKU = gql`
  query ClosureTransactionsBySku($_id: ID!, $first: Int, $after: String) {
    closureTransactionsBySku(_id: $_id, first: $first, after: $after) {
      total
      pages
      edges {
        cursor
        node {
          _id
          sku
          date
          saleNumber
          quantity
          salesExTax
          salesInc
          discountOffers
          orderDiscounts
          saleTotal
          payments
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`

const GET_CLOSURE_PAYMENT_DETAILS = gql`
  query ClosurePaymentDetails(
    $_id: ID!
    $first: Int
    $after: String
    $onAccountOnly: Boolean
    $type: String
  ) {
    closurePaymentDetails(
      _id: $_id
      first: $first
      after: $after
      onAccountOnly: $onAccountOnly
      type: $type
    ) {
      total
      pages
      edges {
        cursor
        node {
          _id
          date
          saleNumber
          saleTotal
          paymentAmount
          type
          isOnAccount
          userName
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`

const GET_CLOSURE_COGS = gql`
  query ClosureCogs($_id: ID!, $first: Int, $after: String) {
    closureCogs(_id: $_id, first: $first, after: $after) {
      total
      pages
      edges {
        cursor
        node {
          itemName
          sku
          quantitySold
          salesInc
          salesExTax
          purchaseCost
          retailPrice
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`

// One tab's worth of rows, paged server-side. Owns its own page size and
// cursor so switching tabs does not disturb the others.
function PagedTab<T>({
  query,
  field,
  variables,
  columns,
  emptyLabel,
  rowView,
}: {
  query: any
  field: string
  variables: Record<string, any>
  columns: ColumnDef<T>[]
  emptyLabel: string
  rowView?: ReactNode
}) {
  const [rows, setRows] = useState<number>(8)
  const baseVars = useMemo(() => variables, [variables])
  const { data, loading, fetchMore } = useQuery(query, {
    variables: { first: rows, ...baseVars },
    fetchPolicy: "cache-and-network",
  })
  const { page, total, nodes, reset, onNext, onPrev } = useCursorPage(
    field,
    data,
    fetchMore,
    rows,
    baseVars
  )

  // A changed filter or page size starts a fresh cursor run.
  useEffect(() => {
    reset()
  }, [baseVars, rows, reset])

  return (
    <TotalsTable
      data={nodes.slice((page.current - 1) * rows, page.current * rows)}
      total={total}
      loading={loading}
      columns={columns}
      emptyLabel={emptyLabel}
      rowView={rowView}
      rows={rows}
      setRows={setRows}
      page={page}
      onPrev={onPrev}
      onNext={onNext}
    />
  )
}

// Two modes. Server-paged callers (PagedTab) hand in an already-sliced page
// plus its own controls; the small tabs still fed straight off
// GET_CLOSURE_DETAIL keep slicing locally.
function TotalsTable<T>({
  data,
  total: serverTotal,
  loading,
  columns,
  emptyLabel,
  rowView,
  rows: serverRows,
  setRows: serverSetRows,
  page: serverPage,
  onPrev: serverOnPrev,
  onNext: serverOnNext,
}: {
  data?: T[]
  total?: number
  loading: boolean
  columns: ColumnDef<T>[]
  emptyLabel: string
  rowView?: ReactNode
  rows?: number
  setRows?: (rows: number) => void
  page?: { current: number; max: number }
  onPrev?: () => void
  onNext?: () => void
}) {
  const serverPaged = serverPage !== undefined
  const [localRows, setLocalRows] = useState<number>(8)
  const [localPage, setLocalPage] = useState<{
    current: number
    max: number
  }>({ current: 1, max: 1 })

  const rows = serverRows ?? localRows
  const setRows = serverSetRows ?? setLocalRows

  const points = useMemo(() => data || [], [data])
  const total = serverPaged ? serverTotal || 0 : points.length
  const max = Math.max(1, Math.ceil(total / rows))
  if (!serverPaged && max !== localPage.max)
    setLocalPage((prev) => ({
      ...prev,
      max,
      current: Math.min(prev.current, max),
    }))
  const page = serverPage ?? localPage

  // Reserve a consistent body height so switching tabs doesn't make the page
  // jump - a tab with 3 rows takes the same space as one with 8, and an empty
  // tab takes it too. Derived from the metrics CLOSURE_TABLE_TEXT sets (h-11
  // header, py-2.5 rows at 14px); retune here if those change. Capped at 8
  // rows so picking 100/page doesn't reserve a screen of whitespace for a
  // short tab.
  const reservedBodyHeight = 44 + Math.min(rows, 8) * 41

  if (!loading && !points.length)
    return (
      <div
        className="flex w-full items-center justify-center text-sm text-muted-foreground"
        style={{ minHeight: reservedBodyHeight }}
      >
        {emptyLabel}
      </div>
    )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-base text-muted-foreground">
          Showing {total === 0 ? 0 : (page.current - 1) * rows + 1}-
          {page.current === page.max ? total : page.current * rows} out of{" "}
          {total} result{total === 1 ? "" : "s"}.
        </span>
        <div className="flex gap-1.5">
          <Select
            value={rows.toString()}
            onValueChange={(value) => {
              setRows(Number(value))
              if (!serverPaged) setLocalPage({ current: 1, max: 1 })
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
                serverOnPrev
                  ? serverOnPrev()
                  : setLocalPage((prev) => ({
                      ...prev,
                      current: prev.current - 1,
                    }))
              }
              disabled={page.current === 1}
              variant="outline"
            >
              Prev
            </Button>
            <ButtonGroupText>{`Page ${page.current} of ${page.max}`}</ButtonGroupText>
            <Button
              onClick={() =>
                serverOnNext
                  ? serverOnNext()
                  : setLocalPage((prev) => ({
                      ...prev,
                      current: prev.current + 1,
                    }))
              }
              disabled={page.current === page.max}
              variant="outline"
            >
              Next
            </Button>
          </ButtonGroup>
        </div>
      </div>
      <div style={{ minHeight: reservedBodyHeight }}>
        <DataTable
          loading={loading}
          columns={columns}
          data={
            serverPaged
              ? points
              : points.slice((page.current - 1) * rows, page.current * rows)
          }
          noFooter
          rowView={rowView}
          className={CLOSURE_TABLE_TEXT}
        />
      </div>
    </div>
  )
}

export default function Page() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const [paymentType, setPaymentType] = useState<string>("ALL")

  const { data, loading } = useQuery(GET_CLOSURE_DETAIL, {
    variables: { _id: sessionId },
    fetchPolicy: "network-only",
    skip: !sessionId,
  })
  const detail = (data as any)?.registerSessionClosureDetail

  const paymentTypeOptions = useMemo(() => {
    const names = new Set<string>(
      (detail?.paymentSummary || []).map(
        (t: PaymentSummaryRow) => t.method?.name
      )
    )
    return Array.from(names).filter(Boolean)
  }, [detail])

  // Memoised so PagedTab's reset effect only fires on a real change.
  const sessionVars = useMemo(() => ({ _id: sessionId }), [sessionId])
  const paymentDetailVars = useMemo(
    () => ({
      _id: sessionId,
      type: paymentType === "ALL" ? null : paymentType,
    }),
    [sessionId, paymentType]
  )
  const onAccountVars = useMemo(
    () => ({ _id: sessionId, onAccountOnly: true }),
    [sessionId]
  )

  const filteredPaymentSummary: PaymentSummaryRow[] = useMemo(() => {
    const rows = detail?.paymentSummary || []
    return paymentType === "ALL"
      ? rows
      : rows.filter((r: PaymentSummaryRow) => r.method?.name === paymentType)
  }, [detail, paymentType])

  if (loading && !detail) return <ReportPageSkeleton />

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Register session not found.
      </div>
    )
  }

  const paymentSummaryColumns: ColumnDef<PaymentSummaryRow>[] = [
    {
      id: "method",
      header: "Payment type",
      cell: ({ row }) => row.original.method?.name || "-",
    },
    {
      id: "expected",
      header: () => <div className="text-right">Expected</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.expected)}</div>
      ),
    },
    {
      id: "actual",
      header: () => <div className="text-right">Actual</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.counted)}</div>
      ),
    },
    {
      id: "difference",
      header: () => <div className="text-right">Difference</div>,
      cell: ({ row }) => (
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
  ]

  const paymentDetailColumns: ColumnDef<PaymentDetailRow>[] = [
    {
      id: "date",
      header: "Date",
      cell: ({ row }) =>
        row.original.date ? format(Number(row.original.date), "PP · p") : "-",
    },
    {
      id: "saleNumber",
      header: "Sale",
      cell: ({ row }) => (
        <span className="font-medium text-primary">
          {row.original.saleNumber}
        </span>
      ),
    },
    {
      id: "saleTotal",
      header: () => <div className="text-right">Sale total</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.saleTotal)}</div>
      ),
    },
    {
      id: "paymentAmount",
      header: () => <div className="text-right">Payment</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.paymentAmount)}</div>
      ),
    },
    { id: "type", header: "Type", cell: ({ row }) => row.original.type },
    {
      id: "userName",
      header: "User",
      cell: ({ row }) => row.original.userName,
    },
  ]

  const addsPayoutsColumns: ColumnDef<AddsPayoutRow>[] = [
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (row.original.type === "IN" ? "Cash in" : "Cash out"),
    },
    {
      id: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.amount)}</div>
      ),
    },
    {
      id: "user",
      header: "User",
      cell: ({ row }) =>
        `${row.original.by?.name || ""} ${row.original.by?.surname || ""}`.trim() ||
        "-",
    },
    {
      id: "note",
      header: "Notes",
      cell: ({ row }) => row.original.note || "-",
    },
  ]

  const transactionColumns: ColumnDef<TransactionRow>[] = [
    {
      id: "date",
      header: "Transaction date",
      cell: ({ row }) =>
        row.original.date ? format(Number(row.original.date), "PP · p") : "-",
    },
    {
      id: "saleNumber",
      header: "Sale",
      cell: ({ row }) => (
        <span className="font-medium text-primary">
          {row.original.saleNumber}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "customerName",
      header: "Customer Name",
      cell: ({ row }) => row.original.customerName,
    },
    {
      id: "discount",
      header: () => <div className="text-right">Discount</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.discount)}</div>
      ),
    },
    {
      id: "saleTotal",
      header: () => <div className="text-right">Sale total</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {currency(row.original.saleTotal)}
        </div>
      ),
    },
  ]

  const skuColumns: ColumnDef<SkuRow>[] = [
    { id: "sku", header: "SKU", cell: ({ row }) => row.original.sku },
    {
      id: "saleNumber",
      header: "Sale",
      cell: ({ row }) => (
        <span className="font-medium text-primary">
          {row.original.saleNumber}
          {row.original.date && (
            <span className="font-normal text-muted-foreground">
              {" · "}
              {format(Number(row.original.date), "MMM d")}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "quantity",
      header: () => <div className="text-right">Qty</div>,
      cell: ({ row }) => (
        <div className="text-right">{row.original.quantity}</div>
      ),
    },
    {
      id: "salesExTax",
      header: () => <div className="text-right">Sales (Ex. tax)</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.salesExTax)}</div>
      ),
    },
    {
      id: "salesInc",
      header: () => <div className="text-right">Sales (inc)</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.salesInc)}</div>
      ),
    },
    {
      id: "discountOffers",
      header: () => <div className="text-right">Discount offers</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {currency(row.original.discountOffers)}
        </div>
      ),
    },
    {
      id: "orderDiscounts",
      header: () => <div className="text-right">Order discounts</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {currency(row.original.orderDiscounts)}
        </div>
      ),
    },
    {
      id: "saleTotal",
      header: () => <div className="text-right">Sale total</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {currency(row.original.saleTotal)}
        </div>
      ),
    },
    {
      id: "payments",
      header: "Payments",
      cell: ({ row }) => row.original.payments || "-",
    },
  ]

  const cogsColumns: ColumnDef<CogsRow>[] = [
    {
      id: "itemName",
      header: "Item",
      cell: ({ row }) => row.original.itemName,
    },
    { id: "sku", header: "SKU", cell: ({ row }) => row.original.sku },
    {
      id: "quantitySold",
      header: () => <div className="text-right">Quantity sold</div>,
      cell: ({ row }) => (
        <div className="text-right">{row.original.quantitySold}</div>
      ),
    },
    {
      id: "salesInc",
      header: () => <div className="text-right">Sales (inc)</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.salesInc)}</div>
      ),
    },
    {
      id: "salesExTax",
      header: () => <div className="text-right">Sales (Ex. tax)</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.salesExTax)}</div>
      ),
    },
    {
      id: "purchaseCost",
      header: () => <div className="text-right">Purchase cost</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.purchaseCost)}</div>
      ),
    },
    {
      id: "retailPrice",
      header: () => <div className="text-right">Retail price</div>,
      cell: ({ row }) => (
        <div className="text-right">{currency(row.original.retailPrice)}</div>
      ),
    },
  ]

  return (
    // pb-10 so the last table row is not flush against the bottom of the
    // scroll area - the tabs make this page tall enough that the final row
    // otherwise sits right on the edge. Reset for print, where the page
    // break handles spacing.
    <div className="flex h-full w-full flex-col gap-2.5 p-2.5 pb-10 print:p-0 print:pb-0">
      <div className="flex items-center justify-between">
        <Label className="text-xl font-medium">Register closure summary</Label>
        <div className="flex gap-1.5 print:hidden">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => router.push("/reports/register")}
          >
            <ArrowLeftIcon /> Back to Summary
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => window.print()}
          >
            <PrinterIcon /> Print
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              toast.info("Sending reports by email isn't available yet.")
            }
          >
            <EnvelopeSimpleIcon /> Send Email
          </Button>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
            <div className="flex items-start gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BuildingsIcon size={18} />
              </span>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-primary">
                  {detail.registerName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {detail.outletName}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-medium text-foreground">Opened</span>
                <span>
                  {detail.openedAt
                    ? format(Number(detail.openedAt), "d MMM · p")
                    : "-"}
                </span>
                <span className="flex items-center gap-1 text-foreground">
                  <UserCircleIcon size={14} />
                  {detail.openedByName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-medium text-foreground">Closed</span>
                <span>
                  {detail.closedAt
                    ? format(Number(detail.closedAt), "d MMM · p")
                    : "-"}
                </span>
                <span className="flex items-center gap-1 text-foreground">
                  <UserCircleIcon size={14} />
                  {detail.closedByName}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <SummaryCard
              icon={<HandCoinsIcon />}
              label="Payment received"
              value={currency(detail.paymentReceived)}
            />
            <SummaryCard
              icon={<ReceiptXIcon />}
              label="Refunds"
              value={currency(detail.refunds)}
            />
            <SummaryCard
              icon={<WalletIcon />}
              label="Net receipts"
              value={currency(detail.netReceipts)}
              emphasis
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardContent className="flex flex-col gap-2.5">
          <Label className="text-sm font-semibold">Sales Summary</Label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <SummaryCard
              icon={<ChartLineUpIcon />}
              label="Total Sales (inc)"
              value={currency(detail.totalSalesInc)}
              emphasis
            />
            <SummaryCard
              icon={<ReceiptIcon />}
              label="Total Sales (ex)"
              value={currency(detail.totalSalesEx)}
            />
            <SummaryCard
              icon={<SealPercentIcon />}
              label="Sales tax collected"
              value={currency(detail.salesTaxCollected)}
            />
            <SummaryCard
              icon={<TagIcon />}
              label="Item discounts"
              value={currency(detail.itemDiscounts)}
            />
            <SummaryCard
              icon={<TagChevronIcon />}
              label="Discounts"
              value={currency(detail.discounts)}
            />
            <SummaryCard
              icon={<PlusCircleIcon />}
              label="Surcharge"
              value={currency(detail.surcharge)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardContent className="flex flex-col gap-2">
          {paymentTypeOptions.length > 0 && (
            <div className="flex justify-end">
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ALL">All payment types</SelectItem>
                    {paymentTypeOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
          <ClosureTabs>
            <TabsContent value="payment-summary" className="pt-4">
              <TotalsTable
                data={filteredPaymentSummary}
                loading={loading}
                columns={paymentSummaryColumns}
                emptyLabel="No payments recorded in this shift."
              />
            </TabsContent>
            <TabsContent value="payment-details" className="pt-4">
              <PagedTab<PaymentDetailRow>
                query={GET_CLOSURE_PAYMENT_DETAILS}
                field="closurePaymentDetails"
                variables={paymentDetailVars}
                columns={paymentDetailColumns}
                emptyLabel="No payments recorded in this shift."
                rowView={<SaleRowViewDialog external />}
              />
            </TabsContent>
            <TabsContent value="on-account" className="pt-4">
              <PagedTab<PaymentDetailRow>
                query={GET_CLOSURE_PAYMENT_DETAILS}
                field="closurePaymentDetails"
                variables={onAccountVars}
                columns={paymentDetailColumns}
                emptyLabel="No on-account sales in this shift."
                rowView={<SaleRowViewDialog external />}
              />
            </TabsContent>
            <TabsContent value="adds-payouts" className="pt-4">
              <TotalsTable
                data={detail.addsPayouts}
                loading={loading}
                columns={addsPayoutsColumns}
                emptyLabel="No cash movements in this shift."
              />
            </TabsContent>
            <TabsContent value="transactions" className="pt-4">
              <PagedTab<TransactionRow>
                query={GET_CLOSURE_TRANSACTIONS}
                field="closureTransactions"
                variables={sessionVars}
                columns={transactionColumns}
                emptyLabel="No transactions in this shift."
                rowView={<SaleRowViewDialog external />}
              />
            </TabsContent>
            <TabsContent value="by-sku" className="pt-4">
              <PagedTab<SkuRow>
                query={GET_CLOSURE_BY_SKU}
                field="closureTransactionsBySku"
                variables={sessionVars}
                columns={skuColumns}
                emptyLabel="No items sold in this shift."
                rowView={<SaleRowViewDialog external />}
              />
            </TabsContent>
            <TabsContent value="cogs" className="pt-4">
              <PagedTab<CogsRow>
                query={GET_CLOSURE_COGS}
                field="closureCogs"
                variables={sessionVars}
                columns={cogsColumns}
                emptyLabel="No items sold in this shift."
              />
            </TabsContent>
          </ClosureTabs>
        </CardContent>
      </Card>
    </div>
  )
}
