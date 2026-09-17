"use client"
import { format } from "date-fns"
import { ArrowElbowDownRightIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { businessDateOf, countsTowardPreviousDay } from "@/lib/business-day"

// Sale and payment dates reach the client as millisecond strings.
const toDate = (value?: string | number | Date | null) => {
  if (value === null || value === undefined || value === "") return null
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === "string" ? Number(value) : value)
  return Number.isNaN(date.getTime()) ? null : date
}

// For date-only cells: the business day the moment counts toward, so a sale
// rung up at 1AM on Sep 18 reads Sep 17 - the day it's filtered and totalled
// under.
export function BusinessDate({
  value,
  pattern = "PP",
  fallback = "-",
}: {
  value?: string | number | Date | null
  pattern?: string
  fallback?: string
}) {
  const date = toDate(value)
  return <>{date ? format(businessDateOf(date), pattern) : fallback}</>
}

// For cells that show a time: that time has to stay the real moment, so the
// business day goes on a line of its own - and only when it differs.
export function CountedAsNote({
  value,
  className,
}: {
  value?: string | number | Date | null
  className?: string
}) {
  const date = toDate(value)
  if (!date || !countsTowardPreviousDay(date)) return null
  return (
    <span className={cn("block text-xs text-muted-foreground", className)}>
      <ArrowElbowDownRightIcon className="inline" /> Counted as{" "}
      {format(businessDateOf(date), "MMM d")}
    </span>
  )
}
