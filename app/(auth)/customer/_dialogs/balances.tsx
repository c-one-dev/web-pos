"use client"

import React from "react"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { CreditCardIcon, WalletIcon } from "@phosphor-icons/react"
import { Progress } from "@/components/ui/progress"
import AdjustCreditDialog from "@/app/(auth)/reports/customers/dialogs/adjust-credit"
import AdjustLimitDialog from "@/app/(auth)/reports/customers/dialogs/adjust-limit"
import StoreCreditDrawer from "@/app/(auth)/reports/customers/dialogs/view-credit"
import AccountLimitDrawer from "@/app/(auth)/reports/customers/dialogs/view-limit"

const GET_CUSTOMER_BALANCES = gql`
  query Customer($_id: ID!) {
    customer(_id: $_id) {
      _id
      accountLimit {
        max
        current
      }
      storeCredit {
        current
      }
    }
  }
`

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)

/**
 * Balances panel shared by the customer View dialog and the Edit sheet.
 *
 * Every action here is an existing audited mutation - adjustStoreCredit and
 * adjustAccountLimit - reused from the customer report page rather than
 * reimplemented, so there is still exactly one way to move a balance.
 *
 * Important: the adjust dialogs contain their own <form>. Render this OUTSIDE
 * any enclosing <form> element, because a nested submit (or a bare shadcn
 * Button, which defaults to type="submit") would otherwise submit the parent.
 */
export default function CustomerBalances({ _id }: { _id: string }) {
  const { data }: any = useQuery(GET_CUSTOMER_BALANCES, {
    variables: { _id },
    fetchPolicy: "cache-and-network",
    skip: !_id,
  })

  const accountLimit = data?.customer?.accountLimit
  const storeCredit = data?.customer?.storeCredit
  const used = (accountLimit?.max ?? 0) - (accountLimit?.current ?? 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-md border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CreditCardIcon size={14} />
            Account Limit
          </div>
          <p className="text-sm font-semibold">
            {peso(accountLimit?.current ?? 0)}
            <span className="text-xs font-normal text-muted-foreground">
              {" "}
              available of {peso(accountLimit?.max ?? 0)}
            </span>
          </p>
          <Progress
            value={
              accountLimit?.max
                ? (accountLimit.current / accountLimit.max) * 100
                : 0
            }
          />
          <p className="text-xs text-muted-foreground">
            {peso(used > 0 ? used : 0)} currently outstanding
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <AccountLimitDrawer _id={_id} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-md border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <WalletIcon size={14} />
            Store Credit
          </div>
          <p className="text-sm font-semibold">
            {peso(storeCredit?.current ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground">
            Issued on refunds, or granted manually.
          </p>
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            <StoreCreditDrawer _id={_id} />
          </div>
        </div>
      </div>
    </div>
  )
}
