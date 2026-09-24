import { format } from "date-fns"
import { recipientsFrom, sendMail } from "./mailer"

/**
 * The shift closure report, rendered as an email.
 *
 * Every tab of the closure page is included as its own table, in the same
 * order and with the same columns, so the mail and the screen can be read
 * against each other. Written as plain tables with inline styles because that
 * is all an email client reliably renders - no flex, no grid, no stylesheet.
 *
 * Transaction by SKU is the one table that does not match its tab: see
 * groupBySku for why a mail wants one row per SKU where a page wants one row
 * per line sold.
 */

// Gmail clips a message past ~102KB and shows "View entire message". A busy
// shift can run to thousands of SKU lines, so each table is capped and the
// remainder is counted off underneath. The web page still has all of it.
const MAX_ROWS = 200

const PESO = "₱"

const currency = (value?: number | null) =>
  `${PESO}${(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// Quantities are Float now (2.5 hours of court, 5.5kg of laundry), so they
// print decimals only when they have them.
const quantity = (value?: number | null) => {
  const amount = value || 0
  return Number.isInteger(amount)
    ? String(amount)
    : String(Number(amount.toFixed(4)))
}

const toDate = (value: unknown) => {
  if (!value) return null
  if (value instanceof Date) return value
  const raw = String(value)
  // Mongo hands back Date objects; the GraphQL layer hands back epoch
  // millisecond strings. Accept both.
  const parsed = /^\d+$/.test(raw) ? new Date(Number(raw)) : new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const dateTime = (value: unknown) => {
  const parsed = toDate(value)
  return parsed ? format(parsed, "d MMM yyyy, h:mm a") : "-"
}

const escapeHtml = (value: unknown) =>
  String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const COLORS = {
  brand: "#15803d",
  ink: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
  band: "#f9fafb",
  negative: "#b91c1c",
}

type Column<T> = {
  header: string
  align?: "left" | "right"
  cell: (row: T) => string
}

const cellStyle = (align: "left" | "right", last: boolean) =>
  `padding:8px 10px;text-align:${align};font-size:12px;color:${COLORS.ink};` +
  (last ? "" : `border-bottom:1px solid ${COLORS.line};`)

/**
 * `total` adds a bold row under the body, one entry per column. It is only
 * given to tables whose columns can honestly be added up - see groupBySku,
 * where the order total could not be.
 */
function table<T>(rows: T[], columns: Column<T>[], total?: string[]) {
  if (!rows.length)
    return `<p style="margin:0;padding:14px 10px;font-size:12px;color:${COLORS.muted};background:${COLORS.band};border-radius:6px;">Nothing recorded in this shift.</p>`

  const shown = rows.slice(0, MAX_ROWS)
  const head = columns
    .map(
      (column) =>
        `<th style="padding:8px 10px;text-align:${column.align || "left"};font-size:11px;letter-spacing:.03em;text-transform:uppercase;color:${COLORS.muted};border-bottom:1px solid ${COLORS.line};white-space:nowrap;">${escapeHtml(column.header)}</th>`
    )
    .join("")

  const body = shown
    .map((row, index) => {
      // The body's last row keeps its bottom border when a totals row
      // follows, so the two are separated.
      const last = index === shown.length - 1 && !total
      const cells = columns
        .map(
          (column) =>
            `<td style="${cellStyle(column.align || "left", last)}">${column.cell(row)}</td>`
        )
        .join("")
      return `<tr${index % 2 ? ` style="background:${COLORS.band};"` : ""}>${cells}</tr>`
    })
    .join("")

  const totalRow = total
    ? `<tr>${columns
        .map(
          (column, index) =>
            `<td style="padding:10px;text-align:${column.align || "left"};font-size:12px;font-weight:600;color:${COLORS.ink};">${total[index] ?? ""}</td>`
        )
        .join("")}</tr>`
    : ""

  const footnote =
    rows.length > shown.length
      ? `Showing the first ${shown.length} of ${rows.length} rows. The full list is on the register closure page.`
      : `${rows.length} ${rows.length === 1 ? "row" : "rows"}.`

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;border:1px solid ${COLORS.line};border-radius:6px;"><thead><tr>${head}</tr></thead><tbody>${body}${totalRow}</tbody></table><p style="margin:8px 0 0;font-size:11px;color:${COLORS.muted};">${footnote}</p>`
}

const section = (title: string, content: string) =>
  `<tr><td style="padding:22px 24px 0;"><h2 style="margin:0 0 10px;font-size:14px;font-weight:600;color:${COLORS.brand};">${escapeHtml(title)}</h2>${content}</td></tr>`

