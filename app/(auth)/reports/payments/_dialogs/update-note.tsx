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
import { Textarea } from "@/components/ui/textarea"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useEffect, useState } from "react"
import { toast } from "sonner"

type Props = {
  _id: string
  onClose: () => void
}

const GET_PAYMENT = gql`
  query Payment($_id: ID!) {
    payment(_id: $_id) {
      _id
      amount
      change
      date
      note
      createdAt
      updatedAt
    }
  }
`

const UPDATE_PAYMENT_NOTE = gql`
  mutation UpdatePaymentNote($_id: ID!, $note: String) {
    updatePaymentNote(_id: $_id, note: $note) {
      ok
      message
      data
    }
  }
`

export default function UpdatePaymentNoteDialog({ _id, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const [paymentNote, setPaymentNote] = useState("")
  const { data, loading: loadingPayment }: any = useQuery(GET_PAYMENT, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [updatePaymentNote, { loading: updating }] = useMutation(
    UPDATE_PAYMENT_NOTE,
    {
      updateQueries: {
        PaymentTable: (prev, { mutationResult }: any) => {
          if (!mutationResult.data.updatePaymentNote.ok) return prev
          const updatedPayment = mutationResult.data.updatePaymentNote.data
          const updatedEdges = prev.paymentTable.edges.map((edge: any) =>
            edge.node._id === updatedPayment._id
              ? { ...edge, node: { ...edge.node, ...updatedPayment } }
              : edge
          )
          return {
            ...prev,
            paymentTable: {
              ...prev.paymentTable,
              edges: updatedEdges,
            },
          }
        },
      },
    }
  )

  useEffect(() => {
    if (data?.payment?.note) setPaymentNote(data.payment.note)
  }, [data])

  const onUpdate = async () => {
    try {
      const result: any = await updatePaymentNote({
        variables: { _id, note: paymentNote },
      })
      if (result.data.updatePaymentNote.ok) {
        // Optionally, you can show a success message here
        toast.success(result.data.updatePaymentNote.message)
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
          Update Note
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Update Payment Note</DialogTitle>
          <DialogDescription>
            Are you sure you want to update the note for this payment?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Payment Note</Label>
          <Textarea
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            className="resize-none"
            rows={4}
            placeholder="e.g. Reference No."
            disabled={loadingPayment || updating}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button onClick={onUpdate} loading={loadingPayment || updating}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
