import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Loading placeholders shaped like the screens they stand in for.
 *
 * A spinner says "wait"; these say what is coming, and because they reuse the
 * real layout's grid and spacing the content does not jump when it arrives.
 * They are for CONTENT that is being fetched - a form mid-submit still shows
 * a spinner, since nothing about the page is about to change shape.
 */

/** Register pickers and any other grid of summary cards. */
export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="mt-2 h-8 w-24" />
        </div>
      ))}
    </div>
  )
}

/** A page built from stat tiles above a table - the shift reports. */
export function ReportPageSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="flex h-full w-full flex-col gap-3 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: tiles }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={8} />
    </div>
  )
}

/** Rows for a table that renders its own header. */
export function TableSkeleton({
  rows = 6,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-3">
          {Array.from({ length: columns }).map((_, column) => (
            <Skeleton
              key={column}
              className={cn("h-4 flex-1", column === 0 && "flex-[2]")}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Drawers and dialogs that load one record: a sale, a session, a customer. */
export function DetailSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex w-full flex-col gap-4 p-1">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: rows * 2 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}