const statCell = (label: string, value: string, emphasis = false) =>
  `<td width="33%" style="padding:6px;" valign="top"><div style="border:1px solid ${COLORS.line};border-radius:6px;padding:10px 12px;"><div style="font-size:16px;font-weight:600;color:${emphasis ? COLORS.brand : COLORS.ink};">${value}</div><div style="margin-top:4px;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(label)}</div></div></td>`

const statGrid = (cells: string[]) => {
  const rows: string[] = []
  for (let index = 0; index < cells.length; index += 3)
    rows.push(`<tr>${cells.slice(index, index + 3).join("")}</tr>`)
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">${rows.join("")}</table>`
}

/**
 * The same rule the Transactions tab uses: a sale can be COMPLETED and still
 * owed for, so the status reads the sale status and the payment status
 * together rather than the sale status alone.
 */
const transactionStatus = (row: { status?: string; paymentStatus?: string }) =>
  row.status !== "VOIDED" &&
  (row.paymentStatus === "PENDING" || row.paymentStatus === "PARTIALLY_PAID")
    ? "ON ACCOUNT"
    : String(row.status || "-").replace(/_/g, " ")

/**
 * Folds the by-SKU rows into one row per SKU.
 *
 * The closure page lists one row per line sold, which is the right grain on
 * screen, where a receipt number can be clicked through to the sale. In an
 * email nothing is clickable and the same SKU comes up again and again, so
 * the question it can actually answer is "how much of each thing went out
 * tonight" - one row per SKU answers that in a fraction of the space.
 *
 * Sale number and payment methods are dropped because they belong to a
 * receipt, not to a SKU, and so is the order total, which cannot be added up
 * across lines without counting the same receipt several times.
 *
 * Biggest seller first: a summary is read from the top.
 */
const groupBySku = (rows: any[]) => {
  const bySku = new Map<string, any>()
  for (const row of rows) {
    const key = row.sku || "-"
    const existing = bySku.get(key) || {
      sku: key,
      // The name is the one it was sold under. Rows come newest first, so
      // the first seen is the most recent name if the product was renamed
      // part way through the shift.
      name: row.name || "-",
      quantity: 0,
      salesInc: 0,
      discountOffers: 0,
    }
    existing.quantity += row.quantity || 0
    existing.salesInc += row.salesInc || 0
    existing.discountOffers += row.discountOffers || 0
    bySku.set(key, existing)
  }
  return [...bySku.values()].sort((a, b) => b.salesInc - a.salesInc)
}

// The closure detail as the resolver builds it. Typed loosely on purpose:
// this is the same object the GraphQL layer returns, and mirroring every
// field here would mean maintaining the shape twice.
export type ClosureDetail = Record<string, any>

export const closureEmailSubject = (detail: ClosureDetail) => {
  const closed = toDate(detail.closedAt) || new Date()
  return `C-ONE SPORTS CENTER ${detail.registerName || "Register"} : ${format(closed, "d MMM yyyy")}`
}

