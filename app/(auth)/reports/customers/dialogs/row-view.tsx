import { Button } from "@/components/ui/button"
import SettleSalesDialog from "@/components/custom/settle-sales-dialog"
import { usePermissions } from "@/hooks/use-permissions"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { useQuery } from "@apollo/client/react"
import { HandCoinsIcon, XIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import StoreCreditDrawer from "./view-credit"
import AccountLimitDrawer from "./view-limit"
import { useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ICustomerSaleNode } from "@/types/sale.type"
import DataTable from "@/components/custom/data-table"
import { StatusBadge } from "@/components/custom/status-badge"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import SaleRowViewDialog from "@/app/(auth)/sale-history/_dialogs/row-view"

type Props = {
  _id?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
}

const GET_CUSTOMER = gql`
  query CustomerReport($_id: ID!) {
    customerReport(_id: $_id) {
      _id
      name
      email
      accountLimit {
        current
        max
      }
      storeCredit {
        current
      }
      currentBalance {
        current
      }
      createdAt
    }
  }
`

const GET_CUSTOMER_SALES = gql`
  query CustomerSalesTable($customerId: ID!, $first: Int, $after: String) {
    customerSalesTable(customer: $customerId, first: $first, after: $after) {
      total
      pages
      edges {
        cursor
        node {
          _id
          saleNumber
          date
          outletName
          total
          paid
          outstanding
          currentSaleStatus
          currentSalePaymentStatus
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

const currency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

export default function RowViewDrawer({ _id, open, setOpen, onClose }: Props) {
  const { data }: any = useQuery(GET_CUSTOMER, {
    variables: {
      _id,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })
  const customer = data?.customerReport

  // Sales table pagination state
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
  const {
    data: salesData,
    fetchMore,
    loading: salesLoading,
  } = useQuery(GET_CUSTOMER_SALES, {
    variables: {
      customerId: _id,
      first: rows,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })

  const { total, nodes, endCursor } = useMemo(() => {
    const result = salesData as any
    const nodes =
      result?.customerSalesTable?.edges?.map((edge: any) => edge.node) || []
    const endCursor = result?.customerSalesTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.customerSalesTable?.pages || 1,
    }))

    return {
      total: result?.customerSalesTable?.total || 0,
      nodes,
      endCursor,
    }
  }, [salesData])

  const columns: ColumnDef<ICustomerSaleNode>[] = useMemo(
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
        id: "date",
        header: "Sale date",
        cell: ({ row }) =>
          row.original.date ? format(Number(row.original.date), "PP") : "-",
      },
      {
        id: "outletName",
        header: "Outlet",
        cell: ({ row }) => row.original.outletName || "-",
      },
      {
        id: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-medium">{currency(row.original.total)}</span>
        ),
      },
      {
        id: "paid",
        header: "Paid",
        cell: ({ row }) => currency(row.original.paid),
      },
      {
        id: "outstanding",
        header: "Outstanding",
        cell: ({ row }) => (
          <span
            className={
              row.original.outstanding > 0
                ? "font-medium text-destructive"
                : "font-medium"
            }
          >
            {currency(row.original.outstanding)}
          </span>
        ),
      },
      {
        id: "currentSaleStatus",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.currentSaleStatus} />
        ),
      },
    ],
    []
  )

  const resetPage = () => setPage({ current: 1, loaded: 1, max: 1 })

  const onNextPage = async () => {
    if (page.current == page.loaded) {
      await fetchMore({
        variables: {
          customerId: _id,
          first: rows,
          after: endCursor,
        },
        updateQuery: (prev: any, { fetchMoreResult: more }: any) => {
          if (!more) return prev
          const cursorSet = new Set([
            ...prev.customerSalesTable.edges.map((edge: any) => edge.cursor),
            ...more.customerSalesTable.edges.map((edge: any) => edge.cursor),
          ])
          const filteredEdges = [
            ...prev.customerSalesTable.edges,
            ...more.customerSalesTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.customerSalesTable.pageInfo
          return {
            customerSalesTable: {
              ...more.customerSalesTable,
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

  const handleClose = () => {
    setOpen?.(false)
    onClose?.()
  }

  const [settleOpen, setSettleOpen] = useState(false)
  const maxLimit = customer?.accountLimit?.max || 0
  const usedLimit = Math.max(
    maxLimit - (customer?.accountLimit?.current || 0),
    0
  )
  const limitUsedPercent =
    maxLimit > 0 ? Math.min((usedLimit / maxLimit) * 100, 100) : 0
  const { can } = usePermissions()
  const canSettle = can("pos.sale.settle")

  return (
    <Drawer direction="right" modal open={open} onOpenChange={handleClose}>
      <DrawerContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="w-full data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-[min(80rem,96vw)]"
      >
        <DrawerHeader className="gap-3 border-b bg-muted/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="truncate">{customer?.name}</DrawerTitle>
              <DrawerDescription className="truncate">
                {customer?.email || "No email on file"}
                {customer?.createdAt
                  ? ` · Customer since ${format(Number(customer.createdAt), "PP")}`
                  : ""}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0">
                <XIcon />
              </Button>
            </DrawerClose>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StoreCreditDrawer _id={_id!} />
            <AccountLimitDrawer _id={_id!} />
            {/*
              Settles this customer's unpaid on-account sales in one pass -
              pick any combination, choose how they are paying, done.
            */}
            {canSettle && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-md"
                onClick={() => setSettleOpen(true)}
                disabled={!_id}
              >
                <HandCoinsIcon /> Bulk Payment
              </Button>
            )}
          </div>
        </DrawerHeader>
        <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
            <section className="border bg-muted/40 p-3">
              <Label className="text-base font-semibold text-primary">
                Account limit
              </Label>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="block text-xs text-muted-foreground">
                    Remaining
                  </span>
                  <span className="block text-xl font-semibold tabular-nums">
                    {currency(customer?.accountLimit?.current)}
                  </span>
                </div>
                {/*
                  The bar reads at a glance what two currency figures do not:
                  how much of the customer's credit is already spent.
                */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${limitUsedPercent}%` }}
                  />
                </div>
                <span className="block text-xs text-muted-foreground">
                  {currency(usedLimit)} of{" "}
                  {currency(customer?.accountLimit?.max)} used
                </span>
              </div>
            </section>

            <section className="border bg-muted/40 p-3">
              <Label className="text-base font-semibold text-primary">
                Wallets
              </Label>
              <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div>
                  {/*
                    Change the customer left on their account at checkout - a
                    separate wallet from store credit, spendable as its own
                    tender in Process Sale.
                  */}
                  <span className="block text-xs text-muted-foreground">
                    Current balance
                  </span>
                  <span className="block text-xl font-semibold text-blue-700 tabular-nums">
                    {currency(customer?.currentBalance?.current)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">
                    Store credit
                  </span>
                  <span className="block text-xl font-semibold text-green-700 tabular-nums">
                    {currency(customer?.storeCredit?.current)}
                  </span>
                </div>
              </div>
            </section>
          </div>
          <section className="flex min-w-0 flex-1 flex-col gap-2 border bg-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-base font-semibold text-primary">
                Sales
              </Label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">
                  Showing {total === 0 ? 0 : (page.current - 1) * rows + 1}-
                  {page.current === page.max ? total : page.current * rows} of{" "}
                  {total}
                </span>
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
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="300">300</SelectItem>
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
              loading={salesLoading}
              columns={columns}
              data={nodes.slice((page.current - 1) * rows, page.current * rows)}
              noFooter
              rowView={<SaleRowViewDialog external />}
            />
          </section>
        </div>
        <DrawerFooter className="border-t">
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
        <SettleSalesDialog
          customerId={_id!}
          customerName={customer?.name}
          open={settleOpen}
          setOpen={setSettleOpen}
        />
      </DrawerContent>
    </Drawer>
  )
}
