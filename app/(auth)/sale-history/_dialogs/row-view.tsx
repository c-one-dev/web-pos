import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useMutation, useQuery } from "@apollo/client/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import {
  ArrowElbowDownRightIcon,
  CopySimpleIcon,
  EnvelopeSimpleIcon,
  PencilSimpleIcon,
  PrinterIcon,
  ProhibitIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/custom/status-badge"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type Props = {
  _id?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
  external?: boolean
}

const GET_SALE = gql`
  query Sale($_id: ID!) {
    sale(_id: $_id) {
      _id
      saleNumber
      subTotal
      discount
      total
      receivedAmount
      changeAmount
      netAmount
      refundedAmount
      notes
      currentSaleStatus
      isOnAccount
      isEditable
      createdAt
      customer {
        _id
        name
      }
      items {
        snapshotName
        snapshotPrice
        quantity
        discount
        price
        subTotal
        total
        refundedQuantity
      }
      refunds {
        amount
        note
        date
        by {
          _id
          name
        }
        items {
          snapshotName
          quantity
          amount
        }
      }
      payments {
        amount
        change
        note
        date
        method {
          _id
          name
        }
        payment {
          _id
          by {
            _id
            name
            surname
          }
        }
      }
      saleStatusHistory {
        status
        date
        by {
          _id
          name
          surname
        }
      }
      register {
        _id
        name
      }
      by {
        _id
        name
        surname
      }
      currentSalePaymentStatus
    }
  }
`

const VOID_SALE = gql`
  mutation VoidSale($_id: ID!) {
    voidSale(_id: $_id) {
      ok
      message
    }
  }
`

const UPDATE_SALE_NOTES = gql`
  mutation UpdateSaleNotes($_id: ID!, $notes: String) {
    updateSaleNotes(_id: $_id, notes: $notes) {
      ok
      message
      data
    }
  }
`

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

// One boxed block per topic, so every section of the drawer gets the same
// header treatment instead of each repeating its own muted wrapper.
function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Label className="text-base font-semibold text-primary">{title}</Label>
        {action}
      </div>
      {children}
    </section>
  )
}

function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{children}</dd>
    </div>
  )
}

function Amount({
  label,
  value,
  className,
}: {
  label: string
  value?: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums">{peso(value || 0)}</dd>
    </div>
  )
}

