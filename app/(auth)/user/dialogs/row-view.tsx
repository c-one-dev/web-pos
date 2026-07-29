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
import { Label } from "@/components/ui/label"
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
      >
        <DialogHeader>
          <DialogTitle>View User</DialogTitle>
          <DialogDescription>Details of the user.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <div>
            <Label>Name</Label>
            <span className="block text-muted-foreground">
              {data?.user?.name}
            </span>
          </div>
          <div>
            <Label>Surname</Label>
            <span className="block text-muted-foreground">
              {data?.user?.surname}
            </span>
          </div>
          <div>
            <Label>Display Name</Label>
            <span className="block text-muted-foreground">
              {data?.user?.displayName}
            </span>
          </div>
          <div>
            <Label>Email</Label>
            <span className="block text-muted-foreground">
              {data?.user?.email}
            </span>
          </div>
          <div>
            <Label>Username</Label>
            <span className="block text-muted-foreground">
              {data?.user?.username}
            </span>
          </div>
          <div>
            <Label>Role</Label>
            <span className="block text-muted-foreground">
              {data?.user?.role}
            </span>
          </div>
          <div>
            <Label>Created Date</Label>
            <span className="block text-muted-foreground">
              {data?.user?.createdAt
                ? format(Number(data.user.createdAt), "PPpp")
                : "-"}
            </span>
          </div>
          <div>
            <Label>Updated Date</Label>
            <span className="block text-muted-foreground">
              {data?.user?.updatedAt
                ? format(Number(data.user.updatedAt), "PPpp")
                : "-"}
            </span>
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
