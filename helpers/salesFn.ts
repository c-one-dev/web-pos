// How much of a sale is actually settled, and what payment status that implies.
//
// An On Account tender is a promise to pay, not a payment: the goods leave the
// store but the money hasn't arrived, and the debt sits against the customer's
// account limit until they come back and settle it. So it does NOT count
// toward "paid" here - the sale stays PENDING until settled (see
// Mutation.settleSales in resolvers/sale.resolver.ts).
//
// Store Credit is the opposite: it's value the customer already paid for, so
// spending it settles the sale immediately, same as Cash.

const onAccountId = () => process.env.NEXT_PUBLIC_ON_ACCOUNT_ID

const isOnAccount = (payment: any) => {
  const id = onAccountId()
  if (!id) return false
  const method = payment?.method?._id ?? payment?.method
  return method?.toString() === id
}

// Net of change, so a ₱1000 tender against a ₱440 sale counts as ₱440.
const netAmount = (payment: any) =>
  (payment?.amount || 0) - (payment?.change || 0)

// What the customer still owes on this sale: the On Account portion that
// hasn't been settled yet.
export const outstandingAmount = (payments: any[], settledAmount = 0) => {
  const onAccountTotal = (payments || [])
    .filter(isOnAccount)
    .reduce((sum, payment) => sum + netAmount(payment), 0)
  return Math.max(parseFloat((onAccountTotal - settledAmount).toFixed(2)), 0)
}

// Everything already in hand: non-account tenders plus whatever has since
// been settled against the account portion.
export const settledTotal = (payments: any[], settledAmount = 0) =>
  (payments || [])
    .filter((payment) => !isOnAccount(payment))
    .reduce((sum, payment) => sum + netAmount(payment), 0) + settledAmount

export const checkSalesPaymentStatus = (
  payments: any[],
  saleTotal: number,
  settledAmount = 0
) => {
  const settled = settledTotal(payments, settledAmount)
  const outstanding = outstandingAmount(payments, settledAmount)

  // Tolerance keeps a ₱0.004 rounding remainder from leaving a fully settled
  // sale stuck on PARTIALLY_PAID forever.
  if (settled >= saleTotal - 0.001) return "PAID"
  if (outstanding > 0 && settled <= 0.001) return "PENDING"
  if (settled > 0) return "PARTIALLY_PAID"
  return "UNPAID"
}
