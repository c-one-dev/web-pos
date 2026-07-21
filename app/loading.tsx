import React from "react"
import { MorphingInfinity } from "@/components/morphing-infinity"

export default function Loading() {
  return (
    <div className="flex h-svh w-full flex-col items-center justify-center gap-3">
      <MorphingInfinity className="text-primary size-10" />
      <span className="text-muted-foreground text-sm">
        C-ONE POS System
      </span>
    </div>
  )
}
