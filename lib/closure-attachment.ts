import { format } from "date-fns"
import {
  businessDateOf,
  endOfBusinessDay,
  startOfBusinessDay,
} from "./business-day"

/**
 * The Sales Transactions workbook, built on the server and attached to the
 * closing email.
 *
 * It is the same file the Sales report's Export > Excel produces - same
 * builder, same twenty columns - so nobody has to go and download it by hand
 * after every shift.
 *
 * Scope is the shift's whole business day, not the shift: that is the file
 * the accounts team already works from, and a day is what they reconcile.
 * Two registers closing on the same day therefore attach the same figures to
 * two emails, which is why the email says what the range is.
 */

/** The business day a shift's closing moment falls in, as a date range. */
export const shiftBusinessDay = (closedAt: Date) => {
  const day = businessDateOf(closedAt)
  return { day, from: startOfBusinessDay(day), to: endOfBusinessDay(day) }
}

export type ClosureAttachment = {
  filename: string
  content: Buffer
  /** Human-readable range, for the line in the email that explains it. */
  rangeLabel: string
}

/**
 * Builds the workbook for the business day the shift closed in.
 *
 * Every import here is deferred: exceljs, jsPDF (via report-export) and the
 * report resolvers are a lot of code to load into a route that closes a
 * register, and none of it is needed unless mail is actually configured.
 *
 * Returns null when the day has no sales - an empty spreadsheet is worse
 * than no attachment, because it reads like the day took nothing.
 */
export async function buildSalesTransactionsAttachment(
  closedAt: Date
): Promise<ClosureAttachment | null> {
  const { day, from, to } = shiftBusinessDay(closedAt)
  const start = from.toISOString()
  const end = to.toISOString()

  const [
    { default: ExcelJS },
    { buildSalesTransactionsSheet },
    { salesReportResolver },
  ] = await Promise.all([
    import("exceljs"),
    import("./report-export"),
    import("../resolvers/salesReport.resolver"),
  ])

  const query = salesReportResolver.Query

  // Paged rather than asked for in one go, so a busy day cannot be cut off
  // by a limit and cannot be held in one enormous aggregation either.
  const sales: any[] = []
  let after: string | undefined
  for (;;) {
    const page: any = await query.salesTransactionTable(null, {
      first: 500,
      after,
      start,
      end,
    })
    if (!page) break
    sales.push(...(page.edges || []).map((edge: any) => edge.node))
    if (!page.pageInfo?.hasNextPage) break
    after = page.pageInfo.endCursor
    if (!after) break
  }
  if (!sales.length) return null

  const outlets: string[] =
    (await query.salesOutlets(null, { start, end })) || []

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Sales Transactions")
  buildSalesTransactionsSheet(sheet, sales, {
    title: "Sales Transactions",
    range: { from, to },
    outlets,
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    filename: `sales-transactions_${format(day, "yyyy-MM-dd")}.xlsx`,
    content: Buffer.from(buffer),
    rangeLabel: format(day, "d MMM yyyy"),
  }
}
