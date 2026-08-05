import React from "react"
import { MorphingInfinity } from "@/components/morphing-infinity"

export default function Loading() {
  return (
    <div className="flex h-svh w-full flex-col items-center justify-center gap-3">
      <MorphingInfinity className="size-10 text-primary" />
      <span className="text-sm text-muted-foreground">C-ONE POS System</span>
    </div>
  )
}
