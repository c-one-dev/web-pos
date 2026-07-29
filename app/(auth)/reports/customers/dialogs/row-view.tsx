import { Button } from "@/components/ui/button"
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
import { XIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import { Separator } from "@/components/ui/separator"
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
  const [rows, setRows] = useState<number>(8)
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

  return (
    <Drawer direction="right" modal open={open} onOpenChange={handleClose}>
      <DrawerContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="lg:min-w-6xl"
      >
        <DrawerHeader className="flex flex-row justify-between">
          <div>
            <DrawerTitle>{customer?.name}</DrawerTitle>
            <DrawerDescription>{customer?.email}</DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline" size="icon-lg" className="h-full">
              <XIcon />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="flex h-full w-full gap-4 overflow-y-auto px-4">
          <div className="grid h-fit w-xs shrink-0 grid-cols-2 place-content-start gap-1.5 border p-2.5">
            <div className="col-span-2">
              <Label>Email</Label>
              <span className="block text-muted-foreground">
                {customer?.email}
              </span>
            </div>
            <div className="col-span-2">
              <Label>Customer Since</Label>
              <span className="block text-muted-foreground">
                {customer?.createdAt
                  ? format(Number(customer.createdAt), "PPpp")
                  : "-"}
              </span>
            </div>
            <Separator className="col-span-2" />
            <div className="col-span-2">
              <Label>Max Account Limit</Label>
              <span className="block text-lg font-medium">
                {currency(customer?.accountLimit?.max)}
              </span>
            </div>
            <div className="col-span-2">
              <Label>Remaining Account Limit</Label>
              <span className="block text-lg font-medium">
                {currency(customer?.accountLimit?.current)}
              </span>
            </div>
            <div className="col-span-2">
              <Label>Store Credit</Label>
              <span className="block text-lg font-medium">
                {currency(customer?.storeCredit?.current)}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Sales</Label>
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
              loading={salesLoading}
              columns={columns}
              data={nodes.slice((page.current - 1) * rows, page.current * rows)}
              noFooter
              rowView={<SaleRowViewDialog external />}
            />
          </div>
        </div>
        <DrawerFooter className="flex flex-row">
          <StoreCreditDrawer _id={_id!} />
          <AccountLimitDrawer _id={_id!} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
