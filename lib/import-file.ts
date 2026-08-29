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

// An export from another system rarely puts its headers on the first row -
// HIKE's On Account report spends three rows on a title and a date range - and
// rarely uses our column names either. So the caller passes the columns it
// wants, each with the header names that mean the same thing, and the reader
// finds the row that best matches and renames as it goes.
export type ColumnSpec = { key: string; aliases?: string[] }

// How far down to look for the header row before giving up on the first.
const HEADER_SEARCH_DEPTH = 10

const normaliseHeader = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ")

// An export can prefix a column with the outlet it belongs to
// ("Cagayan de Oro Store_Retail price"). The part after the last underscore is
// the column itself, so it gets a second chance at matching.
const afterOutletPrefix = (value: string) => {
  const index = value.lastIndexOf("_")
  return index === -1 ? "" : value.slice(index + 1).trim()
}

// Maps every accepted spelling to the key the importers read.
const buildAliasMap = (columns: ColumnSpec[] = []) => {
  const map = new Map<string, string>()
  for (const column of columns) {
    map.set(normaliseHeader(column.key), column.key)
    for (const alias of column.aliases ?? [])
      map.set(normaliseHeader(alias), column.key)
  }
  return map
}

// Exact spelling first, then the same header stripped of its outlet prefix.
const resolveHeader = (aliases: Map<string, string>, raw: string) => {
  const name = normaliseHeader(raw)
  return aliases.get(name) ?? aliases.get(afterOutletPrefix(name)) ?? name
}

// The header row is whichever of the first few rows names the most known
// columns. A file already in our own shape matches on row 1 and stops there.
const findHeaderRow = (
  rowAt: (index: number) => string[],
  rowCount: number,
  aliases: Map<string, string>
) => {
  if (!aliases.size) return 1
  let best = { row: 1, score: 0 }
  const depth = Math.min(rowCount, HEADER_SEARCH_DEPTH)
  for (let row = 1; row <= depth; row++) {
    const score = new Set(
      rowAt(row)
        .map((cell) => {
          const name = normaliseHeader(cell)
          return aliases.get(name) ?? aliases.get(afterOutletPrefix(name))
        })
        .filter(Boolean) as string[]
    ).size
    if (score > best.score) best = { row, score }
  }
  return best.score ? best.row : 1
}

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

async function parseXlsx(
  file: File,
  columns: ColumnSpec[] = []
): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const aliases = buildAliasMap(columns)
  const cellsOf = (rowNumber: number) => {
    const values: string[] = []
    sheet.getRow(rowNumber).eachCell((cell) => values.push(cellToString(cell.value)))
    return values
  }
  const headerRow = findHeaderRow(cellsOf, sheet.rowCount, aliases)

  const headers: string[] = []
  sheet.getRow(headerRow).eachCell((cell, column) => {
    // First spelling wins, so "Retail price" is not overwritten by a second
    // outlet's column of the same name further along the row.
    const resolved = resolveHeader(aliases, cellToString(cell.value))
    headers[column] = headers.includes(resolved) ? "" : resolved
  })

  const rows: ImportRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return
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

async function parseCsv(
  file: File,
  columns: ColumnSpec[] = []
): Promise<ImportRow[]> {
  let text = await file.text()
  // Strip a UTF-8 BOM, which Excel writes and which would otherwise become
  // part of the first header's name.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const grid = splitCsv(text)
  if (!grid.length) return []

  const aliases = buildAliasMap(columns)
  const headerRow = findHeaderRow(
    (row) => grid[row - 1] ?? [],
    grid.length,
    aliases
  )
  const seen = new Set<string>()
  const headers = grid[headerRow - 1].map((cell) => {
    const resolved = resolveHeader(aliases, cell)
    if (seen.has(resolved)) return ""
    seen.add(resolved)
    return resolved
  })
  return grid
    .slice(headerRow)
    .map((cells) => {
      const parsed: ImportRow = {}
      headers.forEach((header, index) => {
        if (header) parsed[header] = (cells[index] ?? "").trim()
      })
      return parsed
    })
    .filter((parsed) => Object.values(parsed).some(Boolean))
}

export async function parseImportFile(
  file: File,
  columns: ColumnSpec[] = []
): Promise<ImportRow[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith(".csv")) return parseCsv(file, columns)
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm"))
    return parseXlsx(file, columns)
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
