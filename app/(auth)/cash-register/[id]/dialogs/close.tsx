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
import { useLazyQuery, useMutation } from "@apollo/client/react"
import gql from "graphql-tag"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { GET_CLOSURE_DETAIL, printRegisterSummary } from "./closure-report"

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
  const [fetchClosureDetail] = useLazyQuery(GET_CLOSURE_DETAIL, {
    fetchPolicy: "network-only",
  })
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
        // Closing a shift ends in paperwork, so the summary goes straight to
        // the print preview. A failure to print must not read as a failure to
        // close - the shift is already closed either way.
        try {
          const { data }: any = await fetchClosureDetail({
            variables: { _id: sessionId },
          })
          await printRegisterSummary(data?.registerSessionClosureDetail)
        } catch (printError) {
          console.warn("Register summary print failed:", printError)
          toast.warning(
            "The shift is closed, but the summary couldn't be printed. Reprint it from Reports → Register."
          )
        }
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
