"use client"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { format } from "date-fns"
import { ClockIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "../ui/button"

const GET_ACTIVE_TIMECARD = gql`
  query ActiveTimeCard {
    activeTimeCard {
      _id
      clockIn
    }
  }
`

const CLOCK_IN = gql`
  mutation ClockIn {
    clockIn {
      ok
      message
    }
  }
`

const CLOCK_OUT = gql`
  mutation ClockOut {
    clockOut {
      ok
      message
    }
  }
`

export default function ClockButton() {
  const { data, loading, refetch } = useQuery(GET_ACTIVE_TIMECARD, {
    fetchPolicy: "cache-and-network",
  })
  const [clockIn, { loading: clockingIn }] = useMutation(CLOCK_IN)
  const [clockOut, { loading: clockingOut }] = useMutation(CLOCK_OUT)
  const active = (data as any)?.activeTimeCard

  const onClick = async () => {
    try {
      const result: any = active ? await clockOut() : await clockIn()
      const payload = active ? result.data?.clockOut : result.data?.clockIn
      if (payload?.ok) {
        toast.success(payload.message)
        refetch()
      }
    } catch (error: any) {
      toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
    }
  }

  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      className="gap-1.5"
      disabled={loading || clockingIn || clockingOut}
      onClick={onClick}
    >
      <ClockIcon />
      {active
        ? `Clocked in ${format(Number(active.clockIn), "p")}`
        : "Clock In"}
    </Button>
  )
}
