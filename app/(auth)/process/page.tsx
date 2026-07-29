"use client"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge } from "@/components/custom/status-badge"
import { useRegisterStore } from "@/hooks/use-register"
import { gql } from "@apollo/client"
import { useQuery } from "@apollo/client/react"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const GET_REGISTERS = gql`
  query Registers {
    registers {
      _id
      name
      isOpen
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
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (!register || loading) return
    const remembered = registers.find((r: any) => r._id === register)
    if (remembered?.isOpen) router.push(`/process/${register}`)
  }, [register, registers, loading, router])

  const filteredRegisters = registers.filter((r: any) =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="grid h-full w-full grid-cols-2 place-content-start gap-1.5 p-2.5">
      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* <span className="col-span-2 text-center text-sm text-muted-foreground">
            Select a register to start the process.{" "}
            {register && `(Selected Register ID: ${register})`}
          </span> */}
          <div className="col-span-2">
            <InputGroup>
              <InputGroupInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                placeholder="Search registers..."
              />
              <InputGroupAddon>
                <MagnifyingGlassIcon />
              </InputGroupAddon>
            </InputGroup>
          </div>
          {filteredRegisters.length === 0 && (
            <span className="col-span-2 text-center text-sm text-muted-foreground">
              No registers found.
            </span>
          )}
          {filteredRegisters.map((register: any) => (
            <Button
              onClick={() => {
                setRegister(register._id)
                router.push(`/process/${register._id}`)
              }}
              variant="outline"
              size="lg"
              className="justify-between"
              key={register._id}
            >
              {register.name}
              <StatusBadge status={register.isOpen ? "OPEN" : "CLOSED"} />
            </Button>
          ))}
        </>
      )}
    </div>
  )
}
