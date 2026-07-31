import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/custom/status-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  EnvelopeSimpleIcon,
  CalendarIcon,
  IdentificationCardIcon,
  UserIcon,
  AtIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@apollo/client/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import React from "react"

type Props = {
  _id?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
}

const GET_USER = gql`
  query User($_id: ID!) {
    user(_id: $_id) {
      _id
      image
      name
      surname
      displayName
      email
      username
      role
      isActive
      createdAt
      updatedAt
    }
  }
`

export default function RowViewDialog({ _id, open, setOpen, onClose }: Props) {
  const { data }: any = useQuery(GET_USER, {
    variables: {
      _id,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })

  const handleClose = () => {
    setOpen?.(false)
    onClose?.()
  }

  return (
    <Dialog modal open={open} onOpenChange={handleClose}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <IdentificationCardIcon size={18} />
            View User
          </DialogTitle>
          <DialogDescription>Details of the user.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar size="lg">
                {data?.user?.image && <AvatarImage src={data.user.image} />}
                <AvatarFallback>{data?.user?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">
                  {data?.user?.displayName || "-"}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <EnvelopeSimpleIcon size={12} />
                  {data?.user?.email || "No email"}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge
                status={data?.user?.isActive ? "ACTIVE" : "INACTIVE"}
                className="h-4 px-1.5 text-[10px]"
              />
              <Badge variant="outline">{data?.user?.role}</Badge>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <UserIcon
                size={16}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm font-medium">
                  {data?.user?.name} {data?.user?.surname}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AtIcon
                size={16}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div>
                <p className="text-xs text-muted-foreground">Username</p>
                <p className="text-sm font-medium">
                  {data?.user?.username || "-"}
                </p>
              </div>
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
                  {data?.user?.createdAt
                    ? format(Number(data.user.createdAt), "PPp")
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
                  {data?.user?.updatedAt
                    ? format(Number(data.user.updatedAt), "PPp")
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
