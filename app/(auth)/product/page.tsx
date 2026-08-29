"use client"
import { Label } from "@/components/ui/label"
import { ImportProducts } from "@/components/custom/entity-imports"
import FormDialog from "./dialogs/form"
import { useCallback, useMemo, useState } from "react"
import gql from "graphql-tag"
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
import { IProductNode } from "@/types/product.type"
import { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/custom/data-table"
import { useTablePage } from "@/hooks/use-table-page"
import ColumnFilter from "@/components/custom/column-filter"
import { FilterType } from "@/types/shared.type"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ViewDialog from "./dialogs/view"
import SortHeader from "@/components/custom/sort-header"
import StatusDialog from "./dialogs/status"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import RowViewDialog from "./dialogs/row-view"
import { cn } from "@/lib/utils"

const GET_PRODUCTS = gql`
  query ProductTable(
    $first: Int
    $after: String
    $search: String
    $filter: [Filter]
    $sort: Sort
  ) {
    productTable(
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
          currentPrice
          sku
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

function Actions({ row }: { row?: IProductNode }) {
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
        <FormDialog
          _id={data?._id?.toString()}
          onClose={() => setOpen(false)}
        />
        <StatusDialog
          _id={data?._id?.toString() || ""}
          status={status || false}
          onClose={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function Page() {
  // Pagination state
  const [rows, setRows] = useState<number>(10)
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
  const { page, total, from, to, nodes, loading, reset, onNext, onPrev } =
    useTablePage<IProductNode>(GET_PRODUCTS, "productTable", {
      first: rows,
      search,
      filter,
      sort,
    })
  // Responsiveness
  const isMobile = useIsMobile()

  const onSearch = useCallback(
    (value: string) => {
      setSearch(value)
      reset()
    },
    [reset]
  )

  const onFilter = useCallback(
    (value: any) => {
      setFilter(value)
      reset()
    },
    [reset]
  )

  const columns: ColumnDef<IProductNode>[] = useMemo(
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
        id: "sku",
        header: () => (
          <SortHeader
            label="SKU"
            sortKey="sku"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "font-medium",
              !row.original.sku && "text-muted-foreground"
            )}
          >
            {row.original.sku || "N/A"}
          </span>
        ),
        footer: () => (
          <ColumnFilter
            label="SKU"
            filterKey="sku"
            filterType={FilterType.TEXT}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "currentPrice",
        header: () => (
          <SortHeader
            label="Current Price"
            sortKey="currentPrice"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {new Intl.NumberFormat("en-PH", {
              style: "currency",
              currency: "PHP",
            }).format(row.original.currentPrice)}
          </span>
        ),
        footer: () => (
          <ColumnFilter
            label="Current Price"
            filterKey="currentPrice"
            filterType={FilterType.NUMBER}
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
    [sort, filter, onFilter]
  )

  return (
    <div className="flex h-full w-full flex-col gap-1.5 p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <Label className="text-xl font-medium">Product</Label>
        <div className="flex items-center gap-1.5">
          <ImportProducts />
          <FormDialog />
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
          Showing {from}-{to} out of {total} result{total === 1 ? "" : "s"}.
        </span>
        <div className="flex gap-1.5">
          <Select
            value={rows.toString()}
            onValueChange={(value) => {
              setRows(Number(value))
              reset()
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
              onClick={onPrev}
              disabled={page.current === 1}
              variant="outline"
            >
              Prev
            </Button>
            <ButtonGroupText>{`Page ${page.current} of ${page.max}`}</ButtonGroupText>
            <Button
              onClick={onNext}
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
        data={nodes}
        actionsColumn={<Actions />}
        rowView={<RowViewDialog />}
      />
    </div>
  )
}