// Click-to-copy text with the same tooltip everywhere it appears.
function CopyText({
  value,
  fallback,
  toastLabel,
}: {
  value?: string
  fallback?: string
  toastLabel: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "cursor-pointer",
            value
              ? "font-medium text-primary hover:underline"
              : "text-muted-foreground"
          )}
          onClick={() => {
            if (!value) {
              toast.warning(`No ${toastLabel.toLowerCase()} to copy.`)
              return
            }
            navigator.clipboard.writeText(value)
            toast.success(`${toastLabel} copied to clipboard.`)
          }}
        >
          {value || fallback || "-"}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Copy to clipboard.</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default function RowViewDialog({
  _id,
  open,
  setOpen,
  onClose,
  external = false,
}: Props) {
  const router = useRouter()
  const { data, loading }: any = useQuery(GET_SALE, {
    variables: {
      _id,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [isPending, startTransition] = useTransition()
  const [voidSale] = useMutation(VOID_SALE, {
    refetchQueries: ["Sale", "SaleHistoryTable"],
    awaitRefetchQueries: true,
  })
  const [updateSaleNotes, { loading: savingNotes }] = useMutation(
    UPDATE_SALE_NOTES,
    {
      refetchQueries: ["Sale", "SaleHistoryTable"],
      awaitRefetchQueries: true,
    }
  )
  // Notes are edited in place here rather than by reopening the whole sale in
  // Process Sale, which is why they have their own mutation - see
  // resolvers/sale.resolver.ts.
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState("")
  const savedNotes = data?.sale?.notes || ""

  // Refill the draft whenever the dialog loads a different sale, so reopening
  // never shows the previous sale's text.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingNotes(false)
    setNotesDraft(savedNotes)
  }, [_id, savedNotes])

  const handleSaveNotes = async () => {
    try {
      const result: any = await updateSaleNotes({
        variables: { _id, notes: notesDraft },
      })
      if (result.data.updateSaleNotes.ok) {
        toast.success(result.data.updateSaleNotes.message)
        setEditingNotes(false)
      }
    } catch (error: any) {
      toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
    }
  }

  const handleCopyNotes = () => {
    if (!savedNotes) {
      toast.warning("No notes to copy.")
      return
    }
    navigator.clipboard.writeText(savedNotes)
    toast.success("Notes copied to clipboard.")
  }

  const handleClose = () => {
    setOpen?.(false)
    onClose?.()
  }

  const sale = data?.sale
  const refundedAmount = sale?.refundedAmount || 0
  const refunds = sale?.refunds || []
  const isVoided = sale?.currentSaleStatus === "VOIDED"

  const handleVoid = () =>
    startTransition(async () => {
      try {
        const result: any = await voidSale({ variables: { _id } })
        if (result.data.voidSale.ok) {
          toast.success(result.data.voidSale.message)
        }
      } catch (error: any) {
        toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
      }
    })

  return (
    <Drawer modal open={open} onOpenChange={handleClose} direction="right">
      <DrawerContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="w-full data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-[min(80rem,96vw)]"
      >
        <DrawerHeader className="gap-3 border-b bg-muted/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DrawerTitle className="flex flex-wrap items-center gap-2">
                Sales Order
                <span className="font-mono text-sm font-normal text-muted-foreground">
                  {sale?.saleNumber || "-"}
                </span>
                {sale?.currentSaleStatus && (
                  <StatusBadge status={sale.currentSaleStatus} />
                )}
                {sale?.currentSalePaymentStatus && (
                  <StatusBadge status={sale.currentSalePaymentStatus} />
                )}
                {refundedAmount > 0 &&
                  sale?.currentSaleStatus !== "REFUNDED" && (
                    <Badge variant="info">
                      {peso(refundedAmount)} refunded
                    </Badge>
                  )}
              </DrawerTitle>
              <DrawerDescription>
                {sale?.register?.name
                  ? `Rung up on ${sale.register.name}`
                  : "Details of this sales order"}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0">
                <XIcon />
              </Button>
            </DrawerClose>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" className="rounded-md">
              <PrinterIcon /> Print
            </Button>
            <Button size="sm" variant="outline" className="rounded-md">
              <EnvelopeSimpleIcon /> Email
            </Button>
            {/*
              Only offered while the sale's shift is still open - once the
              register closes, its tally is a frozen record computed from
              these sales, so updateSale refuses the edit too.
            */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-md"
                    disabled={loading || !sale?.isEditable}
                    onClick={() =>
                      router.push(`/process/${sale?.register?._id}?edit=${_id}`)
                    }
                  >
                    <PencilSimpleIcon /> Edit
                  </Button>
                </span>
              </TooltipTrigger>
              {!loading && !sale?.isEditable && (
                <TooltipContent>
                  {isVoided
                    ? "A voided sale can no longer be edited."
                    : refundedAmount > 0
                      ? "This sale has been refunded, so its items are frozen."
                      : "This sale's register shift is already closed, so it can no longer be edited."}
                </TooltipContent>
              )}
            </Tooltip>
            {/*
              Rings the same goods up again as a brand new sale. Unlike Edit
              this stays available on voided or closed-shift sales, since it
              writes a new sale and never touches this one.
            */}
            <Button
              size="sm"
              variant="outline"
              className="rounded-md"
              disabled={loading}
              onClick={() =>
                router.push(`/process/${sale?.register?._id}?duplicate=${_id}`)
              }
            >
              <CopySimpleIcon /> Duplicate
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-md"
                  disabled={isVoided || loading || isPending}
                >
                  <ProhibitIcon /> {isVoided ? "Voided" : "Void"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Void this sale?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This marks sale {sale?.saleNumber} as voided and hands back
                    anything it drew from the customer&apos;s account limit or
                    store credit. Cash and other tenders must still be settled
                    at the drawer. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive"
                    onClick={handleVoid}
                  >
                    Yes, Void Sale
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </DrawerHeader>

        {loading && !sale ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-10" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto p-4">
            <Section title="Sales Summary">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <Meta label="Customer">
                  {sale?.customer ? sale.customer.name : "Walk-in"}
                </Meta>
                <Meta label="Sale No.">
                  <CopyText
                    value={sale?.saleNumber}
                    fallback="No sales no."
                    toastLabel="Sale number"
                  />
                </Meta>
                <Meta label="Order date">
                  {sale?.createdAt
                    ? format(Number(sale.createdAt), "PPpp")
                    : "-"}
                </Meta>
                <Meta label="Cashier">
                  {sale?.by ? `${sale.by.name} ${sale.by.surname}` : "-"}
                </Meta>
              </dl>

              <div className="mt-3 divide-y border-y">
                {sale?.items?.length ? (
                  sale.items.map((item: any, index: number) => {
                    const refunded = item.refundedQuantity || 0
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-slate-300 text-lg font-semibold text-white">
                            {`${item.snapshotName[0]}${item.snapshotName[1] || ""}`.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate font-medium">
                              {item.snapshotName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {peso(item.price)} × {item.quantity}
                              {refunded > 0 && (
                                <span className="ml-1.5 text-blue-700">
                                  · {refunded} refunded
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">
                          {peso(item.total)}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">No items</p>
                )}
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                <Amount label="Subtotal" value={sale?.subTotal} />
                <Amount label="Discount" value={sale?.discount} />
                <Amount label="Total" value={sale?.total} />
                <Amount label="Received" value={sale?.receivedAmount} />
                <Amount label="Change" value={sale?.changeAmount} />
                {refundedAmount > 0 && (
                  <Amount
                    label="Refunded as store credit"
                    value={refundedAmount}
                    className="text-blue-700"
                  />
                )}
                <div className="flex items-center justify-between border-t pt-1.5 text-base font-semibold">
                  <dt>Net Amount</dt>
                  <dd className="tabular-nums">{peso(sale?.netAmount || 0)}</dd>
                </div>
              </dl>
            </Section>

            <Section
              title="Notes"
              action={
                !editingNotes &&
                !isVoided && (
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={handleCopyNotes}
                        >
                          <CopySimpleIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy to clipboard.</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingNotes(true)}
                        >
                          <PencilSimpleIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit notes.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )
              }
            >
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    disabled={savingNotes}
                    rows={4}
                    className="bg-white"
                    placeholder="Add notes for this sale"
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingNotes}
                      onClick={() => {
                        setNotesDraft(savedNotes)
                        setEditingNotes(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      loading={savingNotes}
                      onClick={handleSaveNotes}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                // whitespace-pre-line keeps the line breaks exactly as they
                // were typed in Process Sale instead of collapsing them.
                <span
                  className={cn(
                    "block w-full cursor-pointer text-sm whitespace-pre-line",
                    savedNotes
                      ? "text-foreground hover:underline"
                      : "text-muted-foreground"
                  )}
                  onClick={() => !isVoided && setEditingNotes(true)}
                >
                  {savedNotes || "No notes. Click to add one."}
                </span>
              )}
            </Section>

            <Section
              title="Payment Summary"
              action={
                <span className="text-xs text-muted-foreground">
                  Status{" "}
                  <StatusBadge
                    status={sale?.currentSalePaymentStatus || "UNPAID"}
                  />
                </span>
              }
            >
              <div className="overflow-x-auto">
                <Table className="border bg-white">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="w-[150px]">User</TableHead>
                      <TableHead className="w-[140px] text-right">
                        Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale?.payments?.length ? (
                      sale.payments.map((payment: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {format(Number(payment.date), "PP")}
                          </TableCell>
                          <TableCell>
                            {payment.method.name}
                            {payment.note != "" && (
                              <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                <ArrowElbowDownRightIcon className="mt-0.5 shrink-0" />
                                <CopyText
                                  value={payment.note}
                                  toastLabel="Note"
                                />
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{payment.payment.by.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {peso(payment.amount - payment.change)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          No payments
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Section>

            {refunds.length > 0 && (
              <Section
                title="Refunds"
                action={
                  <span className="text-xs text-muted-foreground">
                    Issued as store credit
                  </span>
                }
              >
                <div className="overflow-x-auto">
                  <Table className="border bg-white">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[110px]">Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="w-[150px]">User</TableHead>
                        <TableHead className="w-[140px] text-right">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refunds.map((refund: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {format(Number(refund.date), "PP")}
                          </TableCell>
                          <TableCell>
                            {refund.items
                              .map(
                                (item: any) =>
                                  `${item.snapshotName} ×${item.quantity}`
                              )
                              .join(", ")}
                            {refund.note ? (
                              <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                <ArrowElbowDownRightIcon className="mt-0.5 shrink-0" />
                                {refund.note}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>{refund.by?.name || "-"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {peso(refund.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Section>
            )}

            <Section
              title="Sale History"
              action={
                <span className="text-xs text-muted-foreground">
                  Status{" "}
                  <StatusBadge status={sale?.currentSaleStatus || "PENDING"} />
                </span>
              }
            >
              <div className="overflow-x-auto">
                <Table className="border bg-white">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[150px]">User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale?.saleStatusHistory?.length ? (
                      sale.saleStatusHistory.map((item: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {format(Number(item.date), "PP")}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell>{item.by.name}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground"
                        >
                          No status history.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Section>
          </div>
        )}

        <DrawerFooter className="border-t">
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
