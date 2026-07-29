"use client"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/custom/status-badge"
import { Spinner } from "@/components/ui/spinner"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useRegisterStore } from "@/hooks/use-register"

const GET_REGISTERS = gql`
  query Registers {
    registers {
      _id
      name
      outlet {
        _id
        name
      }
      isOpen
      isActive
    }
  }
`

export default function Page() {
  const { data, loading } = useQuery(GET_REGISTERS, {
    fetchPolicy: "cache-and-network",
  })
  const registers = ((data as any)?.registers || []).filter(
    (register: any) => register.isActive
  )
  const router = useRouter()
  const { register: activeRegister } = useRegisterStore()

  useEffect(() => {
    if (activeRegister) router.replace(`/cash-register/${activeRegister}`)
  }, [activeRegister, router])

  if (activeRegister) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-10 text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col gap-2.5 p-2.5">
      <Label className="text-xl font-medium">Cash Register</Label>
      {loading && !registers.length ? (
        <div className="flex h-full items-center justify-center">
          <Spinner className="size-10 text-primary" />
        </div>
      ) : registers.length === 0 ? (
        <span className="text-sm text-muted-foreground">
          No registers found.
        </span>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {registers.map((register: any) => (
            <Card key={register._id} size="sm">
              <CardContent className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="font-medium">{register.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {register.outlet?.name}
                  </span>
                  <StatusBadge
                    status={register.isOpen ? "OPEN" : "CLOSED"}
                    className="w-fit"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/cash-register/${register._id}`)}
                >
                  View
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
