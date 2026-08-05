import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const GET_RECEIPT_SALE = gql`
  query ReceiptSale($_id: ID!) {
    sale(_id: $_id) {
      _id
      saleNumber
      createdAt
      customer {
        _id
        name
      }
      items {
        snapshotName
        price
        quantity
        total
      }
      subTotal
      total
      payments {
        amount
        change
        date
        method {
          _id
          name
        }
      }
      by {
        _id
        name
        surname
      }
      register {
        _id
        name
        outlet {
          _id
          name
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

type Props = {
  saleId: string | null
  onClose: () => void
}

export default function ReceiptDialog({ saleId, onClose }: Props) {
  const { data, loading }: any = useQuery(GET_RECEIPT_SALE, {
    variables: { _id: saleId },
    fetchPolicy: "network-only",
    skip: !saleId,
  })
  const sale = data?.sale

  const totalPaid = (sale?.payments || []).reduce(
    (sum: number, payment: any) => sum + (payment.amount - payment.change),
    0
  )
  const outstanding = Math.max((sale?.total || 0) - totalPaid, 0)
  const storeName =
    sale?.register?.outlet?.name?.toUpperCase() ||
    sale?.register?.name?.toUpperCase()

  const handlePrint = () => {
    const el = document.getElementById("receipt-print-area")
    if (!el) return
    const win = window.open("", "_blank", "width=400,height=700")
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Order Slip</title>
          <style>
            @page { margin: 1.5cm 2cm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: sans-serif; font-size: 13px; color: #000; line-height: 1.6; }
            div[role="separator"], [data-orientation="horizontal"], hr {
              border: none;
              border-top: 1px solid #000;
              height: 1px;
              margin: 14px 0;
              background-color: #000;
              width: 100%;
            }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { text-align: left; font-weight: 600; padding: 6px 0; border-bottom: 1px solid #000; }
            th:not(:first-child), td:not(:first-child) { text-align: right; }
            td { padding: 4px 0; }
            tr.border-b { border-bottom: 1px solid #000; }
            .border-t { border-top: 1px solid #000; }
            .border-black { border-color: #000; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .font-medium { font-weight: 500; }
            .text-left { text-align: left !important; }
            .text-right { text-align: right !important; }
            .align-bottom { vertical-align: bottom; }
            [class*="space-y-3"] > * + * { margin-top: 16px; }
            [class*="space-y-1"] > * + * { margin-top: 8px; }
            [class*="space-y-0"] > * + * { margin-top: 4px; }
            .flex { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; }
            .text-muted-foreground, .muted { color: #4b5563; }
            .italic { font-style: italic; }
            .pt-1 { padding-top: 6px; }
            .pt-2 { padding-top: 14px; }
            .pt-3 { padding-top: 18px; }
            .pb-1 { padding-bottom: 6px; }
            .text-lg { font-size: 16px; }
            .text-xs { font-size: 12px; }
            .text-sm { font-size: 13px; }
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

  return (
    <Dialog
      open={!!saleId}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        {loading || !sale ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-8" />
          </div>
        ) : (
          <div id="receipt-print-area" className="space-y-3 text-sm">
            <div className="text-center text-lg font-bold">{storeName}</div>
            <div className="text-center text-muted-foreground">
              Issued to: {sale.customer?.name || "Walk In"}
            </div>
            <div className="space-y-0.5 text-center">
              <div className="font-bold">ORDER SLIP</div>
              <div>ORDER # {sale.saleNumber}</div>
              <div>{format(Number(sale.createdAt), "d MMM yyyy")}</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black">
                  <th
                    style={{ width: "60%" }}
                    className="pb-1 text-left font-medium"
                  >
                    Item
                  </th>
                  <th
                    style={{ width: "20%" }}
                    className="pb-1 text-right font-medium"
                  >
                    Unit
                  </th>
                  <th
                    style={{ width: "20%" }}
                    className="pb-1 text-right font-medium"
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className="py-0.5">
                      {item.quantity} x {item.snapshotName}
                    </td>
                    <td className="py-0.5 text-right">
                      {currency(item.price)}
                    </td>
                    <td className="py-0.5 text-right">
                      {currency(item.total)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td></td>
                  <td className="pt-3 pb-1 text-right font-medium">Subtotal</td>
                  <td className="pt-3 pb-1 text-right font-medium">
                    {currency(sale.subTotal)}
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td className="pb-1 text-right font-medium">Tax (No Tax)</td>
                  <td className="pb-1 text-right font-medium">{currency(0)}</td>
                </tr>
                <tr className="font-bold">
                  <td></td>
                  <td className="border-t border-black pt-1 pb-1 text-right">
                    Total
                  </td>
                  <td className="border-t border-black pt-1 pb-1 text-right">
                    {currency(sale.total)}
                  </td>
                </tr>
                {sale.payments.map((payment: any, index: number) => (
                  <tr key={index}>
                    <td></td>
                    <td className="pb-1 text-right">
                      <div className="font-medium">{payment.method?.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        ({format(Number(payment.date), "d MMM yyyy")})
                      </div>
                    </td>
                    <td className="pb-1 text-right align-bottom font-medium">
                      {currency(payment.amount - payment.change)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td></td>
                  <td colSpan={2} className="pt-1">
                    <div className="w-full border-t border-black"></div>
                  </td>
                </tr>
                <tr className="font-bold">
                  <td colSpan={2} className="pt-1 text-left">
                    <span>Outstanding:</span>
                    <span style={{ marginLeft: "7rem", fontWeight: 500 }}>
                      {currency(outstanding)}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <Separator />
            <div className="pt-2 text-center text-xs text-muted-foreground">
              Served by: {sale.by ? `${sale.by.name} ${sale.by.surname}` : "-"}
              <br />
              {format(Number(sale.createdAt), "p, d MMM yyyy")}
            </div>
            <div className="pt-3 text-center text-xs text-muted-foreground italic">
              This shall not serve as an official receipt
            </div>
          </div>
        )}
        <DialogFooter className="print:hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button variant="outline" disabled>
                  Email
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={handlePrint}>
            Print
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
