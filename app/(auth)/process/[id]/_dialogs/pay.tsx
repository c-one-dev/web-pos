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
import { ArrowElbowDownRightIcon, XIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"

const amountShortcuts = [20, 50, 100, 200, 500, 1000]

function Pay({
  children,
  state,
  register,
  form,
  open,
  setOpen,
}: Readonly<{
  children: React.ReactNode
  form: any
  state: any
  register: any
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmountTendered(total)
  }, [total])

  const paymentMethods = useMemo(
    () =>
      register?.paymentMethods.map((r: IRegister) => ({
        _id: r._id,
        name: r.name,
      })),
    [register]
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="lg:min-w-275">
        <SheetHeader>
          <SheetTitle className="text-left text-xl font-bold">
            Sale Summary
          </SheetTitle>
        </SheetHeader>
        <div className="flex h-full gap-2.5 px-4">
          <div className="flex max-w-80 flex-1 gap-4">
            <div className="flex h-full w-full flex-col gap-2 bg-muted p-2.5">
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
                              const newReceivedAmount =
                                state.receivedAmount - payment.amount
                              const changeAmount =
                                newReceivedAmount - state.changeAmount > 0
                                  ? 0
                                  : state.changeAmount - payment.amount
                              const netAmount = newReceivedAmount - changeAmount
                              form.setFieldValue(
                                "payments",
                                state.payments.filter(
                                  (_: any, i: number) => i !== index
                                )
                              )
                              form.setFieldValue(
                                "receivedAmount",
                                newReceivedAmount
                              )
                              form.setFieldValue("changeAmount", changeAmount)
                              form.setFieldValue("netAmount", netAmount)
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
          <div className="flex w-full flex-1 flex-col gap-2.5 bg-muted p-2.5">
            <Label>Amount Tendered</Label>
            <InputGroup className="h-18 bg-white">
              <InputGroupInput
                type="number"
                value={amountTendered}
                onChange={(e) => setAmountTendered(parseFloat(e.target.value))}
                className="h-full text-center md:text-5xl"
              />
            </InputGroup>
            {state.total > state.receivedAmount && (
              <>
                <ButtonGroup>
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
                <ButtonGroup>
                  {register?.paymentMethods?.map((method: any) => (
                    <Button
                      size="lg"
                      key={method._id}
                      className="p-3 text-xl"
                      onClick={() => {
                        if (amountTendered <= 0) {
                          toast.error("Amount must be greater than zero.")
                          return
                        }
                        const receivedAmount =
                          state.receivedAmount + amountTendered
                        const changeAmount = receivedAmount - state.total
                        const netAmount = receivedAmount - changeAmount
                        form.setFieldValue("payments", [
                          ...state.payments,
                          {
                            method: method._id,
                            amount: amountTendered,
                            change:
                              receivedAmount - state.total > 0
                                ? changeAmount
                                : 0,
                            date: new Date(),
                            note,
                          },
                        ])
                        form.setFieldValue("receivedAmount", receivedAmount)
                        form.setFieldValue("changeAmount", changeAmount)
                        form.setFieldValue("netAmount", netAmount)
                        setAmountTendered(0)
                        setNote("")
                      }}
                    >
                      {method.name}
                    </Button>
                  ))}
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
          </div>
        </div>
        <SheetFooter>
          <Button type="submit" form="sale-form">
            Pay
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default Pay
