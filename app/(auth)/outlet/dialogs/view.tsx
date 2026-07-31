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
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/custom/status-badge"
import {
  StorefrontIcon,
  MonitorIcon,
  CalendarIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { format } from "date-fns"

type Props = {
  _id: string
  onClose: () => void
}

const GET_OUTLET = gql`
  query Outlet($_id: ID!) {
    outlet(_id: $_id) {
      _id
      name
      registers {
        _id
        name
      }
      isActive
      createdAt
      updatedAt
    }
  }
`

export default function ViewDialog({ _id, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_OUTLET, {
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
            <StorefrontIcon size={18} />
            View Outlet
          </DialogTitle>
          <DialogDescription>Details of the outlet.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <StorefrontIcon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {data?.outlet?.name || "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data?.outlet?.registers?.length || 0} register
                  {data?.outlet?.registers?.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <StatusBadge
              status={data?.outlet?.isActive ? "ACTIVE" : "INACTIVE"}
              className="h-4 px-1.5 text-[10px]"
            />
          </div>
          <Separator />
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MonitorIcon size={14} />
              Registers
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data?.outlet?.registers?.length ? (
                data.outlet.registers.map((reg: any) => (
                  <Badge key={reg._id} variant="outline">
                    {reg.name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">
                  No registers assigned.
                </span>
              )}
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
                  {data?.outlet?.createdAt
                    ? format(Number(data.outlet.createdAt), "PPp")
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
                  {data?.outlet?.updatedAt
                    ? format(Number(data.outlet.updatedAt), "PPp")
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
