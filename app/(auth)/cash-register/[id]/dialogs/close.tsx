import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useMutation } from "@apollo/client/react"
import gql from "graphql-tag"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type Props = {
  sessionId: string
  counted: Record<string, number>
  expectedTotals: { method: { _id: string } }[]
}

const CLOSE_REGISTER_SESSION = gql`
  mutation CloseRegisterSession($_id: ID!, $input: CloseRegisterSessionInput!) {
    closeRegisterSession(_id: $_id, input: $input) {
      ok
      message
    }
  }
`

export default function CloseDialog({
  sessionId,
  counted,
  expectedTotals,
}: Props) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const router = useRouter()
  const [closeSession, { loading }] = useMutation(CLOSE_REGISTER_SESSION, {
    refetchQueries: ["ActiveRegisterSession", "Registers", "RegisterDetail"],
  })

  const onConfirm = async () => {
    try {
      const tally = expectedTotals.map((item) => ({
        method: item.method._id,
        counted: counted[item.method._id] ?? 0,
      }))
      const result: any = await closeSession({
        variables: { _id: sessionId, input: { tally, notes } },
      })
      if (result.data.closeRegisterSession.ok) {
        toast.success(result.data.closeRegisterSession.message)
        setOpen(false)
        router.push("/cash-register")
      }
    } catch (error: any) {
      toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="lg">
          Close Register
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close this register?</AlertDialogTitle>
          <AlertDialogDescription>
            This locks in the counted amounts entered in the Payment Tally as a
            permanent record for this shift. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="close-notes">Notes (optional)</FieldLabel>
          <Textarea
            id="close-notes"
            placeholder="e.g. reason for any discrepancy"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            Yes, Close Register
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
