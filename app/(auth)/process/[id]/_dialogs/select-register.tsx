"use client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/custom/status-badge"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { ReactNode, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useRegisterStore } from "@/hooks/use-register"

const GET_REGISTERS = gql`
  query RegistersForPicker {
    registers {
      _id
      name
      isOpen
      isActive
      outlet {
        _id
        name
      }
    }
  }
`

type Props = {
  children: ReactNode
}

export default function SelectRegisterSheet({ children }: Props) {
  const [open, setOpen] = useState(false)
  const { data } = useQuery(GET_REGISTERS, {
    fetchPolicy: "cache-and-network",
    skip: !open,
  })
  const router = useRouter()
  const { setRegister } = useRegisterStore()

  const outlets = useMemo(() => {
    const registers = ((data as any)?.registers || []).filter(
      (r: any) => r.isActive
    )
    const map = new Map<
      string,
      { _id: string; name: string; registers: any[] }
    >()
    registers.forEach((r: any) => {
      const outletId = r.outlet?._id || "unassigned"
      if (!map.has(outletId))
        map.set(outletId, {
          _id: outletId,
          name: r.outlet?.name || "Unassigned",
          registers: [],
        })
      map.get(outletId)!.registers.push(r)
    })
    return Array.from(map.values())
  }, [data])

  const onSelect = (registerId: string) => {
    setRegister(registerId)
    router.push(`/process/${registerId}`)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="lg:min-w-175">
        <SheetHeader>
          <SheetTitle className="text-left text-xl font-bold">
            Select your cash register
          </SheetTitle>
        </SheetHeader>
        <div className="px-4">
          {outlets.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No registers found.
            </span>
          ) : (
            <Tabs defaultValue={outlets[0]?._id}>
              <TabsList variant="line">
                {outlets.map((outlet) => (
                  <TabsTrigger key={outlet._id} value={outlet._id}>
                    {outlet.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {outlets.map((outlet) => (
                <TabsContent
                  key={outlet._id}
                  value={outlet._id}
                  className="pt-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {outlet.registers.map((register: any) => (
                      <Card
                        key={register._id}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => onSelect(register._id)}
                      >
                        <CardContent className="flex flex-col gap-2">
                          <div className="flex justify-end">
                            <StatusBadge
                              status={register.isOpen ? "OPEN" : "CLOSED"}
                            />
                          </div>
                          <span className="text-lg font-bold">
                            {register.name}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
