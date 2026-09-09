import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn, roundMoney } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function PerItem({
  children,
  form,
  state,
  index,
}: Readonly<{
  children: React.ReactNode
  form: any
  state: any
  index: any
}>) {
  const [open, setOpen] = useState<boolean>(false)
  const item = state.items[index]
  const [discountType, setDiscountType] = useState<"%" | "₱">("₱")
  // Raw text mirrors of the % / ₱ discount inputs, separate from the
  // committed item.discount used in cart math - lets the field go visually
  // empty while the user is mid-edit (backspacing) without ever computing
  // NaN into item.price/item.total. Resynced explicitly whenever the user
  // toggles which one is being edited (see the label's onClick below).
  const [percentText, setPercentText] = useState<string>(() =>
    item.snapshotPrice
      ? ((item.discount / item.snapshotPrice) * 100).toFixed(2)
      : "0"
  )
  const [amountText, setAmountText] = useState<string>(() =>
    (item?.discount || 0).toString()
  )
  // Same raw-text trick for Qty. Bound straight to item.quantity the box could
  // never hold an in-progress value: backspacing gave "" -> NaN -> forced back
  // to 1, so it looked stuck on 1, and typing "0.5" over it produced "1.5"
  // because the leading "0" was rewritten to "1" before the ".5" arrived.
  // Resynced on open, since adding the same product again bumps the quantity
  // from the tile grid while this sheet is shut.
  const [quantityText, setQuantityText] = useState<string>(() =>
    String(item?.quantity ?? 1)
  )

  const commitQuantity = (quantity: number) =>
    form.setFieldValue(`items`, () => {
      const itemPrice = item.snapshotPrice - item.discount
      return state.items.map((i: any, idx: number) => {
        if (idx === index) {
          return {
            ...i,
            quantity,
            subTotal: roundMoney(quantity * item.snapshotPrice),
            price: itemPrice,
            total: roundMoney(quantity * itemPrice),
          }
        } else return i
      })
    })

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setQuantityText(String(item?.quantity ?? 1))
        setOpen(next)
      }}
      modal={true}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>{children}</SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="h-auto">
          <div>
            <span className="block">Item: {item.quantity}</span>
            <span className="block">
              Price:{" "}
              {item.discount > 0 && (
                <span className="line-through">
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(item.snapshotPrice)}
                </span>
              )}{" "}
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(item.price)}
            </span>
            {item.discount > 0 && (
              <span className="block">
                Disc.:{" "}
                {new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(item.discount)}
              </span>
            )}
            <span className="block">
              Tot.:{" "}
              <span>
                {new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(item.total)}
              </span>
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-center text-xl font-bold">
            {item?.name}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <div className="space-y-2">
            <Label>Qty.</Label>
            <Input
              value={quantityText}
              type="number"
              // Court time is sold by the hour and laundry by the kilo, so a
              // line can legitimately be 2.5 or 0.33. Kept above zero rather
              // than above one: a whole-number floor is what stopped those
              // being rung up at all.
              min={0.01}
              step="any"
              inputMode="decimal"
              onChange={(e) => {
                const raw = e.target.value
                setQuantityText(raw)
                const typed = parseFloat(raw)
                // Empty, "0" and "0." are all legal keystrokes on the way to
                // "0.5", so leave the cart on its last good quantity and let
                // the box show what was typed. onBlur settles it.
                if (!Number.isFinite(typed) || typed <= 0) return
                commitQuantity(typed)
              }}
              onBlur={() => {
                const typed = parseFloat(quantityText)
                // A line priced at nothing is not a sale, so an abandoned edit
                // snaps back to the quantity the cart still holds.
                if (!Number.isFinite(typed) || typed <= 0)
                  setQuantityText(String(item.quantity))
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Discount {discountType === "%" ? "(%)" : "per item (₱)"}
              <span
                className="text-primary hover:cursor-pointer hover:underline hover:underline-offset-2"
                onClick={() => {
                  if (discountType === "%") {
                    setAmountText((item?.discount || 0).toString())
                    setDiscountType("₱")
                  } else {
                    setPercentText(
                      item.snapshotPrice
                        ? ((item.discount / item.snapshotPrice) * 100).toFixed(
                            2
                          )
                        : "0"
                    )
                    setDiscountType("%")
                  }
                }}
              >
                {discountType === "%"
                  ? "Change to fixed amount"
                  : "Change to percent"}
              </span>
            </Label>
            {discountType === "%" && (
              <InputGroup>
                <InputGroupAddon align="inline-end">%</InputGroupAddon>
                <InputGroupInput
                  value={percentText}
                  type="number"
                  min={0}
                  max={100}
                  onChange={(e) => {
                    const raw = e.target.value
                    setPercentText(raw)
                    const discount = Math.min(
                      100,
                      Math.max(0, parseFloat(raw) || 0)
                    )
                    form.setFieldValue(`items`, () => {
                      const discountAmount = parseFloat(
                        ((discount / 100) * item.snapshotPrice).toFixed(2)
                      )
                      const itemPrice = item.snapshotPrice - discountAmount
                      const itemTotal = roundMoney(item.quantity * itemPrice)
                      return state.items.map((i: any, idx: number) => {
                        if (idx === index) {
                          return {
                            ...i,
                            discount: discountAmount,
                            price: itemPrice,
                            total: itemTotal,
                          }
                        } else return i
                      })
                    })
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </InputGroup>
            )}
            <InputGroup>
              <InputGroupAddon>₱</InputGroupAddon>
              <InputGroupInput
                value={
                  discountType === "%" ? (item?.discount ?? 0) : amountText
                }
                type="number"
                min={0}
                max={item.snapshotPrice}
                readOnly={discountType === "%"}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const raw = e.target.value
                  setAmountText(raw)
                  const discount = Math.min(
                    item.snapshotPrice,
                    Math.max(0, parseFloat(raw) || 0)
                  )
                  form.setFieldValue(`items`, () => {
                    const itemPrice = item.snapshotPrice - discount
                    const itemTotal = roundMoney(item.quantity * itemPrice)
                    return state.items.map((i: any, idx: number) => {
                      if (idx === index) {
                        return {
                          ...i,
                          discount,
                          price: itemPrice,
                          total: itemTotal,
                        }
                      } else return i
                    })
                  })
                }}
              />
            </InputGroup>
          </div>
          <div className="space-y-2">
            <Label>{item.discount > 0 ? "Discounted Price" : "Price"}</Label>
            <InputGroup>
              <InputGroupAddon>₱</InputGroupAddon>
              <InputGroupInput
                value={parseFloat(item?.price || 0).toFixed(2)}
                className={cn(
                  item.discount > 0 && "text-blue-800",
                  "font-medium"
                )}
                readOnly
              />
              {item.discount > 0 && (
                <>
                  <InputGroupAddon
                    className="text-muted-foreground line-through"
                    align="inline-end"
                  >
                    ₱{parseFloat(item.snapshotPrice).toFixed(2)}
                  </InputGroupAddon>
                </>
              )}
            </InputGroup>
          </div>
          <div className="space-y-2">
            <Label>Total</Label>
            <InputGroup>
              <InputGroupAddon>₱</InputGroupAddon>
              <InputGroupInput
                value={parseFloat(item?.total || 0).toFixed(2)}
                readOnly
                className={cn(
                  item.discount > 0 && "text-green-800",
                  "font-medium underline"
                )}
              />
              {item.discount > 0 && (
                <>
                  <InputGroupAddon
                    className="text-muted-foreground line-through"
                    align="inline-end"
                  >
                    ₱{(item.snapshotPrice * Number(item.quantity)).toFixed(2)}
                  </InputGroupAddon>
                </>
              )}
            </InputGroup>
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false)
              form.setFieldValue(
                "items",
                state.items.filter((_: any, i: number) => i !== index)
              )
            }}
          >
            Remove Item
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default PerItem
