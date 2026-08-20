"use client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HandCoinsIcon } from "@phosphor-icons/react"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { useRegisterStore } from "@/hooks/use-register"

// Settling one sale (from the Sale History row) and settling several (from a
// customer's bulk payment) are the same transaction with a different starting
// list, so both go through this one dialog.
type Props = {
  open: boolean
  setOpen: (open: boolean) => void
  // Exactly one of these: a single sale, or every unsettled sale of a customer.
  saleId?: string
  customerId?: string
  customerName?: string
}

const GET_SALE_OUTSTANDING = gql`
  query SaleOutstanding($_id: ID!) {
    sale(_id: $_id) {
      _id
      saleNumber
      createdAt
      total
      settledAmount
      outstandingAmount
      currentSalePaymentStatus
    }
  }
`

const GET_CUSTOMER_OUTSTANDING = gql`
  query CustomerOutstandingSales($customer: ID!) {
    customerOutstandingSales(customer: $customer) {
      _id
      saleNumber
      date
      total
      settledAmount
      outstandingAmount
      currentSalePaymentStatus
    }
  }
`

const GET_PAYMENT_METHODS = gql`
  query PaymentMethodOptionsForSettle {
    paymentMethodOptions {
      value
      label
    }
  }
`

const SETTLE_SALES = gql`
  mutation SettleSales(
    $sales: [SettleSaleInput!]!
    $method: ID!
    $register: ID!
    $note: String
  ) {
    settleSales(
      sales: $sales
      method: $method
      register: $register
      note: $note
    ) {
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

export default function SettleSalesDialog({
  open,
  setOpen,
  saleId,
  customerId,
  customerName,
}: Props) {
  const register = useRegisterStore((state) => state.register)
  const [method, setMethod] = useState("")
  const [note, setNote] = useState("")
  // saleId -> amount being settled now. Absent means the row is unticked.
  const [amounts, setAmounts] = useState<Record<string, number>>({})

  const { data: saleData, loading: saleLoading }: any = useQuery(
    GET_SALE_OUTSTANDING,
    {
      variables: { _id: saleId },
      fetchPolicy: "network-only",
      skip: !open || !saleId,
    }
  )
  const { data: customerData, loading: customerLoading }: any = useQuery(
    GET_CUSTOMER_OUTSTANDING,
    {
      variables: { customer: customerId },
      fetchPolicy: "network-only",
      skip: !open || !customerId,
    }
  )
  const { data: methodData }: any = useQuery(GET_PAYMENT_METHODS, {
    skip: !open,
  })
  const [settleSales, { loading: settling }] = useMutation(SETTLE_SALES, {
    refetchQueries: [
      "Sale",
      "SaleHistoryTable",
      "SaleRowActions",
      "CustomerSalesTable",
      "CustomerReport",
      "CustomerOutstandingSales",
    ],
    awaitRefetchQueries: true,
  })

  const loading = saleLoading || customerLoading
  const rows = useMemo(() => {
    if (customerId) return customerData?.customerOutstandingSales ?? []
    const sale = saleData?.sale
    return sale && sale.outstandingAmount > 0
      ? [{ ...sale, date: sale.createdAt }]
      : []
  }, [customerId, customerData, saleData])

  // Settling with On Account would just move the debt from one sale to
  // another, so it's never an option here.
  const methods = useMemo(
    () =>
      (methodData?.paymentMethodOptions ?? []).filter(
        (option: any) => option.value !== process.env.NEXT_PUBLIC_ON_ACCOUNT_ID
      ),
    [methodData]
  )

  useEffect(() => {
    if (!open) return
    // Everything owed is ticked in full by default - the common case is "the
    // customer is paying their bill", not "part of one sale".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmounts(
      Object.fromEntries(
        rows.map((row: any) => [row._id, row.outstandingAmount])
      )
    )
  }, [open, rows])

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNote("")
    }
  }, [open])

  const selected = Object.entries(amounts).filter(([, amount]) => amount > 0)
  const total = selected.reduce((sum, [, amount]) => sum + amount, 0)

  const toggle = (row: any, checked: boolean) =>
    setAmounts((prev) => ({
      ...prev,
      [row._id]: checked ? row.outstandingAmount : 0,
    }))

  const setAmount = (row: any, value: number) =>
    setAmounts((prev) => ({
      ...prev,
      [row._id]: Math.max(0, Math.min(value || 0, row.outstandingAmount)),
    }))

  const onSettle = async () => {
    try {
      const result: any = await settleSales({
        variables: {
          sales: selected.map(([_id, amount]) => ({ _id, amount })),
          method,
          register,
          note,
        },
      })
      if (result.data.settleSales.ok) {
        toast.success(result.data.settleSales.message)
        setOpen(false)
      }
    } catch (error: any) {
      toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
    }
  }

  const blockedReason = !register
    ? "Pick a register first - a settlement has to be taken at an open register so the payment lands in that shift's tally."
    : rows.length === 0
      ? "Nothing outstanding to settle."
      : null

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <HandCoinsIcon size={18} />
            {customerId ? "Bulk Payment" : "Settle Payment"}
            {customerName && (
              <span className="text-sm font-normal text-muted-foreground">
                — {customerName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Repays what&apos;s owed on account. The payment is recorded against
            the open shift of the selected register, and frees the same amount
            back onto the customer&apos;s account limit.
          </DialogDescription>
        </DialogHeader>

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : blockedReason ? (
          <p className="py-4 text-sm text-muted-foreground">{blockedReason}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <ScrollArea className="max-h-64 pr-3">
              <div className="flex flex-col gap-2">
                {rows.map((row: any) => {
                  const amount = amounts[row._id] || 0
                  return (
                    <div
                      key={row._id}
                      className="flex items-center justify-between gap-2 border p-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          checked={amount > 0}
                          onCheckedChange={(value) =>
                            toggle(row, value === true)
                          }
                        />
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {row.saleNumber}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {row.date ? format(Number(row.date), "PP") : "-"} ·{" "}
                            {peso(row.outstandingAmount)} outstanding
                          </span>
                        </div>
                      </div>
                      <Input
                        type="number"
                        className="w-28 text-right"
                        value={amount}
                        min={0}
                        max={row.outstandingAmount}
                        onChange={(e) =>
                          setAmount(row, parseFloat(e.target.value))
                        }
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="How is the customer paying?" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((option: any) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ex. OR number"
                rows={2}
              />
            </div>

            <Separator />
            <div className="flex items-center justify-between font-semibold">
              <span>Total to settle</span>
              <span className="tabular-nums">{peso(total)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={settling}
          >
            Cancel
          </Button>
          <Button
            onClick={onSettle}
            loading={settling}
            disabled={
              !!blockedReason || !method || selected.length === 0 || settling
            }
          >
            Settle {total > 0 ? peso(total) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
