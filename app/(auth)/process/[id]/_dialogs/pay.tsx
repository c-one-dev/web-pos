import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import React, { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { ButtonGroup } from "@/components/ui/button-group"
import { IRegister } from "@/types/register.type"
import { IPaymentMethod } from "@/types/paymentMethod.type"
import {
  ArrowElbowDownRightIcon,
  CheckIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { gql } from "@apollo/client"
import { useQuery } from "@apollo/client/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { IOption } from "@/types/shared.type"

const amountShortcuts = [20, 50, 100, 200, 500, 1000]

const GET_CUSTOMER_OPTIONS = gql`
  query CustomerOptionsForPay {
    customerOptions {
      label
      value
    }
  }
`

const GET_CUSTOMER_REPORT = gql`
  query CustomerReportForPay($_id: ID!) {
    customerReport(_id: $_id) {
      _id
      name
      accountLimit {
        max
        current
      }
      storeCredit {
        current
      }
    }
  }
`

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)

function CustomerSummary({
  form,
  customerId,
}: {
  form: any
  customerId: string
}) {
  const [openCustomerCommand, setOpenCustomerCommand] = useState(false)
  const { data: optionsData } = useQuery(GET_CUSTOMER_OPTIONS, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  })
  const customerOptions = (optionsData as any)?.customerOptions || []
  const { data } = useQuery(GET_CUSTOMER_REPORT, {
    variables: { _id: customerId },
    skip: !customerId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  })
  const customer = (data as any)?.customerReport
  const outstanding =
    (customer?.accountLimit?.max || 0) - (customer?.accountLimit?.current || 0)

  const picker = (
    <PopoverContent className="w-full p-0">
      <Command>
        <CommandInput placeholder="Filter customer" />
        <CommandList>
          <CommandEmpty>No option/s found.</CommandEmpty>
          <CommandGroup>
            {customerOptions.map((o: IOption) => (
              <CommandItem
                key={o.value}
                value={o.value}
                onSelect={(val) => {
                  if (val === customerId) form.setFieldValue("customer", "")
                  else form.setFieldValue("customer", val.trim())
                  setOpenCustomerCommand(false)
                }}
              >
                <span className="block">{o.label}</span>
                {customerId === o.value && <CheckIcon className="block" />}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  )

  if (!customerId) {
    return (
      <Popover open={openCustomerCommand} onOpenChange={setOpenCustomerCommand}>
        <div className="flex items-center justify-between border bg-white p-3">
          <span className="font-medium">Walk In</span>
          <PopoverTrigger asChild>
            <Button
              variant="link"
              size="sm"
              type="button"
              className="h-auto p-0"
            >
              <PlusCircleIcon /> Add customer
            </Button>
          </PopoverTrigger>
        </div>
        {picker}
      </Popover>
    )
  }

  return (
    <Popover open={openCustomerCommand} onOpenChange={setOpenCustomerCommand}>
      <div className="border bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium">{customer?.name}</span>
          <div className="flex shrink-0 items-center gap-1">
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" type="button">
                <PencilSimpleIcon />
              </Button>
            </PopoverTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              onClick={() => form.setFieldValue("customer", "")}
            >
              <XIcon />
            </Button>
          </div>
        </div>
        <Separator className="my-2" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block text-xs text-muted-foreground">
              Store credit
            </span>
            <span className="block font-medium text-green-600">
              {formatCurrency(customer?.storeCredit?.current || 0)}
            </span>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">
              Outstanding
            </span>
            <span className="block font-medium text-destructive">
              {formatCurrency(outstanding)}
            </span>
            <span className="block text-xs text-muted-foreground">
              Limit: {formatCurrency(customer?.accountLimit?.max || 0)}
            </span>
          </div>
        </div>
      </div>
      {picker}
    </Popover>
  )
}

function Pay({
  children,
  state,
  register,
  form,
  open,
  setOpen,
  submitting = false,
}: Readonly<{
  children: React.ReactNode
  form: any
  state: any
  register: any
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  // True while generateSale/updateSale is in flight. Locks the submit button
  // so a second or third click can't ring up the same cart twice.
  submitting?: boolean
}>) {
  const subTotal = state.subTotal
  const discount = state.discount
  const total = state.total
  const numberOfItems = state.items.reduce(
    (acc: number, item: any) => acc + item.quantity,
    0
  )
  const [amountTendered, setAmountTendered] = useState<number>(total)
  const [note, setNote] = useState<string>("")
  const [askKeepChange, setAskKeepChange] = useState<boolean>(false)
  // Store Credit and On Account spend a balance the customer already has, so
  // the buttons need to know what that balance is. Without this the cashier
  // only finds out the wallet is empty after generateSale rejects the sale.
  const { data: customerData } = useQuery(GET_CUSTOMER_REPORT, {
    variables: { _id: state.customer },
    skip: !state.customer,
    fetchPolicy: "cache-and-network",
  })
  const payingCustomer = (customerData as any)?.customerReport
  const availableStoreCredit = payingCustomer?.storeCredit?.current || 0
  const availableAccountLimit = payingCustomer?.accountLimit?.current || 0

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmountTendered(total)
  }, [total])

  const paymentMethods = useMemo(
    () => [
      ...(register?.paymentMethods.map((r: IRegister) => ({
        _id: r._id,
        name: r.name,
      })) || []),
      { _id: process.env.NEXT_PUBLIC_STORE_CREDIT_ID, name: "Store Credit" },
      { _id: process.env.NEXT_PUBLIC_ON_ACCOUNT_ID, name: "On Account" },
    ],
    [register]
  )

  // The Pay button is a plain button rather than a submit, so the change
  // question can be asked before the sale is actually rung up.
  const submitSale = (keepChange: boolean) => {
    form.setFieldValue("changeToStoreCredit", keepChange)
    setAskKeepChange(false)
    form.handleSubmit()
  }

  const addPayment = (methodId: string | undefined) => {
    // The account-backed tenders are identified by env ids rather than the
    // register's own method list, so a missing one used to make its button do
    // nothing at all. Say so instead of failing silently.
    if (!methodId) {
      toast.error(
        "This payment type isn't configured yet. Create the payment method and set its id in the environment, then redeploy."
      )
      return
    }
    if (amountTendered <= 0) {
      toast.error("Amount must be greater than zero.")
      return
    }
    const remainingDue = Math.max(state.total - state.receivedAmount, 0)
    let appliedAmount = amountTendered

    // Store credit is spendable value, not money coming in, so a tender for
    // more than the customer holds isn't an error - it just applies what's
    // there and leaves the rest of the sale to another method. Capped at the
    // remaining due as well, so credit never produces change.
    if (methodId === process.env.NEXT_PUBLIC_STORE_CREDIT_ID) {
      appliedAmount = Math.min(
        amountTendered,
        availableStoreCredit,
        remainingDue
      )
      if (appliedAmount <= 0) {
        toast.error(
          "This customer has no store credit to spend. Change kept at checkout or a refund adds to it."
        )
        return
      }
      if (appliedAmount < amountTendered)
        toast.info(
          `Applied ${formatCurrency(appliedAmount)} of store credit — ${formatCurrency(
            remainingDue - appliedAmount
          )} still to pay.`
        )
    }

    const receivedAmount = state.receivedAmount + appliedAmount
    const changeAmount = Math.max(receivedAmount - state.total, 0)
    const netAmount = receivedAmount - changeAmount
    form.setFieldValue("payments", [
      ...state.payments,
      {
        method: methodId,
        amount: appliedAmount,
        change: changeAmount - state.changeAmount,
        date: new Date(),
        note,
      },
    ])
    form.setFieldValue("receivedAmount", receivedAmount)
    form.setFieldValue("changeAmount", changeAmount)
    form.setFieldValue("netAmount", netAmount)
    // Carry what's still owed into the box, so the next method can be paid
    // with one click instead of retyping the balance.
    setAmountTendered(Math.max(state.total - receivedAmount, 0))
    setNote("")
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full data-[side=right]:w-full data-[side=right]:sm:max-w-[min(72rem,95vw)]">
        <SheetHeader>
          <SheetTitle className="text-left text-xl font-bold">
            Sale Summary
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-2 lg:h-full lg:flex-row lg:overflow-hidden">
          <div className="flex w-full shrink-0 gap-4 lg:max-w-80 lg:flex-1">
            <div className="flex h-auto w-full flex-col gap-2 bg-muted p-2.5 lg:h-full lg:overflow-y-auto">
              <div className="flex justify-between gap-2">
                <Label>Subtotal</Label>
                <Label>
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(subTotal)}
                </Label>
              </div>
              <div className="flex justify-between gap-2">
                <Label>Discount</Label>
                <Label>
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(discount)}
                </Label>
              </div>
              <div className="flex justify-between gap-2">
                <Label>Items</Label>
                <Label>{numberOfItems}</Label>
              </div>
              <Separator />
              <div className="flex justify-between gap-2">
                <Label>Total</Label>
                <Label>
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(total)}
                </Label>
              </div>
              <Separator />
              {state.payments.length > 0 && (
                <>
                  <div className="flex justify-between gap-2">
                    <Label>Payments</Label>
                  </div>
                  {state.payments.map((payment: any, index: number) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between gap-2">
                        <Label>
                          <XIcon
                            className="-mr-1 text-destructive hover:cursor-pointer hover:underline hover:underline-offset-2"
                            onClick={() => {
                              const remainingPayments = state.payments.filter(
                                (_: any, i: number) => i !== index
                              )
                              // Recompute every remaining payment's own
                              // `change` from scratch (not just the
                              // aggregate totals) — removing an earlier
                              // payment can shift which payment is the one
                              // that crosses the total, so a stale `change`
                              // left on a remaining payment would submit
                              // the wrong net amount to generateSale.
                              let cumulative = 0
                              let previousChangeAmount = 0
                              const recalculatedPayments =
                                remainingPayments.map((p: any) => {
                                  cumulative += p.amount
                                  const cumulativeChange = Math.max(
                                    cumulative - state.total,
                                    0
                                  )
                                  const paymentChange =
                                    cumulativeChange - previousChangeAmount
                                  previousChangeAmount = cumulativeChange
                                  return { ...p, change: paymentChange }
                                })
                              const newReceivedAmount = cumulative
                              const changeAmount = previousChangeAmount
                              const netAmount = newReceivedAmount - changeAmount

                              form.setFieldValue(
                                "payments",
                                recalculatedPayments
                              )
                              form.setFieldValue(
                                "receivedAmount",
                                newReceivedAmount
                              )
                              form.setFieldValue("changeAmount", changeAmount)
                              form.setFieldValue("netAmount", netAmount)
                              // Put the removed tender back in the input so a
                              // mistyped method can be re-rung without typing
                              // the amount out again.
                              setAmountTendered(payment.amount)
                            }}
                          />
                          {
                            paymentMethods.find(
                              (p: IPaymentMethod) => payment.method === p._id
                            )?.name
                          }
                        </Label>
                        <Label className="text-primary">
                          {new Intl.NumberFormat("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          }).format(payment.amount)}
                        </Label>
                      </div>
                      {payment.note && (
                        <div className="flex justify-start gap-2">
                          <Label className="text-xs text-muted-foreground">
                            <ArrowElbowDownRightIcon className="-mr-1" />{" "}
                            <span className="font-medium">{payment.note}</span>
                          </Label>
                        </div>
                      )}
                    </div>
                  ))}
                  <Separator />
                </>
              )}
              <div className="flex justify-between gap-2 font-bold">
                <Label>To Pay</Label>
                <Label>
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(state.total - state.receivedAmount)}
                </Label>
              </div>
              {state.changeAmount > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between gap-2 text-destructive">
                    <Label>Change</Label>
                    <Label className="font-medium underline">
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      }).format(state.changeAmount)}
                    </Label>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-2.5 bg-muted p-2.5 lg:overflow-y-auto">
            <Label>Amount Tendered</Label>
            <InputGroup className="h-18 bg-white">
              <InputGroupInput
                type="number"
                value={amountTendered}
                onChange={(e) => setAmountTendered(parseFloat(e.target.value))}
                onFocus={(e) => e.currentTarget.select()}
                className="h-full text-center text-3xl md:text-5xl"
              />
            </InputGroup>
            {state.total > state.receivedAmount && (
              <>
                <ButtonGroup className="flex w-full flex-wrap gap-1.5 lg:flex-nowrap [&>*:not(:first-child)]:border-l">
                  {amountShortcuts.map((amount) => {
                    if (amount > amountTendered)
                      return (
                        <Button
                          variant="outline"
                          key={amount}
                          onClick={() => setAmountTendered(amount)}
                        >
                          {new Intl.NumberFormat("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          }).format(amount)}
                        </Button>
                      )
                  })}
                </ButtonGroup>
                <ButtonGroup className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 lg:flex lg:gap-0 [&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:rounded-l-none lg:[&>*:not(:first-child)]:border-l-0">
                  {register?.paymentMethods?.map((method: any) => (
                    <Button
                      size="lg"
                      key={method._id}
                      className="p-2 text-base sm:p-3 sm:text-xl"
                      onClick={() => addPayment(method._id)}
                    >
                      {method.name}
                    </Button>
                  ))}
                </ButtonGroup>
                <ButtonGroup className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 lg:flex lg:gap-0 [&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:rounded-l-none lg:[&>*:not(:first-child)]:border-l-0">
                  <Button
                    size="lg"
                    className="h-auto flex-col gap-0 p-2 text-base sm:p-3 sm:text-xl"
                    disabled={!state.customer || availableStoreCredit <= 0}
                    onClick={() =>
                      addPayment(process.env.NEXT_PUBLIC_STORE_CREDIT_ID)
                    }
                  >
                    Store Credit
                    {!!state.customer && (
                      <span className="text-[0.65rem] font-normal opacity-80">
                        {formatCurrency(availableStoreCredit)}
                      </span>
                    )}
                  </Button>
                  <Button
                    size="lg"
                    className="h-auto flex-col gap-0 p-2 text-base sm:p-3 sm:text-xl"
                    // Never disabled by the balance: an on-account sale is a
                    // debt the customer settles later, so it stays available
                    // even with no limit left.
                    disabled={!state.customer}
                    onClick={() =>
                      addPayment(process.env.NEXT_PUBLIC_ON_ACCOUNT_ID)
                    }
                  >
                    On Account
                    {!!state.customer && (
                      <span className="text-[0.65rem] font-normal opacity-80">
                        {availableAccountLimit > 0
                          ? `${formatCurrency(availableAccountLimit)} left`
                          : "Over limit"}
                      </span>
                    )}
                  </Button>
                </ButtonGroup>
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-white"
                    placeholder="ex. Reference No."
                  />
                </div>
              </>
            )}
            <CustomerSummary form={form} customerId={state.customer} />
          </div>
        </div>
        <SheetFooter>
          <Button
            type="button"
            disabled={submitting}
            loading={submitting}
            onClick={() => {
              // Only worth asking when there is change to keep and an account
              // to keep it on - a walk-in has nowhere to put it.
              if (state.changeAmount > 0 && state.customer)
                setAskKeepChange(true)
              else submitSale(false)
            }}
          >
            Pay
          </Button>
          <SheetClose asChild>
            <Button variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </SheetClose>
        </SheetFooter>
        <AlertDialog open={askKeepChange} onOpenChange={setAskKeepChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Keep the change as store credit?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This sale has{" "}
                <span className="font-semibold text-foreground">
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(state.changeAmount)}
                </span>{" "}
                in change. Add it to the customer&apos;s store credit for a
                future purchase, or hand it back in cash?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => submitSale(false)}
              >
                No, give the cash
              </Button>
              <Button type="button" onClick={() => submitSale(true)}>
                Yes, keep as credit
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}

export default Pay
