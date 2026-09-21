import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { businessToday } from "@/lib/business-day"

export const ORG_NAME = "C-ONE Sports Center"

// jsPDF's built-in fonts (helvetica/times/courier) use WinAnsi encoding and
// have no glyph for the ₱ sign — it renders as a garbled substitute
// character with broken spacing. PDF table cells must use this plain
// (symbol-less) formatter instead of the ₱-prefixed `currency()` used for
// Excel/on-screen display, which render fine anywhere else.
export const pdfCurrency = (value?: number | string | null) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

const rangeBounds = (range: DateRange) => ({
  from: range.from || businessToday(),
  to: range.to || range.from || businessToday(),
})

const reportFilename = (title: string, range: DateRange, ext: string) => {
  const { from, to } = rangeBounds(range)
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${format(from, "yyyy-MM-dd")}_${format(to, "yyyy-MM-dd")}.${ext}`
}

export function addExcelTitleRows(
  sheet: ExcelJS.Worksheet,
  title: string,
  range: DateRange,
  columnCount: number,
  outlets: string[]
) {
  const { from, to } = rangeBounds(range)
  sheet.mergeCells(1, 1, 1, columnCount)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: "center" }

  sheet.mergeCells(2, 1, 2, columnCount)
  const periodCell = sheet.getCell(2, 1)
  periodCell.value = `For the period of ${format(from, "dd MMM yyyy")} to ${format(to, "dd MMM yyyy")}`
  periodCell.alignment = { horizontal: "center" }
  periodCell.font = { color: { argb: "FF666666" } }

  sheet.mergeCells(3, 1, 3, columnCount)
  const outletCell = sheet.getCell(3, 1)
  outletCell.value = `Outlet(s): ${outlets.length ? outlets.join(", ") : "All"}`
  outletCell.alignment = { horizontal: "center" }
  outletCell.font = { color: { argb: "FF666666" } }

  sheet.addRow([])
}

/**
 * The Sales Transactions heading block.
 *
 * Deliberately different from addExcelTitleRows above: the previous system
 * put the title on row 1, the period and outlets together in a merged block
 * on rows 2-3, and the column headers on row 4 with no blank row between.
 * Keeping to that means an export from here lines up with one from there,
 * and the sale importer - which reads this exact file - finds its headers
 * where it expects them.
 */
function addTransactionsTitleRows(
  sheet: ExcelJS.Worksheet,
  title: string,
  range: DateRange,
  outlets: string[]
) {
  const { from, to } = rangeBounds(range)
  const columnCount = 20

  sheet.mergeCells(1, 1, 1, columnCount)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: "center" }

  sheet.mergeCells(2, 1, 3, columnCount)
  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value =
    `For the period of ${format(from, "dd MMM yyyy")} to ${format(to, "dd MMM yyyy")}\n` +
    `Outlet(s): ${outlets.length ? outlets.join(", ") : "All"}`
  subtitleCell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  }
  subtitleCell.font = { color: { argb: "FF666666" } }
}

export function styleExcelHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } }
  })
}

// Excel number format, so the cells stay real numbers that still add up -
// writing "₱680.00" as text would give a column nothing can sum.
const PESO_FORMAT = '"₱"#,##0.00'

export const SALES_TRANSACTION_COLUMNS = [
  { header: "Order #", width: 14 },
  { header: "Date", width: 14 },
  { header: "Time", width: 10 },
  { header: "Customer name", width: 24 },
  { header: "Status", width: 14 },
  { header: "Payment types", width: 20 },
  { header: "Order total", width: 14, numFmt: PESO_FORMAT },
  { header: "User", width: 22 },
  { header: "Item", width: 34 },
  { header: "SKU", width: 12 },
  { header: "Quantity sold", width: 13 },
  { header: "Sales (inc)", width: 13, numFmt: PESO_FORMAT },
  { header: "Sales (Ex. tax)", width: 15, numFmt: PESO_FORMAT },
  { header: "Order discounts", width: 15, numFmt: PESO_FORMAT },
  { header: "Discount offers", width: 15, numFmt: PESO_FORMAT },
  { header: "Total markup value", width: 17, numFmt: PESO_FORMAT },
  { header: "Purchase cost", width: 14, numFmt: PESO_FORMAT },
  { header: "Gross profit", width: 13, numFmt: PESO_FORMAT },
  // A rate, not an amount, so no peso sign - two decimals like the rest.
  { header: "Margin %", width: 11, numFmt: "0.00" },
  { header: "Retail price", width: 13, numFmt: PESO_FORMAT },
]

/**
 * How a sale reads in the Status column.
 *
 * Two fields, two questions: whether the sale went through, and whether the
 * money arrived. A completed sale that is still owed for reads "On Account",
 * the same rule Sale History, the sale drawer and the register closure report
 * apply - and the same word the previous system's own transactions export
 * used, so the two can be read side by side.
 */
export const saleStatusLabel = (sale: {
  currentSaleStatus?: string | null
  currentSalePaymentStatus?: string | null
}) => {
  if (sale.currentSaleStatus === "VOIDED") return "Voided"
  if (
    sale.currentSalePaymentStatus === "PENDING" ||
    sale.currentSalePaymentStatus === "PARTIALLY_PAID"
  )
    return "On Account"
  const status = sale.currentSaleStatus || ""
  return status ? status.charAt(0) + status.slice(1).toLowerCase() : "-"
}

export type SalesTransactionSheetRow = {
  saleNumber?: string | null
  // Epoch milliseconds in a string, as the GraphQL layer hands dates back.
  date?: string | null
  customerName?: string | null
  currentSaleStatus?: string | null
  currentSalePaymentStatus?: string | null
  paymentTypes?: string[] | null
  total?: number | null
  byName?: string | null
  items?: {
    name?: string | null
    sku?: string | null
    quantitySold?: number | null
    sales?: number | null
    discounts?: number | null
    purchaseCost?: number | null
    retailPrice?: number | null
  }[]
}

/**
 * Writes the Sales Transactions sheet.
 *
 * Laid out the way the previous system exported this report: an order row
 * carrying columns A-H, then one row per line carrying I-T, then a totals
 * row. Keeping the shape means an export from here can be read against one
 * from there column by column, and can be fed straight back into the sale
 * importer, which expects exactly this file.
 */
export function buildSalesTransactionsSheet(
  sheet: ExcelJS.Worksheet,
  sales: SalesTransactionSheetRow[],
  {
    title,
    range,
    outlets,
  }: { title: string; range: DateRange; outlets: string[] }
) {
  addTransactionsTitleRows(sheet, title, range, outlets)
  sheet.columns = SALES_TRANSACTION_COLUMNS.map((column) => ({
    width: column.width,
    ...(column.numFmt ? { style: { numFmt: column.numFmt } } : {}),
  }))
  styleExcelHeaderRow(
    sheet.addRow(SALES_TRANSACTION_COLUMNS.map((column) => column.header))
  )

  const totals = {
    orderTotal: 0,
    quantity: 0,
    sales: 0,
    discounts: 0,
    markup: 0,
    cost: 0,
    profit: 0,
  }

  for (const sale of sales) {
    const date = sale.date ? new Date(Number(sale.date)) : null
    const valid = date && !Number.isNaN(date.getTime())
    const orderRow = sheet.addRow([
      sale.saleNumber,
      valid ? format(date, "dd MMM, yyyy") : "",
      valid ? format(date, "h:mmaaa") : "",
      sale.customerName,
      saleStatusLabel(sale),
      sale.paymentTypes?.join(", ") || "",
      sale.total,
      sale.byName,
    ])
    totals.orderTotal += sale.total || 0

    for (const item of sale.items || []) {
      const sales = item.sales || 0
      const cost = item.purchaseCost || 0
      const profit = sales - cost
      // Markup is what the goods were marked up by over what they cost. With
      // no cost recorded there is nothing to mark up from, so it reads zero
      // rather than the whole retail value - the same way the old report
      // left it.
      const markup = cost
        ? (item.retailPrice || 0) * (item.quantitySold || 0) - cost
        : 0
      sheet.addRow([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.name,
        item.sku,
        item.quantitySold,
        sales,
        // No tax in this system, so inc and ex are the same figure. The
        // column is kept because the accounts team reconciles against the
        // old layout.
        sales,
        item.discounts,
        // Promotional offers: this system has none, so always zero. Kept so
        // the columns line up with the old export.
        0,
        markup,
        cost,
        profit,
        sales ? parseFloat(((profit / sales) * 100).toFixed(2)) : 0,
        item.retailPrice,
      ])
      totals.quantity += item.quantitySold || 0
      totals.sales += sales
      totals.discounts += item.discounts || 0
      totals.markup += markup
      totals.cost += cost
      totals.profit += profit
    }
  }

  // Margin % and Retail price are per-unit rates, so they are left blank
  // rather than added up into a number that means nothing.
  sheet.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    totals.orderTotal,
    "",
    "",
    "",
    totals.quantity,
    totals.sales,
    totals.sales,
    totals.discounts,
    0,
    totals.markup,
    totals.cost,
    totals.profit,
    "",
    "",
  ])
}

export async function downloadExcelWorkbook(
  workbook: ExcelJS.Workbook,
  title: string,
  range: DateRange
) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = reportFilename(title, range, "xlsx")
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function addPdfHeader(
  doc: jsPDF,
  title: string,
  range: DateRange,
  outlets: string[]
) {
  const { from, to } = rangeBounds(range)
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(30, 30, 30)
  doc.text(title, marginX, 40)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(130, 130, 130)
  doc.text(
    `${format(from, "dd MMM yyyy")} to ${format(to, "dd MMM yyyy")}`,
    marginX,
    56
  )

  doc.setFontSize(11)
  doc.setTextColor(90, 90, 90)
  doc.text(ORG_NAME, pageWidth - marginX, 40, { align: "right" })

  doc.setFontSize(9)
  doc.setTextColor(130, 130, 130)
  doc.text(
    `Outlet(s): ${outlets.length ? outlets.join(", ") : "All"}`,
    pageWidth - marginX,
    56,
    { align: "right" }
  )

  return 80
}

export function addPdfFooter(doc: jsPDF, title: string, userName: string) {
  const pageCount = doc.getNumberOfPages()
  const today = format(new Date(), "dd MMM yyyy")
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `${title} report created on ${today} by ${userName}.`,
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    )
  }
}

export function savePdfDocument(doc: jsPDF, title: string, range: DateRange) {
  doc.save(reportFilename(title, range, "pdf"))
}

export const pdfTableStyles = {
  styles: { fontSize: 8, cellPadding: 5 },
  headStyles: {
    fillColor: [240, 240, 240] as [number, number, number],
    textColor: [30, 30, 30] as [number, number, number],
    fontStyle: "bold" as const,
  },
  margin: { left: 40, right: 40 },
}
