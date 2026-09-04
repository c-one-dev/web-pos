"use client"
import { Label } from "@/components/ui/label"
import { ImportCustomers } from "@/components/custom/entity-imports"
import FormDialog from "./_dialogs/form"
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
import { GearIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { ICustomerNode } from "@/types/customer.type"
import { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/custom/data-table"
import { usePermissions } from "@/hooks/use-permissions"
import ColumnFilter from "@/components/custom/column-filter"
import { FilterType } from "@/types/shared.type"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ViewDialog from "./_dialogs/view"
import SortHeader from "@/components/custom/sort-header"
import StatusDialog from "./_dialogs/status"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Store Setup -> Customers opens the same customer drawer as
// Reports -> Customer: sales history, plus the Store Credit and Account Limit
// panels with their transaction history and adjust actions. One component so
// the two pages can't drift apart.
import RowViewDialog from "@/app/(auth)/reports/customers/dialogs/row-view"

const GET_CUSTOMERS = gql`
  query CustomerTable(
    $first: Int
    $after: String
    $search: String
    $filter: [Filter]
    $sort: Sort
  ) {
    customerTable(
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
          name
          isActive
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

function Actions({
  row,
  readOnly,
}: {
  row?: ICustomerNode
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const data = useMemo(() => row, [row])
  const status = data?.isActive

  return (
    <DropdownMenu modal open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <GearIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="start">
        <ViewDialog
          _id={data?._id?.toString() || ""}
          onClose={() => setOpen(false)}
        />
        {!readOnly && (
          <>
            <FormDialog
              _id={data?._id?.toString()}
              onClose={() => setOpen(false)}
            />
            <StatusDialog
              _id={data?._id?.toString() || ""}
              status={status || false}
              onClose={() => setOpen(false)}
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function Page() {
  // The server enforces these permissions per field either way
  // (app/graphql/route.ts) - this keeps buttons out of the menu that would
  // only fail, which is what a view-only role should see.
  const { can } = usePermissions()
  const isReadOnly = !can(
    "customers.customer.create",
    "customers.customer.edit",
    "customers.customer.status"
  )

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
  const { data, fetchMore, loading } = useQuery(GET_CUSTOMERS, {
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
      result?.customerTable?.edges?.map((edge: any) => edge.node) || []
    const hasNextPage = result?.customerTable?.pageInfo?.hasNextPage || false
    const endCursor = result?.customerTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.customerTable?.pages || 1,
    }))

    return {
      total: result?.customerTable?.total || 0,
      pages: result?.customerTable?.pages || 0,
      nodes,
      hasNextPage,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<ICustomerNode>[] = useMemo(
    () => [
      {
        id: "name",
        header: () => (
          <SortHeader
            label="Name"
            sortKey="name"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
        footer: () => (
          <ColumnFilter
            label="Name"
            filterKey="name"
            filterType={FilterType.TEXT}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "isActive",
        header: () => (
          <SortHeader
            label="Active"
            sortKey="isActive"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.isActive ? "Yes" : "No"}
          </span>
        ),
        footer: () => (
          <ColumnFilter
            label="Active"
            filterKey="isActive"
            filterType={FilterType.BOOLEAN}
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
            ...prev.customerTable.edges.map((edge: any) => edge.cursor),
            ...more.customerTable.edges.map((edge: any) => edge.cursor),
          ])
          const filteredEdges = [
            ...prev.customerTable.edges,
            ...more.customerTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.customerTable.pageInfo
          return {
            customerTable: {
              ...more.customerTable,
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
      <div className="flex items-center justify-between gap-1.5">
        <Label className="text-xl font-medium">Customer</Label>
        <div className="flex items-center gap-1.5">
          {!isReadOnly && (
            <>
              <ImportCustomers />
              <FormDialog />
            </>
          )}
        </div>
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
        actionsColumn={<Actions readOnly={isReadOnly} />}
        rowView={<RowViewDialog />}
      />
    </div>
  )
}
