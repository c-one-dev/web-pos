/**
 * Sends a sample register closure report, so the mail setup can be tested
 * without closing a real shift.
 *
 *   npx tsx scripts/test-closure-email.ts         # send it
 *   npx tsx scripts/test-closure-email.ts --dry   # write the HTML, send nothing
 *   npx tsx scripts/test-closure-email.ts --verify # check the login only
 *
 * Reads the same .env the app does. It never touches the database: the
 * figures below are made up, and the point of the test is the SMTP
 * credentials and how the mail lands in the inbox. To check a real shift's
 * numbers, open its closure page in the app and press "Send Email".
 */
import { writeFileSync } from "node:fs"
import { config } from "dotenv"

// Before importing anything that reads process.env at module scope. Same
// precedence Next.js uses in development: .env.development wins over .env.
config({ path: ".env", quiet: true })
config({ path: ".env.development", override: true, quiet: true })

const method = (name: string) => ({ _id: name, name })
const opened = new Date(Date.now() - 9 * 60 * 60 * 1000)
const closed = new Date()

const sample = {
  registerName: "TEST REGISTER",
  outletName: "C-ONE Sports Center",
  openedAt: opened,
  openedByName: "Maria Santos",
  closedAt: closed,
  closedByName: "Prince Nagac",
  notes: "This is a test email. The figures below are not real.",
  paymentReceived: 17369,
  refunds: 0,
  netReceipts: 17369,
  totalSalesInc: 17864,
  totalSalesEx: 17864,
  salesTaxCollected: 0,
  itemDiscounts: 120,
  discounts: 50,
  surcharge: 0,
  openingFloat: 2000,
  totalCashIn: 500,
  totalCashOut: 250,
  newCustomers: 3,
  numberOfTransactions: 3,
  avgSaleValue: 5954.67,
  paymentSummary: [
    { method: method("Cash"), expected: 7854, counted: 7854, difference: 0 },
    { method: method("Card"), expected: 0, counted: 0, difference: 0 },
    {
      method: method("Gcash"),
      expected: 9515,
      counted: 9415,
      difference: -100,
    },
  ],
  paymentDetails: [
    {
      date: closed,
      saleNumber: "TEST-0002",
      saleTotal: 9515,
      paymentAmount: 9515,
      type: "Gcash",
      userName: "Maria Santos",
    },
    {
      date: opened,
      saleNumber: "TEST-0001",
      saleTotal: 7854,
      paymentAmount: 7854,
      type: "Cash, Gcash",
      userName: "Maria Santos",
    },
  ],
  onAccountSales: [
    {
      date: closed,
      saleNumber: "TEST-0003",
      saleTotal: 495,
      paymentAmount: 495,
      type: "On Account",
      isOnAccount: true,
      userName: "Maria Santos",
    },
  ],
  addsPayouts: [
    {
      date: closed,
      type: "IN",
      amount: 500,
      note: "Change fund top-up",
      by: { name: "Maria", surname: "Santos" },
    },
  ],
  transactions: [
    {
      date: closed,
      saleNumber: "TEST-0002",
      status: "COMPLETED",
      paymentStatus: "PAID",
      customerName: "Walk-in",
      discount: 0,
      saleTotal: 9515,
      userName: "Maria Santos",
    },
    {
      date: closed,
      saleNumber: "TEST-0003",
      status: "COMPLETED",
      paymentStatus: "PENDING",
      customerName: "JUANA DELA CRUZ",
      discount: 50,
      saleTotal: 495,
      userName: "Maria Santos",
    },
  ],
  transactionsBySku: [
    {
      sku: "CRT-BDM-01",
      saleNumber: "TEST-0002",
      quantity: 2.5,
      salesInc: 1250,
      discountOffers: 0,
      saleTotal: 9515,
      payments: "Gcash",
    },
  ],
  cogs: [
    {
      itemName: "Badminton Court (per hour)",
      sku: "CRT-BDM-01",
      quantitySold: 12.5,
      salesInc: 6250,
      salesExTax: 6250,
      purchaseCost: 0,
      retailPrice: 500,
    },
  ],
}

const main = async () => {
  const { renderClosureEmail, sendClosureEmail, closureRecipients } =
    await import("../lib/closure-email")
  const { isMailConfigured, mailFrom, verifyMail } =
    await import("../lib/mailer")

  // Credentials only. Nothing is rendered or sent, so a wrong App Password
  // comes back in about two seconds.
  if (process.argv.includes("--verify")) {
    console.log("Authenticating as", process.env.SMTP_USER, "...")
    await verifyMail()
    console.log("SMTP login accepted.")
    return
  }

  const { subject, html } = renderClosureEmail(sample)
  console.log("Subject:", subject)
  console.log("Size:", Buffer.byteLength(html), "bytes")

  if (process.argv.includes("--dry")) {
    const out = "closure-email-preview.html"
    writeFileSync(out, html)
    console.log("Wrote", out, "- nothing was sent.")
    return
  }

  if (!isMailConfigured())
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD in .env."
    )
  const recipients = closureRecipients()
  if (!recipients.length)
    throw new Error("CLOSURE_REPORT_TO is empty - nobody to send to.")

  console.log("Sending from", mailFrom(), "to", recipients.join(", "))
  console.log("Sent.", await sendClosureEmail(sample))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error?.message || error)
    process.exit(1)
  })
