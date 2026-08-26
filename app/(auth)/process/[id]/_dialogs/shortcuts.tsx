"use client"
import React, { useState } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  MagnifyingGlassIcon,
  MoneyIcon,
  UserPlusIcon,
} from "@phosphor-icons/react"

// Kept beside the register rather than in a global help page: a cashier finds
// a shortcut when they are standing at the till wondering what a key does, not
// by going looking for documentation.
export const SHORTCUTS = [
  {
    keys: "F2",
    icon: <UserPlusIcon size={22} />,
    title: "Add customer",
    description:
      "Opens the customer list so you can attach a customer to this sale. Needed before On Account or Store Credit can be used.",
    bisaya:
      "Ablihan ang lista sa mga customer aron ma-attach sa baligya. Kinahanglan ni una mogamit og On Account o Store Credit.",
  },
  {
    keys: "F3",
    icon: <MagnifyingGlassIcon size={22} />,
    title: "Search products",
    description:
      "Opens the product search. Type a product name, SKU or barcode, then press Enter to add it to the cart.",
    bisaya:
      "Pangitaa ang produkto. I-type ang ngalan, SKU o barcode, dayon Enter aron madugang sa cart.",
  },
  {
    keys: "F5",
    icon: <MoneyIcon size={22} />,
    title: "Take payment",
    description:
      "Opens the payment panel for whatever is in the cart. It does not finish the sale on its own — you still confirm inside the panel.",
    bisaya:
      "Ablihan ang bayranan para sa sulod sa cart. Dili pa ni mahuman ang baligya — kinahanglan pa nimo i-confirm sa sulod.",
  },
]

/**
 * Keyboard guide for the register. Wraps its own trigger so the caller only
 * has to drop it in.
 */
export default function ShortcutsDialog({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-5 p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="text-base">
            Three keys cover the whole sale. They work anywhere on this page —
            you don&apos;t have to click the field first.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:gap-4 sm:p-4"
            >
              <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                <Kbd className="h-9 min-w-12 px-2.5 text-base font-semibold text-foreground">
                  {shortcut.keys}
                </Kbd>
                <span className="text-muted-foreground sm:hidden">
                  {shortcut.icon}
                </span>
              </div>
              <div className="min-w-0 space-y-1">
                <p className="flex items-center gap-2 text-base font-semibold">
                  <span className="hidden text-muted-foreground sm:inline">
                    {shortcut.icon}
                  </span>
                  {shortcut.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {shortcut.description}
                </p>
                <p className="text-sm text-muted-foreground italic">
                  {shortcut.bisaya}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/*
          Worth stating plainly: both keys normally do something else in the
          browser (F3 opens Find, F5 reloads). The register suppresses those,
          and a reload mid-sale would drop the cart - so this is the reassuring
          bit, not trivia.
        */}
        <p className="text-sm text-muted-foreground">
          On this page these keys replace the browser&apos;s own — F5 will not
          reload and lose your cart.
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button size="lg" className="w-full text-base sm:w-auto">
              Got it
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
