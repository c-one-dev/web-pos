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
import { useMutation } from "@apollo/client/react"
import gql from "graphql-tag"
import { useState } from "react"
import { toast } from "sonner"

type Props = {
  registerId: string
  registerName: string
  size?: "default" | "sm" | "lg" | "icon"
}

const OPEN_REGISTER_SESSION = gql`
  mutation OpenRegisterSession($register: ID!, $openingFloat: Float!) {
    openRegisterSession(register: $register, openingFloat: $openingFloat) {
      ok
      message
    }
  }
`

export default function OpenRegisterDialog({
  registerId,
  registerName,
  size = "default",
}: Props) {
  const [open, setOpen] = useState(false)
  const [openingFloat, setOpeningFloat] = useState(0)
  const [openSession, { loading }] = useMutation(OPEN_REGISTER_SESSION, {
    refetchQueries: [
      "ActiveRegisterSession",
      "Registers",
      "RegisterDetail",
      "ProcessedRegister",
    ],
  })

  const onConfirm = async () => {
    try {
      const result: any = await openSession({
        variables: { register: registerId, openingFloat },
      })
      if (result.data.openRegisterSession.ok) {
        toast.success(result.data.openRegisterSession.message)
        setOpen(false)
        setOpeningFloat(0)
      }
    } catch (error: any) {
      toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>Open Register</Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            Open Register: <span className="underline">{registerName}</span>
          </DialogTitle>
          <DialogDescription>
            Enter the starting cash float for this shift.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="openingFloat">Opening Float</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>₱</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="openingFloat"
              type="number"
              inputMode="decimal"
              step="any"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(Number(e.target.value))}
            />
          </InputGroup>
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={loading || openingFloat < 0}>
            Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
