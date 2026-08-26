import { Button } from "@/components/ui/button"
import { refetchOnlyReadyQueries } from "@/lib/refetch"
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
import { useMutation, useQuery } from "@apollo/client/react"
import { GiftIcon, TrashSimpleIcon, XIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import AdjustCreditDialog from "./adjust-credit"
import { Separator } from "@/components/ui/separator"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { ColumnDef } from "@tanstack/react-table"
import { IStoreCreditHistoryItem } from "@/types/customer.type"
import DataTable from "@/components/custom/data-table"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import RowViewCreditHistoryItemDialog from "./row-credit-history-item"

type Props = {
  _id?: string
}

const GET_CUSTOMER_CREDIT_HISTORY = gql`
  query ViewStoreCreditDetails($first: Int, $after: String, $customerId: ID!) {
    customerReport(_id: $customerId) {
      _id
      name
      storeCredit {
        current
      }
    }
    customerCreditHistoryTable(
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

const DELETE_CREDIT_HISTORY_ITEM = gql`
  mutation DeleteStoreCreditHistoryItem($customerId: ID!, $itemId: ID!) {
    deleteStoreCreditHistoryItem(customerId: $customerId, itemId: $itemId) {
      ok
      message
    }
  }
`

/**
 * Deletes one store credit entry outright. There is no undo and no reversing
 * line - the row is removed and the balance re-derived - so the confirmation
 * spells out the amount and the resulting balance rather than asking a vague
 * "are you sure".
 */
function DeleteCreditEntry({
  customerId,
  item,
  currentBalance,
}: {
  customerId?: string
  item: IStoreCreditHistoryItem
  currentBalance: number
}) {
  const [open, setOpen] = useState(false)
  const [deleteEntry, { loading }] = useMutation(DELETE_CREDIT_HISTORY_ITEM, {
    refetchQueries: ["ViewStoreCreditDetails", "CustomerReport", "Customer"],
    // "Customer" is also mounted by parked row-view dialogs with no _id;
    // refetching those by name sends no variables and errors on an
    // operation that already succeeded.
    onQueryUpdated: refetchOnlyReadyQueries,
    awaitRefetchQueries: true,
  })

  const peso = (value: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value)

  const balanceAfter = currentBalance - (item.transacted || 0)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete this store credit entry"
        >
          <TrashSimpleIcon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this store credit entry?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                This removes the {peso(item.transacted || 0)} entry permanently.
                The balance becomes{" "}
                <span className="font-semibold text-foreground">
                  {peso(balanceAfter)}
                </span>
                .
              </p>
              <p>
                The entry is not reversed, it is erased - the history will no
                longer show it ever happened. This cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            disabled={loading}
            onClick={async (event) => {
              // Radix closes on click; keep it open so a failure is visible
              // instead of the dialog vanishing as if it worked.
              event.preventDefault()
              try {
                const result: any = await deleteEntry({
                  variables: { customerId, itemId: item._id?.toString() },
                })
                if (result?.data?.deleteStoreCreditHistoryItem?.ok) {
                  toast.success(
                    result.data.deleteStoreCreditHistoryItem.message
                  )
                  setOpen(false)
                }
              } catch (error: any) {
                toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
              }
            }}
          >
            Yes, delete it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function StoreCreditDrawer({ _id }: Props) {
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
  const { data, fetchMore, loading } = useQuery(GET_CUSTOMER_CREDIT_HISTORY, {
    variables: {
      first: rows,
      customerId: _id,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })
  const customer = (data as any)?.customerReport
  // Shown in the delete confirmation so the cashier sees the balance the
  // deletion will produce, not just the amount being removed.
  const currentBalance = customer?.storeCredit?.current || 0
  // Responsiveness
  const isMobile = useIsMobile()

  const { total, nodes, endCursor } = useMemo(() => {
    const result = data as any
    const nodes =
      result?.customerCreditHistoryTable?.edges?.map(
        (edge: any) => edge.node
      ) || []
    const hasNextPage =
      result?.customerCreditHistoryTable?.pageInfo?.hasNextPage || false
    const endCursor =
      result?.customerCreditHistoryTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.customerCreditHistoryTable?.pages || 1,
    }))

    return {
      total: result?.customerCreditHistoryTable?.total || 0,
      pages: result?.customerCreditHistoryTable?.pages || 0,
      nodes,
      hasNextPage,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<IStoreCreditHistoryItem>[] = useMemo(
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
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DeleteCreditEntry
              customerId={_id}
              item={row.original}
              currentBalance={currentBalance}
            />
          </div>
        ),
      },
    ],
    [_id, currentBalance]
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
            ...prev.customerCreditHistoryTable.edges.map(
              (edge: any) => edge.cursor
            ),
            ...more.customerCreditHistoryTable.edges.map(
              (edge: any) => edge.cursor
            ),
          ])
          const filteredEdges = [
            ...prev.customerCreditHistoryTable.edges,
            ...more.customerCreditHistoryTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.customerCreditHistoryTable.pageInfo
          return {
            customerCreditHistoryTable: {
              ...more.customerCreditHistoryTable,
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
          className="rounded-md bg-emerald-600 font-semibold text-white hover:bg-emerald-600/90"
        >
          <GiftIcon /> Store Credit
        </Button>
      </DrawerTrigger>
      <DrawerContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="w-full data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-[min(42rem,96vw)]"
      >
        <DrawerHeader className="flex flex-row justify-between">
          <div>
            <DrawerTitle>Store Credit</DrawerTitle>
            <DrawerDescription>
              Remaining Store credit of {customer?.name}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline" size="icon-lg" className="h-full">
              <XIcon />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="flex h-full w-full flex-col gap-2 px-4">
          <div className="flex flex-col gap-1.5 border p-2">
            <Label>Remaining Store Credit</Label>
            <span className="block text-lg font-medium">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(customer?.storeCredit?.current || 0)}
            </span>
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
              rowView={<RowViewCreditHistoryItemDialog customerId={_id} />}
            />
          </div>
        </div>
        <DrawerFooter className="flex flex-row">
          <AdjustCreditDialog _id={_id!} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
