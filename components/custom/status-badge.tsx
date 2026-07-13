import { Badge, badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

// Central status -> color mapping, shared by every table/detail view in the
// app. Add new statuses here rather than one-off coloring them per page, so
// the same status always reads the same color everywhere it appears.
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // Sale status
  PENDING: "warning",
  COMPLETED: "success",
  REFUNDED: "info",
  VOIDED: "destructive",
  // Sale payment status
  PAID: "success",
  UNPAID: "destructive",
  PARTIALLY_PAID: "warning",
  // Generic active/inactive
  ACTIVE: "success",
  INACTIVE: "secondary",
}

function StatusBadge({
  status,
  className,
}: Readonly<{
  status: string
  className?: string
}>) {
  const variant = STATUS_VARIANTS[status] ?? "secondary"

  return (
    <Badge variant={variant} className={className}>
      {status.replaceAll("_", " ")}
    </Badge>
  )
}

export { StatusBadge, STATUS_VARIANTS }
