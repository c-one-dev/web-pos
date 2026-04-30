"use client"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useRegisterStore } from "@/hooks/use-register"
import { gql } from "@apollo/client"
import { useQuery } from "@apollo/client/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

const GET_REGISTERS = gql`
  query Registers {
    registers {
      _id
      name
    }
  }
`

export default function Page() {
  const { data, loading } = useQuery(GET_REGISTERS, {
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  })
  const registers = (data as any)?.registers || []
  const router = useRouter()
  const { register, setRegister } = useRegisterStore()

  useEffect(() => {
    if (register) router.push(`/process/${register}`)
  }, [register, router])

  return (
    <div className="grid h-full w-full grid-cols-2 place-content-start gap-1.5 p-2.5">
      {loading ? (
        <Spinner />
      ) : (
        <>
          <span className="col-span-2 text-center text-sm text-muted-foreground">
            Select a register to start the process.{" "}
            {register && `(Selected Register ID: ${register})`}
          </span>
          {registers.map((register: any) => (
            <Button
              onClick={() => {
                setRegister(register._id)
                router.push(`/process/${register._id}`)
              }}
              variant="outline"
              size="lg"
              key={register._id}
            >
              {register.name}
            </Button>
          ))}
        </>
      )}
    </div>
  )
}
