"use client"
import { Label } from "@/components/ui/label"
import FormDialog from "./dialogs/form"
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
import { IUserNode, Role } from "@/types/user.type"
import { ColumnDef } from "@tanstack/react-table"
import DataTable from "@/components/custom/data-table"
import ColumnFilter from "@/components/custom/column-filter"
import { FilterType } from "@/types/shared.type"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ViewDialog from "./dialogs/view"
import PermissionsDialog from "./dialogs/permissions"
import { useSession } from "next-auth/react"
import SortHeader from "@/components/custom/sort-header"
import StatusDialog from "./dialogs/status"
import ResetPasswordDialog from "./dialogs/reset-password"
import Image from "next/image"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import RowViewDialog from "./dialogs/row-view"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const GET_USERS = gql`
  query UserTable(
    $first: Int
    $after: String
    $search: String
    $filter: [Filter]
    $sort: Sort
  ) {
    userTable(
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
          image
          fullName
          role
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

function Actions({ row }: { row?: IUserNode }) {
  const [open, setOpen] = useState(false)
  const data = useMemo(() => row, [row])
  const status = data?.isActive
  const { data: session } = useSession()
  // Permissions is an ADMIN/MANAGER-only action - the real enforcement is the
  // role check in resolvers/user.resolver.ts (assertCanManagePermissions),
  // this just keeps the item out of a Cashier's menu. Nobody edits their own
  // permissions, so it's hidden on your own row too.
  const role = (session as any)?.user?.role
  const canManagePermissions =
    (role === "ADMIN" || role === "MANAGER") &&
    (session as any)?.user?._id?.toString() !== data?._id?.toString()
  // Resetting a password is ADMIN/MANAGER-only too, enforced for real in
  // resolvers/user.resolver.ts. Hidden on your own row: you change your own
  // password through the profile form, not by locking yourself out.
  const canResetPassword =
    (role === "ADMIN" || role === "MANAGER") &&
    (session as any)?.user?._id?.toString() !== data?._id?.toString()

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
        {canResetPassword && (
          <ResetPasswordDialog
            _id={data?._id?.toString() || ""}
            onClose={() => setOpen(false)}
          />
        )}
        {canManagePermissions && (
          <PermissionsDialog
            _id={data?._id?.toString() || ""}
            onClose={() => setOpen(false)}
          />
        )}
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
  const { data, fetchMore, loading } = useQuery(GET_USERS, {
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
    const nodes = result?.userTable?.edges?.map((edge: any) => edge.node) || []
    const hasNextPage = result?.userTable?.pageInfo?.hasNextPage || false
    const endCursor = result?.userTable?.pageInfo?.endCursor || null

    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({
      ...prev,
      max: result?.userTable?.pages || 1,
    }))

    return {
      total: result?.userTable?.total || 0,
      pages: result?.userTable?.pages || 0,
      nodes,
      hasNextPage,
      endCursor,
    }
  }, [data])

  const columns: ColumnDef<IUserNode>[] = useMemo(
    () => [
      {
        id: "image",
        cell: ({ row }) =>
          row.original.image ? (
            <Image
              src={row.original.image}
              alt={row.original.fullName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <Avatar className="h-8 w-8">
              <AvatarFallback>{row.original.fullName[0]}</AvatarFallback>
            </Avatar>
          ),
        size: 10,
      },
      {
        id: "name",
        header: () => (
          <SortHeader
            label="Name"
            sortKey="fullName"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.fullName}</span>
        ),
        footer: () => (
          <ColumnFilter
            label="Name"
            filterKey="fullName"
            filterType={FilterType.TEXT}
            filter={filter}
            onFilterChange={onFilter}
          />
        ),
      },
      {
        id: "role",
        header: () => (
          <SortHeader
            label="Role"
            sortKey="role"
            sortState={sort}
            onSortChange={setSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.role}</span>
        ),
        footer: () => (
          <ColumnFilter
            label="Role"
            filterKey="role"
            filterType={FilterType.SELECT}
            filter={filter}
            onFilterChange={onFilter}
            options={Object.values(Role).map((role) => ({
              label: role,
              value: role,
            }))}
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
            ...prev.userTable.edges.map((edge: any) => edge.cursor),
            ...more.userTable.edges.map((edge: any) => edge.cursor),
          ])
          const filteredEdges = [
            ...prev.userTable.edges,
            ...more.userTable.edges,
          ].filter((edge: any) => cursorSet.has(edge.cursor))
          const pageInfo = more.userTable.pageInfo
          return {
            userTable: {
              ...more.userTable,
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
        <Label className="text-xl font-medium">User</Label>
        <FormDialog />
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
