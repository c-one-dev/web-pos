"use client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { PrinterIcon } from "@phosphor-icons/react"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

// Shown once, right after a shift is closed: the register summary the closing
// staff member signs off and prints for the day's paperwork. Everything here
// is read back from the closed session, so reprinting it later from the
// Register report gives the identical figures.
type Props = {
  sessionId: string
  open: boolean
  setOpen: (open: boolean) => void
}

const GET_CLOSURE_DETAIL = gql`
  query RegisterClosureReport($_id: ID!) {
    registerSessionClosureDetail(_id: $_id) {
      _id
      registerName
      outletName
      openedAt
      openedByName
      closedAt
      closedByName
      paymentReceived
      refunds
      netReceipts
      totalSalesInc
      salesTaxCollected
      itemDiscounts
      discounts
      surcharge
      openingFloat
      totalCashIn
      totalCashOut
      newCustomers
      numberOfTransactions
      avgSaleValue
      paymentSummary {
        method {
          _id
          name
        }
        expected
        counted
        difference
      }
      addsPayouts {
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
    }
  }
`

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

const when = (value?: string) =>
  value ? format(Number(value), "d MMM, yyyy - h.mma") : "-"

export default function ClosureReportDialog({
  sessionId,
  open,
  setOpen,
}: Props) {
  const router = useRouter()
  const { data, loading }: any = useQuery(GET_CLOSURE_DETAIL, {
    variables: { _id: sessionId },
    fetchPolicy: "network-only",
    skip: !open || !sessionId,
  })
  const report = data?.registerSessionClosureDetail

  // Same approach as the order slip: hand the report's markup to a fresh
  // window with print-only styling, rather than fighting the app's own
  // stylesheet with print media queries.
  const handlePrint = () => {
    const el = document.getElementById("register-summary-print-area")
    if (!el) return
    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Register summary - ${report?.registerName || ""}</title>
          <style>
            @page { margin: 1.2cm 1.5cm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: sans-serif; font-size: 13px; color: #000; line-height: 1.6; }
            h1 { font-size: 22px; margin-bottom: 2px; }
            h2 { font-size: 15px; margin: 18px 0 6px; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
            th { text-align: left; font-weight: 600; padding: 6px 0; border-bottom: 1px solid #000; }
            th:not(:first-child), td:not(:first-child) { text-align: right; }
            td { padding: 5px 0; }
            tfoot td { border-top: 1px solid #000; font-weight: 600; }
            .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
            .muted { color: #4b5563; }
            .totals { margin-left: auto; width: 60%; }
            .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
            .rule { border-top: 1px solid #000; margin: 10px 0; }
            .sign { margin-top: 18px; }
            .right { text-align: right; }
          </style>
        </head>
        <body>${el.innerHTML}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  const done = () => {
    setOpen(false)
    router.push("/cash-register")
  }

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : done())}
    >
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <PrinterIcon size={18} />
            Register Summary
          </DialogTitle>
          <DialogDescription>
            This shift is closed. Print the summary for your records — you can
            always reprint it from Reports → Register.
          </DialogDescription>
        </DialogHeader>

        {loading && !report ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-3">
            <div id="register-summary-print-area" className="text-sm">
              <div className="head mb-4 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold">
                    {report?.outletName}
                  </h1>
                  <p className="muted text-muted-foreground">
                    {report?.registerName}
                  </p>
                </div>
                <div className="right text-right">
                  <h1 className="text-xl font-semibold">Register summary</h1>
                  <p className="muted text-muted-foreground">
                    {when(report?.openedAt)} to {when(report?.closedAt)}
                  </p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Payment type</th>
                    <th>Expected</th>
                    <th>Counted</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.paymentSummary ?? []).map(
                    (item: any, index: number) => (
                      <tr key={index}>
                        <td>{item.method?.name || "-"}</td>
                        <td>{peso(item.expected)}</td>
                        <td>{peso(item.counted)}</td>
                        <td>{peso(item.difference)}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              <div className="totals">
                <div>
                  <span>Payments:</span>
                  <span>{peso(report?.paymentReceived)}</span>
                </div>
                <div>
                  <span>Refunds:</span>
                  <span>{peso(report?.refunds)}</span>
                </div>
                <div>
                  <span>Net receipts:</span>
                  <span>{peso(report?.netReceipts)}</span>
                </div>
                <div className="rule" />
                <div>
                  <span>Total sales:</span>
                  <span>{peso(report?.totalSalesInc)}</span>
                </div>
                <div>
                  <span>Sales tax collected:</span>
                  <span>{peso(report?.salesTaxCollected)}</span>
                </div>
                <div>
                  <span>Item discounts:</span>
                  <span>{peso(report?.itemDiscounts)}</span>
                </div>
                <div>
                  <span>Order discounts:</span>
                  <span>{peso(report?.discounts)}</span>
                </div>
                <div>
                  <span>Surcharge:</span>
                  <span>{peso(report?.surcharge)}</span>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th className="text-left">User</th>
                    <th className="text-left">Notes</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Opening float</td>
                    <td className="text-left">{report?.openedByName || "-"}</td>
                    <td className="text-left" />
                    <td>{peso(report?.openingFloat)}</td>
                  </tr>
                  {(report?.addsPayouts ?? []).map(
                    (movement: any, index: number) => (
                      <tr key={index}>
                        <td>
                          {movement.type === "IN" ? "Cash in" : "Cash out"}
                        </td>
                        <td className="text-left">
                          {movement.by
                            ? `${movement.by.name} ${movement.by.surname}`
                            : "-"}
                        </td>
                        <td className="text-left">{movement.note || ""}</td>
                        <td>{peso(movement.amount)}</td>
                      </tr>
                    )
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total cash in</td>
                    <td>{peso(report?.totalCashIn)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3}>Total cash out</td>
                    <td>{peso(report?.totalCashOut)}</td>
                  </tr>
                </tfoot>
              </table>

              <table>
                <thead>
                  <tr>
                    <th>New customers</th>
                    <th>Number of transactions</th>
                    <th>Avg. sale value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{report?.newCustomers ?? 0}</td>
                    <td>{report?.numberOfTransactions ?? 0}</td>
                    <td>{peso(report?.avgSaleValue)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="sign">
                <div>Opened by: {report?.openedByName || "-"}</div>
                <div>Closed by: {report?.closedByName || "-"}</div>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={done}>
            Done
          </Button>
          <Button onClick={handlePrint} disabled={!report}>
            <PrinterIcon /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
