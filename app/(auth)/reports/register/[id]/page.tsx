"use client"
import { useMemo, useState, type ReactNode } from "react"
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
import { Spinner } from "@/components/ui/spinner"
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

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

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
      paymentDetails {
        _id
        date
        saleNumber
        saleTotal
        paymentAmount
        type
        isOnAccount
        userName
      }
      onAccountSales {
        _id
        date
        saleNumber
        saleTotal
        paymentAmount
        type
        userName
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
      transactions {
        _id
        date
        saleNumber
        status
        customerName
        discount
        saleTotal
        userName
      }
      transactionsBySku {
        _id
        sku
        saleNumber
        quantity
        salesExTax
        salesInc
        discountOffers
        orderDiscounts
        saleTotal
        payments
      }
      cogs {
        itemName
        sku
        quantitySold
        salesInc
        salesExTax
        purchaseCost
        retailPrice
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

function TotalsTable<T>({
  data,
  loading,
  columns,
  emptyLabel,
  rowView,
}: {
  data?: T[]
  loading: boolean
  columns: ColumnDef<T>[]
  emptyLabel: string
  rowView?: ReactNode
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
        rowView={rowView}
      />
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

  const filteredPaymentSummary: PaymentSummaryRow[] = useMemo(() => {
    const rows = detail?.paymentSummary || []
    return paymentType === "ALL"
      ? rows
      : rows.filter((r: PaymentSummaryRow) => r.method?.name === paymentType)
  }, [detail, paymentType])

  const filteredPaymentDetails: PaymentDetailRow[] = useMemo(() => {
    const rows = detail?.paymentDetails || []
    return paymentType === "ALL"
      ? rows
      : rows.filter((r: PaymentDetailRow) => r.type === paymentType)
  }, [detail, paymentType])

  if (loading && !detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-10 text-primary" />
      </div>
    )
  }

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
    <div className="flex h-full w-full flex-col gap-2.5 p-2.5 print:p-0">
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
          <Tabs defaultValue="payment-summary">
            <TabsList variant="line" className="flex-wrap">
              <TabsTrigger value="payment-summary">Payment Summary</TabsTrigger>
              <TabsTrigger value="payment-details">Payment Details</TabsTrigger>
              <TabsTrigger value="on-account">On Account Sale</TabsTrigger>
              <TabsTrigger value="adds-payouts">Adds / Payouts</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="by-sku">Transaction by SKU</TabsTrigger>
              <TabsTrigger value="cogs">Cost of Goods Sold</TabsTrigger>
            </TabsList>
            <TabsContent value="payment-summary" className="pt-4">
              <TotalsTable
                data={filteredPaymentSummary}
                loading={loading}
                columns={paymentSummaryColumns}
                emptyLabel="No payments recorded in this shift."
              />
            </TabsContent>
            <TabsContent value="payment-details" className="pt-4">
              <TotalsTable
                data={filteredPaymentDetails}
                loading={loading}
                columns={paymentDetailColumns}
                emptyLabel="No payments recorded in this shift."
                rowView={<SaleRowViewDialog external />}
              />
            </TabsContent>
            <TabsContent value="on-account" className="pt-4">
              <TotalsTable
                data={detail.onAccountSales}
                loading={loading}
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
              <TotalsTable
                data={detail.transactions}
                loading={loading}
                columns={transactionColumns}
                emptyLabel="No transactions in this shift."
                rowView={<SaleRowViewDialog external />}
              />
            </TabsContent>
            <TabsContent value="by-sku" className="pt-4">
              <TotalsTable
                data={detail.transactionsBySku}
                loading={loading}
                columns={skuColumns}
                emptyLabel="No items sold in this shift."
                rowView={<SaleRowViewDialog external />}
              />
            </TabsContent>
            <TabsContent value="cogs" className="pt-4">
              <TotalsTable
                data={detail.cogs}
                loading={loading}
                columns={cogsColumns}
                emptyLabel="No items sold in this shift."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
