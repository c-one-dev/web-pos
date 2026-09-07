import ExcelJS from "exceljs"
import JSZip from "jszip"
import fs from "fs"
import { MongoClient } from "mongodb"

const NAMESPACES = [
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties",
]
const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const unprefix = (xml) => {
  let result = xml
  for (const ns of NAMESPACES) {
    const pat = escapeRegExp(ns)
    const d = result.match(new RegExp(`xmlns:([A-Za-z_][\\w.-]*)="${pat}"`))
    if (!d) continue
    const p = d[1]
    result = result
      .replace(new RegExp(`xmlns:${p}="${pat}"`, "g"), `xmlns="${ns}"`)
      .replace(new RegExp(`<${p}:`, "g"), "<")
      .replace(new RegExp(`</${p}:`, "g"), "</")
  }
  return result
}
const normalise = async (buf) => {
  const src = await JSZip.loadAsync(buf)
  const out = new JSZip()
  for (const e of Object.values(src.files)) {
    if (e.dir) continue
    if (e.name.endsWith(".xml") || e.name.endsWith(".rels"))
      out.file(e.name, unprefix(await e.async("string")))
    else out.file(e.name, await e.async("uint8array"))
  }
  return out.generateAsync({ type: "nodebuffer" })
}
const text = (cell) => {
  const v = cell.value
  if (v === null || v === undefined) return ""
  if (typeof v === "object") return String(v.text ?? v.result ?? "")
  return String(v)
}

const wb = new ExcelJS.Workbook()
const buf = fs.readFileSync(
  "C:/Users/shand.sinohon/Downloads/Sales Transactions/Sales Transactions.xlsx"
)
try {
  await wb.xlsx.load(buf)
} catch {
  await wb.xlsx.load(await normalise(buf))
}
const sheet = wb.worksheets[0]

const orders = []
for (let r = 5; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r)
  const number = text(row.getCell(1)).trim()
  if (!number) continue
  orders.push({
    number,
    date: text(row.getCell(2)).trim(),
    customer: text(row.getCell(4)).trim(),
    status: text(row.getCell(5)).trim(),
    total: text(row.getCell(7)).trim(),
  })
}

const client = new MongoClient(
  "mongodb://admin:admin@127.0.0.1:27017/?replicaSet=rs0"
)
await client.connect()
const sales = client.db("pos").collection("sales")

const present = new Set(
  (
    await sales
      .find({ saleNumber: { $in: orders.map((o) => o.number) } })
      .project({ saleNumber: 1, items: 1 })
      .toArray()
  ).map((s) => s.saleNumber)
)

const withItems = await sales.countDocuments({
  isImported: true,
  "items.0": { $exists: true },
})
const withoutItems = await sales.countDocuments({
  isImported: true,
  items: { $size: 0 },
})

const missing = orders.filter((o) => !present.has(o.number))
console.log("orders in file:", orders.length)
console.log("present in database:", orders.length - missing.length)
console.log("MISSING from database:", missing.length)
const byStatus = new Map()
for (const m of missing)
  byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1)
console.log("missing by status:", [...byStatus.entries()])
console.log("imported sales WITH items:", withItems)
console.log("imported sales WITHOUT items:", withoutItems)
console.log("\nfirst 15 missing:")
for (const m of missing.slice(0, 15))
  console.log(` ${m.number}  ${m.date}  ${m.status}  ₱${m.total}  ${m.customer}`)
await client.close()
