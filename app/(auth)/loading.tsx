import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex h-full w-full flex-col gap-1.5 p-2.5">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-8" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-1.5">
          <Skeleton className="h-9 w-18" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <div className="border">
        <div className="flex items-center gap-4 border-b p-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, row) => (
          <div
            key={row}
            className="flex items-center gap-4 border-b p-2.5 last:border-b-0"
          >
            {Array.from({ length: 5 }).map((_, col) => (
              <Skeleton key={col} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
