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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { toast } from "sonner"

type Props = {
  _id: string
  status: boolean
  onClose: () => void
}

const GET_PAYMENT_METHOD = gql`
  query PaymentMethod($_id: ID!) {
    paymentMethod(_id: $_id) {
      _id
      name
    }
  }
`

const CHANGE_STATUS_PAYMENT_METHOD = gql`
  mutation ChangePaymentMethodStatus($_id: ID!) {
    changePaymentMethodStatus(_id: $_id) {
      ok
      message
      data
    }
  }
`

const LOCKED_PAYMENT_METHODS = [
  process.env.NEXT_PUBLIC_CASH_ID,
  process.env.NEXT_PUBLIC_ON_ACCOUNT_ID,
  process.env.NEXT_PUBLIC_STORE_CREDIT_ID,
]

export default function StatusDialog({ _id, status, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_PAYMENT_METHOD, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [changeStatus] = useMutation(CHANGE_STATUS_PAYMENT_METHOD, {
    updateQueries: {
      PaymentMethodTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.changePaymentMethodStatus.ok) return prev
        const updatedPaymentMethod =
          mutationResult.data.changePaymentMethodStatus.data
        const updatedEdges = prev.paymentMethodTable.edges.map((edge: any) => {
          return edge.node._id === updatedPaymentMethod._id
            ? { ...edge, node: { ...edge.node, ...updatedPaymentMethod } }
            : edge
        })
        return {
          ...prev,
          paymentMethodTable: {
            ...prev.paymentMethodTable,
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
      if (result.data.changePaymentMethodStatus.ok) {
        // Optionally, you can show a success message here
        toast.success(result.data.changePaymentMethodStatus.message)
        onClose()
      }
    } catch (error) {
      console.error("Error changing status:", error)
    }
  }

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          disabled={LOCKED_PAYMENT_METHODS.includes(_id)}
        >
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
            {statusText} Payment Method:{" "}
            <span className="underline">{data?.paymentMethod?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to {statusText.toLowerCase()} this payment
            method?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button
            variant={statusText ? "destructive" : "default"}
            onClick={onStatusChange}
            disabled={LOCKED_PAYMENT_METHODS.includes(_id)}
          >
            {statusText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
