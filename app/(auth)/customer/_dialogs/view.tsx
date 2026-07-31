import { Button } from "@/components/ui/button"
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/custom/status-badge"
import {
  UserIcon,
  EnvelopeSimpleIcon,
  CalendarIcon,
  CreditCardIcon,
  WalletIcon,
  IdentificationCardIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { format } from "date-fns"

type Props = {
  _id: string
  onClose: () => void
}

const GET_CUSTOMER = gql`
  query Customer($_id: ID!) {
    customer(_id: $_id) {
      _id
      name
      email
      accountLimit {
        max
        current
      }
      storeCredit {
        current
      }
      isActive
      createdAt
      updatedAt
    }
  }
`

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)

export default function ViewDialog({ _id, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_CUSTOMER, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          View
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <IdentificationCardIcon size={18} />
            View Customer
          </DialogTitle>
          <DialogDescription>Details of the customer.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserIcon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {data?.customer?.name || "-"}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <EnvelopeSimpleIcon size={12} />
                  {data?.customer?.email || "No email"}
                </p>
              </div>
            </div>
            <StatusBadge
              status={data?.customer?.isActive ? "ACTIVE" : "INACTIVE"}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 rounded-md border p-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CreditCardIcon size={14} />
                Account Limit
              </div>
              <p className="text-sm font-semibold">
                {peso(data?.customer?.accountLimit?.current ?? 0)}
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  / {peso(data?.customer?.accountLimit?.max ?? 0)}
                </span>
              </p>
              <Progress
                value={
                  data?.customer?.accountLimit?.max
                    ? (data.customer.accountLimit.current /
                        data.customer.accountLimit.max) *
                      100
                    : 0
                }
              />
            </div>
            <div className="flex flex-col gap-1.5 rounded-md border p-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <WalletIcon size={14} />
                Store Credit
              </div>
              <p className="text-sm font-semibold">
                {peso(data?.customer?.storeCredit?.current ?? 0)}
              </p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <CalendarIcon
                size={16}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-xs font-medium">
                  {data?.customer?.createdAt
                    ? format(Number(data.customer.createdAt), "PPp")
                    : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarIcon
                size={16}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div>
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="text-xs font-medium">
                  {data?.customer?.updatedAt
                    ? format(Number(data.customer.updatedAt), "PPp")
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
