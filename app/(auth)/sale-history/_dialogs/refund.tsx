"use client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { MinusIcon, PlusIcon, WalletIcon } from "@phosphor-icons/react"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { refetchOnlyReadyQueries } from "@/lib/refetch"

type Props = {
  _id: string
  open: boolean
  setOpen: (open: boolean) => void
}

const GET_SALE_FOR_REFUND = gql`
  query SaleForRefund($_id: ID!) {
    sale(_id: $_id) {
      _id
      saleNumber
      total
      refundedAmount
      currentSaleStatus
      customer {
        _id
        name
        storeCredit {
          current
        }
      }
      items {
        snapshotName
        quantity
        total
        refundedQuantity
      }
    }
  }
`

const REFUND_SALE_ITEMS = gql`
  mutation RefundSaleItems(
    $_id: ID!
    $items: [RefundItemInput!]!
    $note: String
  ) {
    refundSaleItems(_id: $_id, items: $items, note: $note) {
      ok
      message
      data
    }
  }
`

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)

export default function RefundDialog({ _id, open, setOpen }: Props) {
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [note, setNote] = useState("")
  const { data, loading }: any = useQuery(GET_SALE_FOR_REFUND, {
    variables: { _id },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [refundSaleItems, { loading: refunding }] = useMutation(
    REFUND_SALE_ITEMS,
    {
      refetchQueries: ["Sale", "SaleHistoryTable", "SaleRowActions"],
      onQueryUpdated: refetchOnlyReadyQueries,
      awaitRefetchQueries: true,
    }
  )

  const sale = data?.sale
  const items = useMemo(() => sale?.items ?? [], [sale])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuantities({})
    setNote("")
  }, [_id, open])

  // A sale-level discount isn't inside item.total, so the refund is worth
  // proportionally less than the raw line total. Mirrors the same ratio the
  // server applies in refundSaleItems - shown here so the cashier sees the
  // real figure before confirming, not a number that shrinks on save.
  const grossItemTotal = items.reduce(
    (sum: number, item: any) => sum + item.total,
    0
  )
  const discountRatio =
    grossItemTotal > 0 ? (sale?.total ?? 0) / grossItemTotal : 0

  const refundTotal = items.reduce((sum: number, item: any, index: number) => {
    const quantity = quantities[index] || 0
    if (!quantity) return sum
    return sum + (item.total / item.quantity) * quantity * discountRatio
  }, 0)

  const selectedCount = Object.values(quantities).reduce(
    (sum, quantity) => sum + quantity,
    0
  )
  const isVoided = sale?.currentSaleStatus === "VOIDED"
  const hasCustomer = !!sale?.customer
  const remainingFor = (item: any) =>
    item.quantity - (item.refundedQuantity || 0)
  const anythingLeft = items.some((item: any) => remainingFor(item) > 0)
  const blockedReason = isVoided
    ? "A voided sale can't be refunded."
    : !hasCustomer
      ? "This is a walk-in sale. Store credit needs a customer account to credit, so add a customer to the sale first or void it instead."
      : !anythingLeft
        ? "Every item on this sale has already been refunded."
        : null

  const setQuantity = (index: number, next: number, max: number) =>
    setQuantities((prev) => ({
      ...prev,
      [index]: Math.max(0, Math.min(next, max)),
    }))

  const onRefund = async () => {
    try {
      const result: any = await refundSaleItems({
        variables: {
          _id,
          items: Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([index, quantity]) => ({
              itemIndex: Number(index),
              quantity,
            })),
          note,
        },
      })
      if (result.data.refundSaleItems.ok) {
        toast.success(result.data.refundSaleItems.message)
        setOpen(false)
      }
    } catch (error: any) {
      toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
    }
  }

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <WalletIcon size={18} />
            Refund {sale?.saleNumber ? `- ${sale.saleNumber}` : ""}
          </DialogTitle>
          <DialogDescription>
            Refunds are issued as store credit. No cash leaves the drawer and
            the original payment is left untouched.
          </DialogDescription>
        </DialogHeader>

        {loading && !sale ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : blockedReason ? (
          <p className="py-4 text-sm text-muted-foreground">{blockedReason}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {items.map((item: any, index: number) => {
                const remaining = remainingFor(item)
                const quantity = quantities[index] || 0
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 border p-2"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {item.snapshotName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCurrency(item.total / item.quantity)} each ·{" "}
                        {remaining} of {item.quantity} refundable
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={quantity === 0 || remaining === 0}
                        onClick={() =>
                          setQuantity(index, quantity - 1, remaining)
                        }
                      >
                        <MinusIcon />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={quantity >= remaining}
                        onClick={() =>
                          setQuantity(index, quantity + 1, remaining)
                        }
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ex. Damaged item"
                rows={2}
              />
            </div>

            <Separator />
            <div className="space-y-1 text-sm">
              {(sale?.refundedAmount || 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Already refunded</span>
                  <span>{formatCurrency(sale.refundedAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Store credit to issue</span>
                <span>{formatCurrency(refundTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Credited to {sale?.customer?.name}, whose balance is currently{" "}
                {formatCurrency(sale?.customer?.storeCredit?.current || 0)}.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={refunding}
          >
            Cancel
          </Button>
          <Button
            onClick={onRefund}
            loading={refunding}
            disabled={!!blockedReason || selectedCount === 0 || refunding}
          >
            Refund {selectedCount > 0 ? formatCurrency(refundTotal) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
