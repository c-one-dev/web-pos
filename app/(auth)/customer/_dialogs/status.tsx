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

const GET_CUSTOMER = gql`
  query Customer($_id: ID!) {
    customer(_id: $_id) {
      _id
      name
    }
  }
`

const CHANGE_STATUS_CUSTOMER = gql`
  mutation ChangeCustomerStatus($_id: ID!) {
    changeCustomerStatus(_id: $_id) {
      ok
      message
      data
    }
  }
`

export default function StatusDialog({ _id, status, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_CUSTOMER, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [changeStatus] = useMutation(CHANGE_STATUS_CUSTOMER, {
    updateQueries: {
      CustomerTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.changeCustomerStatus.ok) return prev
        const updatedCustomer = mutationResult.data.changeCustomerStatus.data
        const updatedEdges = prev.customerTable.edges.map((edge: any) => {
          return edge.node._id === updatedCustomer._id
            ? { ...edge, node: { ...edge.node, ...updatedCustomer } }
            : edge
        })
        return {
          ...prev,
          customerTable: {
            ...prev.customerTable,
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
      if (result.data.changeCustomerStatus.ok) {
        // Optionally, you can show a success message here
        toast.success(result.data.changeCustomerStatus.message)
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
            {statusText} Customer:{" "}
            <span className="underline">{data?.customer?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to {statusText.toLowerCase()} this customer?
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