export function renderClosureEmail(detail: ClosureDetail) {
  const subject = closureEmailSubject(detail)
  const difference = (detail.paymentSummary || []).reduce(
    (sum: number, item: any) => sum + (item.difference || 0),
    0
  )

  const header = `<tr><td style="padding:24px 24px 0;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.muted};">C-ONE Sports Center</div>
      <div style="margin-top:4px;font-size:20px;font-weight:700;color:${COLORS.brand};">${escapeHtml(detail.registerName)}</div>
      <div style="margin-top:2px;font-size:12px;color:${COLORS.muted};">${escapeHtml(detail.outletName)} &middot; Register closure report</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;margin-top:14px;border-collapse:collapse;border-top:1px solid ${COLORS.line};">
        <tr><td style="padding:10px 0 0;font-size:12px;color:${COLORS.muted};"><strong style="color:${COLORS.ink};">Opened</strong> ${dateTime(detail.openedAt)} &middot; ${escapeHtml(detail.openedByName)}</td></tr>
        <tr><td style="padding:2px 0 0;font-size:12px;color:${COLORS.muted};"><strong style="color:${COLORS.ink};">Closed</strong> ${dateTime(detail.closedAt)} &middot; ${escapeHtml(detail.closedByName)}</td></tr>
      </table>
    </td></tr>`

  const receipts = section(
    "Receipts",
    statGrid([
      statCell("Payment received", currency(detail.paymentReceived)),
      statCell("Refunds", currency(detail.refunds)),
      statCell("Net receipts", currency(detail.netReceipts), true),
    ])
  )

  const salesSummary = section(
    "Sales Summary",
    statGrid([
      statCell("Total Sales (inc)", currency(detail.totalSalesInc), true),
      statCell("Total Sales (ex)", currency(detail.totalSalesEx)),
      statCell("Sales tax collected", currency(detail.salesTaxCollected)),
      statCell("Item discounts", currency(detail.itemDiscounts)),
      statCell("Discounts", currency(detail.discounts)),
      statCell("Surcharge", currency(detail.surcharge)),
      statCell("Opening float", currency(detail.openingFloat)),
      statCell("Cash in", currency(detail.totalCashIn)),
      statCell("Cash out", currency(detail.totalCashOut)),
      statCell("Transactions", String(detail.numberOfTransactions ?? 0)),
      statCell("Average sale", currency(detail.avgSaleValue)),
      statCell("New customers", String(detail.newCustomers ?? 0)),
    ])
  )

  const paymentSummary = section(
    "Payment Summary",
    table<any>(detail.paymentSummary || [], [
      { header: "Payment type", cell: (row) => escapeHtml(row.method?.name) },
      {
        header: "Expected",
        align: "right",
        cell: (row) => currency(row.expected),
      },
      {
        header: "Actual",
        align: "right",
        cell: (row) => currency(row.counted),
      },
      {
        header: "Difference",
        align: "right",
        cell: (row) =>
          `<span style="color:${row.difference ? COLORS.negative : COLORS.ink};">${currency(row.difference)}</span>`,
      },
    ]) +
      `<p style="margin:8px 0 0;font-size:12px;color:${difference ? COLORS.negative : COLORS.muted};">Total difference: <strong>${currency(difference)}</strong></p>`
  )

  // Payment Details and On Account Sale are the same shape at different
  // grains - see buildPaymentDetails / buildPaymentRows for why.
  const paymentColumns: Column<any>[] = [
    { header: "Date", cell: (row) => dateTime(row.date) },
    { header: "Sale", cell: (row) => escapeHtml(row.saleNumber) },
    {
      header: "Sale total",
      align: "right",
      cell: (row) => currency(row.saleTotal),
    },
    {
      header: "Payment",
      align: "right",
      cell: (row) => currency(row.paymentAmount),
    },
    {
      header: "Type",
      cell: (row) =>
        `${escapeHtml(row.type)}${row.isSettlement ? ` <span style="color:${COLORS.muted};">(settlement)</span>` : ""}`,
    },
    { header: "User", cell: (row) => escapeHtml(row.userName) },
  ]

  // Payment Details is what came into the drawer. An On Account tender is a
  // debt rather than a payment, and it already has its own section below, so
  // a sale tendered entirely on account is left out here.
  //
  // A split sale stays: part of it was paid for real. Its Payment column
  // still shows the whole tender, including the part still owed - the same
  // figure the closure page shows, and the On Account section below says how
  // much of it is outstanding.
  //
  // Counted rather than matched on the name: "On Account" is a payment
  // method someone could rename, and isOnAccount already knows which one it
  // is. One distinct tender on a row flagged isOnAccount means that tender
  // was the only one.
  const paymentDetailRows = (detail.paymentDetails || []).filter(
    (row: any) =>
      !(
        row.isOnAccount &&
        String(row.type || "")
          .split(", ")
          .filter(Boolean).length <= 1
      )
  )

  const paymentDetails = section(
    "Payment Details",
    table<any>(paymentDetailRows, paymentColumns)
  )

  // On Account carries the customer as well: the row is a debt, and a debt
  // that does not name who owes it is of no use to whoever reads this at the
  // end of the night. Slotted after the receipt number, so the line reads
  // "this sale, this customer, this much".
  const onAccountColumns: Column<any>[] = [
    ...paymentColumns.slice(0, 2),
    { header: "Customer", cell: (row) => escapeHtml(row.customerName) },
    ...paymentColumns.slice(2),
  ]

  const onAccount = section(
    "On Account Sale",
    table<any>(detail.onAccountSales || [], onAccountColumns)
  )

  const addsPayouts = section(
    "Adds / Payouts",
    table<any>(detail.addsPayouts || [], [
      { header: "Date", cell: (row) => dateTime(row.date) },
      { header: "Type", cell: (row) => (row.type === "IN" ? "Add" : "Payout") },
      { header: "Amount", align: "right", cell: (row) => currency(row.amount) },
      {
        header: "User",
        cell: (row) =>
          escapeHtml(
            `${row.by?.name || ""} ${row.by?.surname || ""}`.trim() || "-"
          ),
      },
      { header: "Notes", cell: (row) => escapeHtml(row.note || "-") },
    ])
  )

  const transactions = section(
    "Transactions",
    table<any>(detail.transactions || [], [
      { header: "Transaction date", cell: (row) => dateTime(row.date) },
      { header: "Sale", cell: (row) => escapeHtml(row.saleNumber) },
      { header: "Status", cell: (row) => escapeHtml(transactionStatus(row)) },
      { header: "Customer Name", cell: (row) => escapeHtml(row.customerName) },
      {
        header: "Discount",
        align: "right",
        cell: (row) => currency(row.discount),
      },
      {
        header: "Sale total",
        align: "right",
        cell: (row) => currency(row.saleTotal),
      },
    ])
  )

  const skuRows = groupBySku(detail.transactionsBySku || [])
  const skuTotals = skuRows.reduce(
    (sum, row) => ({
      quantity: sum.quantity + row.quantity,
      salesInc: sum.salesInc + row.salesInc,
      discountOffers: sum.discountOffers + row.discountOffers,
    }),
    { quantity: 0, salesInc: 0, discountOffers: 0 }
  )

  const bySku = section(
    "Transaction by SKU",
    table<any>(
      skuRows,
      [
        { header: "SKU", cell: (row) => escapeHtml(row.sku) },
        { header: "Item", cell: (row) => escapeHtml(row.name) },
        {
          header: "Qty",
          align: "right",
          cell: (row) => quantity(row.quantity),
        },
        {
          header: "Sales (inc)",
          align: "right",
          cell: (row) => currency(row.salesInc),
        },
        {
          header: "Discount offers",
          align: "right",
          cell: (row) => currency(row.discountOffers),
        },
      ],
      // Adding these down the page is sound in a way the old per-receipt
      // order total was not: each line's money is counted exactly once.
      [
        "TOTAL",
        "",
        quantity(skuTotals.quantity),
        currency(skuTotals.salesInc),
        currency(skuTotals.discountOffers),
      ]
    )
  )

  const cogs = section(
    "Cost of Goods Sold",
    table<any>(detail.cogs || [], [
      { header: "Item", cell: (row) => escapeHtml(row.itemName) },
      { header: "SKU", cell: (row) => escapeHtml(row.sku) },
      {
        header: "Quantity sold",
        align: "right",
        cell: (row) => quantity(row.quantitySold),
      },
      {
        header: "Sales (inc)",
        align: "right",
        cell: (row) => currency(row.salesInc),
      },
      {
        header: "Purchase cost",
        align: "right",
        cell: (row) => currency(row.purchaseCost),
      },
      {
        header: "Retail price",
        align: "right",
        cell: (row) => currency(row.retailPrice),
      },
    ])
  )

  const notes = detail.notes
    ? section(
        "Closing notes",
        `<p style="margin:0;padding:12px;font-size:12px;color:${COLORS.ink};background:${COLORS.band};border-radius:6px;white-space:pre-wrap;">${escapeHtml(detail.notes)}</p>`
      )
    : ""

  const footer = `<tr><td style="padding:22px 24px 26px;"><p style="margin:0;font-size:11px;color:${COLORS.muted};border-top:1px solid ${COLORS.line};padding-top:12px;">Sent automatically by the C-ONE POS when this register was closed. Do not reply to this address.</p></td></tr>`

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#f3f4f6;padding:20px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="900" style="width:900px;max-width:100%;background:#ffffff;border-radius:10px;font-family:Arial,Helvetica,sans-serif;">
      ${header}${receipts}${salesSummary}${paymentSummary}${paymentDetails}${onAccount}${addsPayouts}${transactions}${bySku}${cogs}${notes}${footer}
    </table>
  </td></tr>
</table>
</body></html>`

  const text = [
    subject,
    `${detail.outletName} - ${detail.registerName}`,
    `Opened ${dateTime(detail.openedAt)} by ${detail.openedByName}`,
    `Closed ${dateTime(detail.closedAt)} by ${detail.closedByName}`,
    "",
    `Payment received: ${currency(detail.paymentReceived)}`,
    `Net receipts: ${currency(detail.netReceipts)}`,
    `Total sales (inc): ${currency(detail.totalSalesInc)}`,
    `Transactions: ${detail.numberOfTransactions ?? 0}`,
    `Tally difference: ${currency(difference)}`,
    "",
    "The full breakdown is in the HTML version of this email.",
  ].join("\n")

  return { subject, html, text }
}

/** Who the closure report goes to. */
export const closureRecipients = () =>
  recipientsFrom(process.env.CLOSURE_REPORT_TO)

export async function sendClosureEmail(detail: ClosureDetail) {
  const { subject, html, text } = renderClosureEmail(detail)
  return sendMail({ to: closureRecipients(), subject, html, text })
}
