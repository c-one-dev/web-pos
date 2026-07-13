import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

function TotalDiscount({
  children,
  form,
  state,
}: Readonly<{
  children: React.ReactNode
  form: any
  state: any
}>) {
  const [open, setOpen] = useState<boolean>()
  const [discountType, setDiscountType] = useState<"%" | "₱">("₱")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        asChild
        className="cursor-pointer hover:bg-muted-foreground/10"
      >
        {children}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-center text-xl font-bold">
            Sale Discount
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <div className="space-y-2">
            <Label>
              Discount ({discountType === "%" ? "%" : "₱"})
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
                    (
                      (state?.discount / (state?.total + state?.discount)) *
                      100
                    ).toFixed(2)
                  )}
                  type="number"
                  min={0}
                  max={100}
                  onChange={(e) => {
                    const percentDiscount = Math.min(
                      100,
                      Math.max(0, parseFloat(e.target.value || "0"))
                    )
                    const originalTotal = state.total + state.discount
                    const discountAmount = parseFloat(
                      ((percentDiscount / 100) * originalTotal).toFixed(2)
                    )
                    form.setFieldValue("discount", discountAmount)
                    form.setFieldValue("total", originalTotal - discountAmount)
                  }}
                />
              </InputGroup>
            )}
            <InputGroup>
              <InputGroupAddon>₱</InputGroupAddon>
              <InputGroupInput
                value={
                  state?.discount ? parseFloat(state.discount.toFixed(2)) : 0
                }
                type="number"
                min={0}
                max={state.total + state.discount}
                readOnly={discountType === "%"}
                onChange={(e) => {
                  const originalTotal = parseFloat(
                    (state.total + state.discount).toFixed(2)
                  )
                  const discount = Math.min(
                    originalTotal,
                    Math.max(0, parseFloat(e.target.value || "0"))
                  )
                  form.setFieldValue("discount", discount)
                  form.setFieldValue("total", originalTotal - discount)
                }}
              />
            </InputGroup>
          </div>
          <div className="space-y-2">
            <Label>Total</Label>
            <InputGroup>
              <InputGroupAddon>₱</InputGroupAddon>
              <InputGroupInput
                value={parseFloat(state?.total || 0).toFixed(2)}
                readOnly
                className={cn(
                  state.discount > 0 && "text-green-800",
                  "font-medium underline"
                )}
              />
              {state.discount > 0 && (
                <>
                  <InputGroupAddon
                    className="text-muted-foreground line-through"
                    align="inline-end"
                  >
                    ₱
                    {parseFloat(String(state.total + state.discount)).toFixed(
                      2
                    )}
                  </InputGroupAddon>
                </>
              )}
            </InputGroup>
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default TotalDiscount
