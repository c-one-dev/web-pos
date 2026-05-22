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
import { Label } from "@/components/ui/label"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { toast } from "sonner"

type Props = {
  _id: string
  status: boolean
  onClose: () => void
}

const GET_USER = gql`
  query User($_id: ID!) {
    user(_id: $_id) {
      _id
      name
    }
  }
`

const CHANGE_STATUS_USER = gql`
  mutation ChangeUserStatus($_id: ID!) {
    changeUserStatus(_id: $_id) {
      ok
      message
      data
    }
  }
`

export default function StatusDialog({ _id, status, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_USER, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [changeStatus] = useMutation(CHANGE_STATUS_USER, {
    updateQueries: {
      UserTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.changeUserStatus.ok) return prev
        const updatedUser = mutationResult.data.changeUserStatus.data
        const updatedEdges = prev.userTable.edges.map((edge: any) =>
          edge.node._id === updatedUser._id
            ? { ...edge, node: { ...edge.node, ...updatedUser } }
            : edge
        )
        return {
          ...prev,
          userTable: {
            ...prev.userTable,
            edges: updatedEdges,
          },
        }
      },
    },
  })
  const statusText = status ? "Deactivate" : "Activate"

  const onStatusChange = async () => {
    try {
      const result: any = await changeStatus({ variables: { _id } })
      if (result.data.changeUserStatus.ok) {
        // Optionally, you can show a success message here
        toast.success(result.data.changeUserStatus.message)
        onClose()
      }
    } catch (error) {
      console.error("Error changing status:", error)
    }
  }

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          {statusText}
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            {statusText} User:{" "}
            <span className="underline">{data?.user?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to {statusText.toLowerCase()} this user?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button
            variant={statusText ? "destructive" : "default"}
            onClick={onStatusChange}
          >
            {statusText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
