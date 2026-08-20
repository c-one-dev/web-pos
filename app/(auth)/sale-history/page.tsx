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
  ArrowDownLeftIcon,
  ArrowElbowDownRightIcon,
  GearIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react"
import { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/custom/data-table"
import ColumnFilter from "@/components/custom/column-filter"
import { FilterType } from "@/types/shared.type"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import SortHeader from "@/components/custom/sort-header"
import { useRouter } from "next/navigation"
import RefundDialog from "./_dialogs/refund"
import SettleSalesDialog from "@/components/custom/settle-sales-dialog"
import { usePermissions } from "@/hooks/use-permissions"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import RowViewDialog from "./_dialogs/row-view"
import { StatusBadge } from "@/components/custom/status-badge"
import { CustomerBadge } from "@/components/custom/customer-badge"
import {
  ISaleHistoryNode,
  SalePaymentStatus,
  SaleStatus,
} from "@/types/sale.type"
import { format, startOfToday, endOfDay } from "date-fns"
import { ArrowElbowRightIcon } from "@phosphor-icons/react/dist/ssr"
import { HandCoinsIcon } from "@phosphor-icons/react"

const GET_SALE_HISTORY = gql`
  query SaleHistoryTable(
    $first: Int
    $after: String
    $search: String
    $filter: [Filter]
    $sort: Sort
  ) {
    saleHistoryTable(
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
          date
          saleNumber
          customerName
          saleTotal
          currentSaleStatus
          currentSalePaymentStatus
          notes
          paymentNotes
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

// Settling is the main thing you do with an unpaid on-account sale, so it gets
// a button right in the Payment Status cell rather than only living in the row
// menu. Keyed off the status alone - the table node already carries it, so no
// extra query per row - and the dialog re-checks what's actually outstanding.
function PaymentStatusCell({ row }: { row: ISaleHistoryNode }) {
  const [settleOpen, setSettleOpen] = useState(false)
  const { can } = usePermissions()
  const status = row.currentSalePaymentStatus
  const owesMoney = status === "PENDING" || status === "PARTIALLY_PAID"
  const canManageSettlement = can("pos.sale.settle")
  const canSettle =
    canManageSettlement && owesMoney && row.currentSaleStatus !== "VOIDED"

  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={status} />
      {canManageSettlement && (
        // React portals bubble their events through the React tree, not the
        // DOM one, so without this wrapper every click inside the dialog -
        // its overlay included - reaches the cell's row handler and reopens
        // the Sale Order drawer behind it.
        <span onClick={(e) => e.stopPropagation()}>
          {canSettle && (
            <Button
              size="sm"
              className="h-7 gap-1 rounded-md px-2.5 text-xs font-semibold"
              onClick={() => setSettleOpen(true)}
            >
              <HandCoinsIcon />
              Pay
            </Button>
          )}
          {/*
            Mounted on the permission alone, never on the status: settling
            makes the row PAID, and tearing the dialog down in that same
            render would abort the mutation's own in-flight refetches.
          */}
          <SettleSalesDialog
            saleId={row._id?.toString() || ""}
            open={settleOpen}
            setOpen={setSettleOpen}
          />
        </span>
      )}
    </div>
  )
}

// The table node carries no register or editability info, so the row's sale is
// fetched when its menu opens - same as the Sale Order dialog does. isEditable
// is resolved server-side (assertSaleIsEditable), so the menu shows exactly
// what updateSale would actually accept.
const GET_SALE_ACTIONS = gql`
  query SaleRowActions($_id: ID!) {
    sale(_id: $_id) {
      _id
      saleNumber
      isEditable
      currentSaleStatus
      refundedAmount
      outstandingAmount
      customer {
        _id
      }
      register {
        _id
      }
    }
  }
`

function Actions({ row }: { row?: ISaleHistoryNode }) {
  const [open, setOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const router = useRouter()
  const { can } = usePermissions()
  const data = useMemo(() => row, [row])
  const _id = data?._id?.toString() || ""
  const { data: saleData }: any = useQuery(GET_SALE_ACTIONS, {
    variables: { _id },
    fetchPolicy: "cache-and-network",
    skip: !_id || !open,
  })
  const sale = saleData?.sale
  const isEditable = !!sale?.isEditable
  // Refunds go back as store credit, so they need a customer to credit and a
  // sale that isn't voided. The dialog explains whichever rule is blocking;
  // the server enforces all of it again in refundSaleItems.
  // Only on-account sales that still owe something can be settled.
  const outstanding = sale?.outstandingAmount || 0
  const canSettle =
    can("pos.sale.settle") &&
    outstanding > 0 &&
    sale?.currentSaleStatus !== "VOIDED"
  const canRefund =
    can("pos.sale.refund") &&
    !!sale?.customer &&
    sale?.currentSaleStatus !== "VOIDED"

  return (
    <>
      <DropdownMenu modal open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <GearIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="left" align="start">
          <DropdownMenuItem
            disabled={!isEditable}
            onSelect={() => {
              if (!isEditable) return
              setOpen(false)
              // Same destination as the Sale Order dialog's Edit button: back
              // to Process Sale with the sale preloaded, so the cashier
              // confirms payment again to replace the original.
              router.push(`/process/${sale?.register?._id}?edit=${_id}`)
            }}
          >
            Edit
          </DropdownMenuItem>
          {can("pos.sale.settle") && (
            <DropdownMenuItem
              disabled={!canSettle}
              onSelect={() => {
                if (!canSettle) return
                setOpen(false)
                setSettleOpen(true)
              }}
            >
              Settle payment
            </DropdownMenuItem>
          )}
          {can("pos.sale.refund") && (
            <DropdownMenuItem
              disabled={!canRefund}
              onSelect={() => {
                if (!canRefund) return
                setOpen(false)
                setRefundOpen(true)
              }}
            >
              Refund
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <RefundDialog _id={_id} open={refundOpen} setOpen={setRefundOpen} />
      <SettleSalesDialog
        saleId={_id}
        open={settleOpen}
        setOpen={setSettleOpen}
      />
    </>
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
  // Filter state - defaults to today's sales, which is what a cashier or
  // manager almost always wants on landing. The Date column filter renders
  // from this same state, so it shows "Today" pre-applied and stays fully
  // editable (change the range, or Reset to see all sales).
  const [filter, setFilter] = useState<
    { key: string; value: string; type: FilterType }[]
  >(() => [
    {
      key: "date",
      value: `${startOfToday().toISOString()}_${endOfDay(new Date()).toISOString()}`,
      type: FilterType.DATE,
    },
  ])
  const { data, fetchMore, loading } = useQuery(GET_SALE_HISTORY, {
    variables: {
      first: rows,
      search,
      filter,
      sort,
    },
    fetchPolicy: "cache-and-network",
  })
  // Responsiveness
  const isMobile = useIsMobile()

  const { total, nodes, endCursor } = useMemo(() => {
    const result = data as any
    const nodes =
      result?.saleHistoryTable?.edges?.map((edge: any) => edge.node) || []
    const hasNextPage = result?.saleHistoryTable?.pageInfo?.hasNextPage || false
    const endCursor = result?.saleHistoryTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.saleHistoryTable?.pages || 1,
    }))

    return {
      total: result?.saleHistoryTable?.total || 0,
      pages: result?.saleHistoryTable?.pages || 0,
      nodes,
      hasNextPage,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<ISaleHistoryNode>[] = useMemo(
    () => [
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
          <span className="font-medium">
            {row.original.date
              ? format(new Date(Number(row.original.date)), "PP")
              : ""}
          </span>
        ),
        footer: () => (
          <ColumnFilter
            label="Date"
            filterKey="date"
            filterType={FilterType.DATE}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "saleNumber",
        header: () => (
          <SortHeader
            label="Sale No."
            sortKey="saleNumber"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <div>
            <span className="block font-medium">{row.original.saleNumber}</span>
            {row.original.notes && (
              <span className="flex gap-1 text-xs text-muted-foreground">
                <ArrowElbowDownRightIcon />{" "}
                <span className="whitespace-pre-line">
                  {row.original.notes}
                </span>
              </span>
            )}
            {row.original.paymentNotes != "" &&
              row.original.paymentNotes
                .split(", ")
                .map((note: string, index: number) => (
                  <span
                    key={index}
                    className="flex gap-1 text-xs text-muted-foreground"
                  >
                    <ArrowElbowDownRightIcon /> {note}
                  </span>
                ))}
          </div>
        ),
        footer: () => (
          <ColumnFilter
            label="Sale No."
            filterKey="saleNumber"
            filterType={FilterType.TEXT}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "customerName",
        header: () => (
          <SortHeader
            label="Customer"
            sortKey="customerName"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => <CustomerBadge name={row.original.customerName} />,
        footer: () => (
          <ColumnFilter
            label="Customer"
            filterKey="customerName"
            filterType={FilterType.TEXT}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "currentSaleStatus",
        header: () => (
          <SortHeader
            label="Sale Status"
            sortKey="currentSaleStatus"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <StatusBadge status={row.original.currentSaleStatus} />
        ),
        footer: () => (
          <ColumnFilter
            label="Sale Status"
            filterKey="currentSaleStatus"
            filterType={FilterType.SELECT}
            options={Object.values(SaleStatus).map((status) => ({
              label: status.replaceAll("_", " "),
              value: status,
            }))}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "currentSalePaymentStatus",
        header: () => (
          <SortHeader
            label="Payment Status"
            sortKey="currentSalePaymentStatus"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => <PaymentStatusCell row={row.original} />,
        footer: () => (
          <ColumnFilter
            label="Payment Status"
            filterKey="currentSalePaymentStatus"
            filterType={FilterType.SELECT}
            options={Object.values(SalePaymentStatus).map((status) => ({
              label: status.replaceAll("_", " "),
              value: status,
            }))}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "saleTotal",
        header: () => (
          <SortHeader
            label="Sale Total"
            sortKey="saleTotal"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {new Intl.NumberFormat("en-PH", {
              style: "currency",
              currency: "PHP",
            }).format(row.original.saleTotal)}
          </span>
        ),
        footer: () => (
          <ColumnFilter
            label="Sale Total"
            filterKey="saleTotal"
            filterType={FilterType.NUMBER}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
    ],
    [sort, filter]
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
            ...prev.saleHistoryTable.edges.map((edge: any) => edge.cursor),
            ...more.saleHistoryTable.edges.map((edge: any) => edge.cursor),
          ])
          const filteredEdges = [
            ...prev.saleHistoryTable.edges,
            ...more.saleHistoryTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.saleHistoryTable.pageInfo
          return {
            saleHistoryTable: {
              ...more.saleHistoryTable,
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
        <Label className="text-xl font-medium">Sale History</Label>
      </div>
      <div className="flex justify-between">
        <InputGroup>
          <InputGroupInput
            data-search-input
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            placeholder="Type to search..."
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
    </div>
  )
}
