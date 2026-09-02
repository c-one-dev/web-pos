import { Skeleton } from "@/components/ui/skeleton"

/**
 * Stand-in for the register while `processedRegister` loads.
 *
 * Mirrors the real layout - product column, type strip, card grid, cart panel
 * - and reuses the same grid breakpoints, so the cards settle into the same
 * positions when the data lands instead of jumping.
 */
export default function ProcessSaleSkeleton() {
  return (
    <div className="flex h-full w-full flex-col lg:flex-row lg:overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 bg-muted p-2.5">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
        {/* Type strip: a fixed handful, since how many there are is exactly
            what is not known yet. */}
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-24 shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 15 }).map((_, index) => (
            <div
              key={index}
              className="flex h-36 flex-col overflow-hidden border sm:h-45"
            >
              <Skeleton className="flex-1 rounded-none" />
              <div className="flex flex-col items-center gap-1.5 bg-background py-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2.5 border-t p-2 lg:w-96 lg:border-t-0 lg:border-l">
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="size-12 shrink-0" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
