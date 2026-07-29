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
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { useMutation } from "@apollo/client/react"
import gql from "graphql-tag"
import { useState } from "react"
import { toast } from "sonner"

type Props = {
  sessionId: string
  type: "IN" | "OUT"
}

const ADD_CASH_MOVEMENT = gql`
  mutation AddCashMovement($_id: ID!, $input: CashMovementInput!) {
    addCashMovement(_id: $_id, input: $input) {
      ok
      message
    }
  }
`

export default function CashMovementDialog({ sessionId, type }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState("")
  const [addMovement, { loading }] = useMutation(ADD_CASH_MOVEMENT, {
    refetchQueries: ["ActiveRegisterSession"],
  })
  const label = type === "IN" ? "Cash In" : "Cash Out"

  const onConfirm = async () => {
    try {
      const result: any = await addMovement({
        variables: { _id: sessionId, input: { type, amount, note } },
      })
      if (result.data.addCashMovement.ok) {
        toast.success(result.data.addCashMovement.message)
        setOpen(false)
        setAmount(0)
        setNote("")
      }
    } catch (error: any) {
      toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={type === "IN" ? "default" : "outline"} size="sm">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {type === "IN"
              ? "Record cash added to the drawer during this shift."
              : "Record cash removed from the drawer during this shift."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="amount">Amount</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>₱</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="amount"
                type="number"
                inputMode="decimal"
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="note">Note</FieldLabel>
            <Input
              id="note"
              placeholder="Reason (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={loading || amount <= 0}>
            Confirm {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
