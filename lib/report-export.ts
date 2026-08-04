import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import { format, startOfToday } from "date-fns"
import { DateRange } from "react-day-picker"

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
  from: range.from || startOfToday(),
  to: range.to || range.from || startOfToday(),
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

export function styleExcelHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } }
  })
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
