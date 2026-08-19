import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { WarningIcon } from "@phosphor-icons/react"
import { useMutation } from "@apollo/client/react"
import gql from "graphql-tag"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type Props = {
  sessionId: string
  counted: Record<string, number>
  expectedTotals: { method: { _id: string }; expected: number }[]
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
  const router = useRouter()
  const [closeSession, { loading }] = useMutation(CLOSE_REGISTER_SESSION, {
    refetchQueries: ["ActiveRegisterSession", "Registers", "RegisterDetail"],
  })

  const onConfirm = async () => {
    try {
      const tally = expectedTotals.map((item) => ({
        method: item.method._id,
        // Same "defaults to Expected" fallback as the on-screen Counted
        // box, so a field the cashier never touched closes out as a match
        // rather than silently recording a 0.
        counted: Number.isFinite(counted[item.method._id])
          ? counted[item.method._id]
          : item.expected,
      }))
      const result: any = await closeSession({
        variables: { _id: sessionId, input: { tally } },
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
          <AlertDialogTitle>Close this Register?</AlertDialogTitle>
        </AlertDialogHeader>
        <Alert variant="destructive">
          <WarningIcon weight="fill" />
          <AlertTitle>Reminder!</AlertTitle>
          <AlertDescription>
            If any discrepancies, don&apos;t forget to adjust actual counted box
            before closing the register.
          </AlertDescription>
        </Alert>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
