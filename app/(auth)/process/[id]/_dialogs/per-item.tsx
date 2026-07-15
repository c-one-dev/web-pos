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
import { cn } from "@/lib/utils"
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

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={true}>
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
              value={item?.quantity}
              type="number"
              min={1}
              onChange={(e) => {
                {
                  const quantity = Math.max(1, parseInt(e.target.value) || 1)
                  form.setFieldValue(`items`, () => {
                    const itemPrice = item.snapshotPrice - item.discount
                    const itemTotal = quantity * itemPrice
                    return state.items.map((i: any, idx: number) => {
                      if (idx === index) {
                        return {
                          ...i,
                          quantity,
                          subTotal: quantity * item.snapshotPrice,
                          price: itemPrice,
                          total: itemTotal,
                        }
                      } else return i
                    })
                  })
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Discount {discountType === "%" ? "(%)" : "per item (₱)"}
              <span
                className="text-primary hover:cursor-pointer hover:underline hover:underline-offset-2"
                onClick={() =>
                  setDiscountType(discountType === "%" ? "₱" : "%")
                }
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
                  value={parseFloat(
                    ((item?.discount / item.snapshotPrice) * 100).toFixed(2)
                  )}
                  type="number"
                  min={0}
                  max={100}
                  onChange={(e) => {
                    {
                      const discount = Math.min(
                        100,
                        Math.max(0, parseFloat(e.target.value || "0"))
                      )
                      form.setFieldValue(`items`, () => {
                        const discountAmount = parseFloat(
                          ((discount / 100) * item.snapshotPrice).toFixed(2)
                        )
                        const itemPrice = item.snapshotPrice - discountAmount
                        const itemTotal = item.quantity * itemPrice
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
                    }
                  }}
                />
              </InputGroup>
            )}
            <InputGroup>
              <InputGroupAddon>₱</InputGroupAddon>
              <InputGroupInput
                value={item?.discount || 0}
                type="number"
                min={0}
                max={item.snapshotPrice}
                readOnly={discountType === "%"}
                onChange={(e) => {
                  {
                    const discount = Math.min(
                      item.snapshotPrice,
                      Math.max(0, parseFloat(e.target.value || "0"))
                    )
                    form.setFieldValue(`items`, () => {
                      const itemPrice = item.snapshotPrice - discount
                      const itemTotal = item.quantity * itemPrice
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
                  }
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
                    ₱
                    {parseFloat(
                      String(item.snapshotPrice * parseInt(item.quantity))
                    ).toFixed(2)}
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
