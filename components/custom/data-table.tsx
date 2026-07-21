import React, {
  cloneElement,
  createElement,
  ReactElement,
  ReactNode,
  useState,
} from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { cn } from "@/lib/utils"
import { Skeleton } from "../ui/skeleton"

const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-full", "w-2/3", "w-1/3"]

type Props<TData, TValue> = {
  loading?: boolean
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  actionsColumn?: ReactNode
  rowView?: ReactNode
  noFooter?: boolean
}

export default function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  actionsColumn,
  rowView,
  noFooter = false,
}: Props<TData, TValue>) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  // For row view dialog
  const [viewId, setViewId] = useState<string | null>(null)
  const [openView, setOpenView] = useState(false)

  const onCloseView = () => {
    setViewId(null)
    setOpenView(false)
  }

  return (
    <>
      {rowView &&
        cloneElement(rowView as ReactElement<any>, {
          _id: viewId,
          open: openView,
          setOpen: setOpenView,
          onClose: onCloseView,
        })}
      <Table className="border">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
          {!noFooter &&
            table.getFooterGroups().map((footerGroup) => (
              <TableRow key={footerGroup.id}>
                {footerGroup.headers.map((footer) => {
                  return (
                    <TableHead
                      key={footer.id}
                      style={{
                        width: `${footer.getSize()}px`,
                      }}
                    >
                      {footer.isPlaceholder
                        ? null
                        : flexRender(
                            footer.column.columnDef.footer,
                            footer.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 8 }).map((_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`}>
                {columns.map((column, colIndex) => (
                  <TableCell key={column.id || colIndex}>
                    <Skeleton
                      className={cn(
                        "h-4",
                        SKELETON_WIDTHS[
                          (rowIndex + colIndex) % SKELETON_WIDTHS.length
                        ]
                      )}
                    />
                  </TableCell>
                ))}
                {actionsColumn ? (
                  <TableCell className="w-1 whitespace-nowrap">
                    <Skeleton className="size-7" />
                  </TableCell>
                ) : undefined}
              </TableRow>
            ))
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      cell.column.id !== "select" &&
                        cell.column.id !== "registers" &&
                        "cursor-pointer"
                    )}
                    onClick={() => {
                      if (
                        cell.column.id === "select" ||
                        cell.column.id === "registers"
                      )
                        return
                      setViewId((row.original as any)._id)
                      setOpenView((prev) => !prev)
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
                {actionsColumn ? (
                  <TableCell className="w-1 whitespace-nowrap">
                    {React.cloneElement(
                      actionsColumn as React.ReactElement<any>,
                      {
                        row: row.original,
                      }
                    )}
                  </TableCell>
                ) : undefined}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  )
}
