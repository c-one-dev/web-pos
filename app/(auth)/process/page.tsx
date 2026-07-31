"use client"
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
import { CashRegisterIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
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
    <div className="flex h-full w-full flex-col gap-3 p-2.5">
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
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : filteredRegisters.length === 0 ? (
        <span className="mt-8 text-center text-sm text-muted-foreground">
          No registers found.
        </span>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRegisters.map((register: any) => (
            <button
              type="button"
              onClick={() => {
                setRegister(register._id)
                router.push(`/process/${register._id}`)
              }}
              key={register._id}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] border p-3.5 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CashRegisterIcon size={20} />
              </div>
              <span className="flex-1 truncate font-medium">
                {register.name}
              </span>
              <StatusBadge status={register.isOpen ? "OPEN" : "CLOSED"} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
