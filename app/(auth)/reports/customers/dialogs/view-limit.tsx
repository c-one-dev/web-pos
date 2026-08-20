import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { useQuery } from "@apollo/client/react"
import { CreditCardIcon, XIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import AdjustLimitDialog from "./adjust-limit"
import SettleBalanceDialog from "./settle-balance"
import { Separator } from "@/components/ui/separator"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { ColumnDef } from "@tanstack/react-table"
import { IAccountLimitHistoryItem } from "@/types/customer.type"
import DataTable from "@/components/custom/data-table"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  _id?: string
}

const GET_CUSTOMER_LIMIT_HISTORY = gql`
  query ViewAccountLimitDetails($first: Int, $after: String, $customerId: ID!) {
    customerReport(_id: $customerId) {
      _id
      name
      accountLimit {
        current
        max
      }
    }
    customerLimitHistoryTable(
      first: $first
      after: $after
      customerId: $customerId
    ) {
      total
      pages
      edges {
        cursor
        node {
          _id
          remaining
          transacted
          date
          description
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

export default function AccountLimitDrawer({ _id }: Props) {
  // Drawer state
  const [open, setOpen] = useState(false)
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
  const { data, fetchMore, loading } = useQuery(GET_CUSTOMER_LIMIT_HISTORY, {
    variables: {
      first: rows,
      customerId: _id,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })
  const customer = (data as any)?.customerReport
  // Responsiveness
  const isMobile = useIsMobile()

  const { total, nodes, endCursor } = useMemo(() => {
    const result = data as any
    const nodes =
      result?.customerLimitHistoryTable?.edges?.map((edge: any) => edge.node) ||
      []
    const hasNextPage =
      result?.customerLimitHistoryTable?.pageInfo?.hasNextPage || false
    const endCursor =
      result?.customerLimitHistoryTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.customerLimitHistoryTable?.pages || 1,
    }))

    return {
      total: result?.customerLimitHistoryTable?.total || 0,
      pages: result?.customerLimitHistoryTable?.pages || 0,
      nodes,
      hasNextPage,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<IAccountLimitHistoryItem>[] = useMemo(
    () => [
      {
        id: "transacted",
        header: "Transacted",
        cell: ({ row }) => {
          const value = row.original.transacted
          return (
            <span className={cn(value > 0 ? "text-green-700" : "text-red-700")}>
              {value > 0 ? "+" : ""}
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(value)}
            </span>
          )
        },
      },
      {
        id: "remaining",
        header: "Remaining",
        cell: ({ row }) => {
          const value = row.original.remaining
          return (
            <span>
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(value)}
            </span>
          )
        },
      },
      {
        id: "date",
        header: "Date",
        cell: ({ row }) => {
          const value = row.original.date || new Date().toISOString()
          return (
            <span>
              {format(new Date(Number(value)), "MMM dd, yyyy hh:mm a")}
            </span>
          )
        },
      },
      {
        id: "description",
        header: "Note",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description || "-"}
          </span>
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
          first: rows,
          after: endCursor,
        },
        updateQuery: (prev: any, { fetchMoreResult: more }: any) => {
          if (!more) return prev
          const cursorSet = new Set([
            ...prev.customerLimitHistoryTable.edges.map(
              (edge: any) => edge.cursor
            ),
            ...more.customerLimitHistoryTable.edges.map(
              (edge: any) => edge.cursor
            ),
          ])
          const filteredEdges = [
            ...prev.customerLimitHistoryTable.edges,
            ...more.customerLimitHistoryTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.customerLimitHistoryTable.pageInfo
          return {
            customerLimitHistoryTable: {
              ...more.customerLimitHistoryTable,
              edges: filteredEdges,
              pageInfo,
            },
            customerReport: prev.customerReport,
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
    <Drawer direction="right" modal open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          size="lg"
          className="rounded-md bg-blue-700 font-semibold text-white hover:bg-blue-700/90"
        >
          <CreditCardIcon /> Account Limit
        </Button>
      </DrawerTrigger>
      <DrawerContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="w-full data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-[min(42rem,96vw)]"
      >
        <DrawerHeader className="flex flex-row justify-between">
          <div>
            <DrawerTitle>Account Limit</DrawerTitle>
            <DrawerDescription>
              Current account limit of {customer?.name}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline" size="icon-lg" className="h-full">
              <XIcon />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="flex h-full w-full flex-col gap-2 px-4">
          <div className="grid grid-cols-2 gap-1.5 border p-2">
            <div>
              <Label>Max Account Limit</Label>
              <span className="block text-lg font-medium">
                {new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(customer?.accountLimit?.max || 0)}
              </span>
            </div>
            <div>
              <Label>Remaining</Label>
              <span className="block text-lg font-medium text-muted-foreground">
                {new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(customer?.accountLimit?.current || 0)}
              </span>
            </div>
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
          <div>
            <DataTable
              loading={loading}
              columns={columns}
              data={nodes.slice((page.current - 1) * rows, page.current * rows)}
              noFooter={true}
            />
          </div>
        </div>
        <DrawerFooter className="flex flex-row">
          <SettleBalanceDialog _id={_id!} />
          <AdjustLimitDialog _id={_id!} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
