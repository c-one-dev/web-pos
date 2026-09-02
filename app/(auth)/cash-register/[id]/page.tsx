"use client"
import { useParams } from "next/navigation"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useState } from "react"
import { format } from "date-fns"
import { ReportPageSkeleton } from "@/components/custom/skeletons"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"
import CashMovementDialog from "./dialogs/cash-movement"
import CloseDialog from "./dialogs/close"

const GET_REGISTER = gql`
  query RegisterDetail($_id: ID!) {
    register(_id: $_id) {
      _id
      name
      outlet {
        _id
        name
      }
      isOpen
    }
  }
`

const GET_ACTIVE_SESSION = gql`
  query ActiveRegisterSession($register: ID!) {
    activeRegisterSession(register: $register) {
      _id
      openedAt
      openingFloat
      cashMovements {
        type
        amount
        note
        date
        by {
          _id
          name
          surname
        }
      }
      summary {
        totalSales
        totalOnAccountSales
        itemDiscounts
        orderDiscounts
        avgSaleValue
        numberOfTransactions
        newCustomers
        totalCashIn
        totalCashOut
        expectedTotals {
          method {
            _id
            name
          }
          expected
        }
      }
    }
  }
`

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

export default function Page() {
  const params = useParams()
  const registerId = params.id as string
  const { data: registerData, loading: registerLoading } = useQuery(
    GET_REGISTER,
    {
      variables: { _id: registerId },
      fetchPolicy: "network-only",
      skip: !registerId,
    }
  )
  const { data: sessionData, loading: sessionLoading } = useQuery(
    GET_ACTIVE_SESSION,
    {
      variables: { register: registerId },
      fetchPolicy: "network-only",
      skip: !registerId,
    }
  )
  const register = (registerData as any)?.register
  const session = (sessionData as any)?.activeRegisterSession
  const [counted, setCounted] = useState<Record<string, number>>({})

  let body: React.ReactNode

  if (registerLoading || sessionLoading) {
    body = <ReportPageSkeleton tiles={2} />
  } else if (!register) {
    body = (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Register not found.
      </div>
    )
  } else if (!session) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="text-center">
          <p className="text-lg font-medium">{register.name}</p>
          <p className="text-sm text-muted-foreground">
            {register.outlet?.name}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          This register is currently closed. Open it from Process Sale to start
          a shift.
        </p>
        {/*
          Opening a register now happens contextually from Process Sale
          (see app/(auth)/process/[id]/page.tsx), not from here. Kept the
          dialog itself at components/custom/open-register-dialog.tsx in
          case this page should offer it again later — see TASKS.md.
        */}
      </div>
    )
  } else {
    const summary = session.summary
    const expectedTotals = summary?.expectedTotals || []

    body = (
      <div className="flex h-full w-full flex-col gap-2.5 p-2.5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xl font-medium">{register.name}</Label>
            <span className="block text-sm text-muted-foreground">
              {register.outlet?.name}
            </span>
          </div>
          <span className="text-sm font-medium">
            Opened: {format(Number(session.openedAt), "PPp")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <div className="flex flex-col gap-2 bg-muted p-3">
            <Label className="font-semibold text-primary">Payment Tally</Label>
            <Table className="bg-white">
              <TableHeader>
                <TableRow>
                  <TableHead>Payment type</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">
                    <div className="ml-auto w-36 text-left">Counted</div>
                  </TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expectedTotals.map((item: any) => {
                  const methodId = item.method._id
                  // Defaults to Expected rather than 0 - assumes no
                  // discrepancy until the cashier actually recounts and
                  // overrides it, matching the reminder in the Close Register
                  // dialog to adjust this box only when there's a mismatch.
                  const countedValue = counted[methodId] ?? item.expected
                  const difference = countedValue - item.expected
                  return (
                    <TableRow key={methodId}>
                      <TableCell className="font-medium">
                        {item.method.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {currency(item.expected)}
                      </TableCell>
                      <TableCell className="text-right">
                        <InputGroup className="ml-auto w-36">
                          <InputGroupAddon>
                            <InputGroupText>₱</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={
                              Number.isNaN(countedValue) ? "" : countedValue
                            }
                            onChange={(e) =>
                              setCounted((prev) => ({
                                ...prev,
                                [methodId]: parseFloat(e.target.value),
                              }))
                            }
                            onFocus={(e) => e.currentTarget.select()}
                          />
                        </InputGroup>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          difference !== 0 && "text-destructive"
                        )}
                      >
                        {currency(difference)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 bg-muted p-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-primary">
                Cash In / Out
              </Label>
              <div className="flex gap-1.5">
                <CashMovementDialog sessionId={session._id} type="IN" />
                <CashMovementDialog sessionId={session._id} type="OUT" />
              </div>
            </div>
            <Table className="bg-white">
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {session.cashMovements.length > 0 ? (
                  session.cashMovements.map((movement: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        {movement.note ||
                          (movement.type === "IN" ? "Cash in" : "Cash out")}
                      </TableCell>
                      <TableCell>
                        {movement.by
                          ? `${movement.by.name} ${movement.by.surname}`
                          : "-"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          movement.type === "OUT" && "text-destructive"
                        )}
                      >
                        {movement.type === "OUT" ? "-" : ""}
                        {currency(movement.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No cash movements yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total cash in</TableCell>
                  <TableCell className="text-right">
                    {currency(summary?.totalCashIn)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2}>Total cash out</TableCell>
                  <TableCell className="text-right">
                    {currency(summary?.totalCashOut)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 bg-muted p-3">
          <Label className="font-semibold text-primary">Sales Summary</Label>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 bg-white p-3 text-sm sm:grid-cols-4">
            <div className="flex flex-col">
              <span className="text-muted-foreground">Total sales</span>
              <span className="font-medium">
                {currency(summary?.totalSales)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">On account sales</span>
              <span className="font-medium">
                {currency(summary?.totalOnAccountSales)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Item discounts</span>
              <span className="font-medium">
                {currency(summary?.itemDiscounts)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Order discounts</span>
              <span className="font-medium">
                {currency(summary?.orderDiscounts)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Avg. sale value</span>
              <span className="font-medium">
                {currency(summary?.avgSaleValue)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Transactions</span>
              <span className="font-medium">
                {summary?.numberOfTransactions ?? 0}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">New customers</span>
              <span className="font-medium">{summary?.newCustomers ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <CloseDialog
            sessionId={session._id}
            counted={counted}
            expectedTotals={expectedTotals}
          />
        </div>
      </div>
    )
  }

  return body
}
