import ExcelJS from "exceljs"

export type ImportRow = Record<string, string>

/**
 * Reads a spreadsheet into plain string rows keyed by the header cell above
 * each column.
 *
 * Everything comes back as a trimmed string on purpose. Spreadsheets are
 * inconsistent about types - a SKU can arrive as a number, a date as a Date,
 * a price as a string with a currency symbol - so parsing is left to the
 * per-entity validators, which know what each column is meant to be.
 */

const HEADER_ROW = 1

const normaliseHeader = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ")

// ExcelJS hands back rich text, formula results, dates and hyperlinks as
// objects. Flatten them to the text a human would see in the cell.
const cellToString = (value: unknown): string => {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") {
    const cell = value as any
    if (Array.isArray(cell.richText))
      return cell.richText.map((part: any) => part.text).join("")
    if (cell.text !== undefined) return String(cell.text)
    if (cell.result !== undefined) return String(cell.result)
    if (cell.hyperlink !== undefined) return String(cell.hyperlink)
    return ""
  }
  return String(value)
}

async function parseXlsx(file: File): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const headers: string[] = []
  sheet.getRow(HEADER_ROW).eachCell((cell, column) => {
    headers[column] = normaliseHeader(cellToString(cell.value))
  })

  const rows: ImportRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === HEADER_ROW) return
    const parsed: ImportRow = {}
    let hasValue = false
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      const header = headers[column]
      if (!header) return
      const value = cellToString(cell.value).trim()
      parsed[header] = value
      if (value) hasValue = true
    })
    // Trailing blank rows are extremely common in hand-edited sheets.
    if (hasValue) rows.push(parsed)
  })
  return rows
}

/**
 * Minimal RFC-4180 CSV reader: handles quoted fields, escaped quotes and
 * newlines inside quotes. Hand-rolled rather than adding a dependency, since
 * the shapes here are small and known.
 */
function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += char
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      // Consume \r\n as one break.
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else field += char
  }

  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

async function parseCsv(file: File): Promise<ImportRow[]> {
  let text = await file.text()
  // Strip a UTF-8 BOM, which Excel writes and which would otherwise become
  // part of the first header's name.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const grid = splitCsv(text)
  if (!grid.length) return []

  const headers = grid[0].map(normaliseHeader)
  return grid
    .slice(1)
    .map((cells) => {
      const parsed: ImportRow = {}
      headers.forEach((header, index) => {
        if (header) parsed[header] = (cells[index] ?? "").trim()
      })
      return parsed
    })
    .filter((parsed) => Object.values(parsed).some(Boolean))
}

export async function parseImportFile(file: File): Promise<ImportRow[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith(".csv")) return parseCsv(file)
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) return parseXlsx(file)
  throw new Error(
    "Unsupported file type. Use a .xlsx or .csv file — the template download gives you the right shape."
  )
}

/** Builds a one-row template workbook so the headers are never guessed at. */
export async function downloadImportTemplate(
  title: string,
  columns: { key: string; example?: string }[]
) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(title.slice(0, 31))
  sheet.columns = columns.map((column) => ({
    header: column.key,
    key: column.key,
    width: Math.max(18, column.key.length + 4),
  }))
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.commit()
  sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, c.example ?? ""])))

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-template.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}
