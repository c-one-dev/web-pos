"use client"
import gql from "graphql-tag"
import { format } from "date-fns"

// The register summary that gets printed the moment a shift is closed. It's
// built as a standalone HTML document and printed from a hidden iframe rather
// than rendered into the app first: closing a register ends with paperwork,
// so the print preview should come up on its own instead of behind another
// dialog to dismiss.
export const GET_CLOSURE_DETAIL = gql`
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

const escape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

const buildRegisterSummaryHtml = (report: any) => {
  const tallyRows = (report.paymentSummary ?? [])
    .map(
      (item: any) => `
        <tr>
          <td>${escape(item.method?.name || "-")}</td>
          <td>${peso(item.expected)}</td>
          <td>${peso(item.counted)}</td>
          <td>${peso(item.difference)}</td>
        </tr>`
    )
    .join("")

  const movementRows = (report.addsPayouts ?? [])
    .map(
      (movement: any) => `
        <tr>
          <td>${movement.type === "IN" ? "Cash in" : "Cash out"}</td>
          <td class="left">${escape(
            movement.by ? `${movement.by.name} ${movement.by.surname}` : "-"
          )}</td>
          <td class="left">${escape(movement.note || "")}</td>
          <td>${peso(movement.amount)}</td>
        </tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Register summary - ${escape(report.registerName)}</title>
    <style>
      @page { margin: 1.2cm 1.5cm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: sans-serif; font-size: 12px; color: #000; line-height: 1.55; }
      h1 { font-size: 19px; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
      .muted { color: #4b5563; }
      .right { text-align: right; }
      .left { text-align: left !important; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
      th { text-align: right; font-weight: 600; padding: 5px 0; border-bottom: 1px solid #000; }
      th:first-child { text-align: left; }
      td { padding: 4px 0; text-align: right; }
      td:first-child { text-align: left; }
      tfoot td { border-top: 1px solid #000; font-weight: 600; }
      .totals { margin: 0 0 4px auto; width: 55%; }
      .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
      .rule { border-top: 1px solid #000; margin: 8px 0; }
      .sign { margin-top: 16px; }
    </style>
  </head>
  <body>
    <div class="head">
      <div>
        <h1>${escape(report.outletName)}</h1>
        <div class="muted">${escape(report.registerName)}</div>
      </div>
      <div class="right">
        <h1>Register summary</h1>
        <div class="muted">${when(report.openedAt)} to ${when(report.closedAt)}</div>
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
      <tbody>${tallyRows}</tbody>
    </table>

    <div class="totals">
      <div><span>Payments:</span><span>${peso(report.paymentReceived)}</span></div>
      <div><span>Refunds:</span><span>${peso(report.refunds)}</span></div>
      <div><span>Net receipts:</span><span>${peso(report.netReceipts)}</span></div>
      <div class="rule"></div>
      <div><span>Total sales:</span><span>${peso(report.totalSalesInc)}</span></div>
      <div><span>Sales tax collected:</span><span>${peso(report.salesTaxCollected)}</span></div>
      <div><span>Item discounts:</span><span>${peso(report.itemDiscounts)}</span></div>
      <div><span>Order discounts:</span><span>${peso(report.discounts)}</span></div>
      <div><span>Surcharge:</span><span>${peso(report.surcharge)}</span></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Transaction</th>
          <th class="left">User</th>
          <th class="left">Notes</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Opening float</td>
          <td class="left">${escape(report.openedByName || "-")}</td>
          <td class="left"></td>
          <td>${peso(report.openingFloat)}</td>
        </tr>
        ${movementRows}
      </tbody>
      <tfoot>
        <tr><td colspan="3">Total cash in</td><td>${peso(report.totalCashIn)}</td></tr>
        <tr><td colspan="3">Total cash out</td><td>${peso(report.totalCashOut)}</td></tr>
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
          <td>${report.newCustomers ?? 0}</td>
          <td>${report.numberOfTransactions ?? 0}</td>
          <td>${peso(report.avgSaleValue)}</td>
        </tr>
      </tbody>
    </table>

    <div class="sign">
      <div>Opened by: ${escape(report.openedByName || "-")}</div>
      <div>Closed by: ${escape(report.closedByName || "-")}</div>
    </div>
  </body>
</html>`
}

// Printed from a hidden iframe rather than window.open: a popup opened after
// the awaited close mutation is outside the click gesture and gets blocked,
// while an iframe always goes straight to the browser's print preview.
export const printRegisterSummary = (report: any) =>
  new Promise<void>((resolve) => {
    if (typeof document === "undefined" || !report) return resolve()

    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
    iframe.srcdoc = buildRegisterSummaryHtml(report)

    const cleanUp = () => {
      iframe.remove()
      resolve()
    }

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus()
        // Blocks until the preview is dismissed, so the caller can navigate
        // away only once the user is done with it.
        iframe.contentWindow?.print()
      } finally {
        setTimeout(cleanUp, 500)
      }
    }

    document.body.appendChild(iframe)
  })
