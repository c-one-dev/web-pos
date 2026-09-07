import ExcelJS from "exceljs"
import JSZip from "jszip"
import fs from "fs"
import { MongoClient } from "mongodb"

const APPLY = process.argv.includes("--apply")
const FILE =
  "C:/Users/shand.sinohon/Downloads/Sales Transactions/Sales Transactions.xlsx"
const URI = "mongodb://admin:admin@127.0.0.1:27017/?replicaSet=rs0"

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
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "object")
    return String(
      v.text ?? v.result ?? v.richText?.map((p) => p.text).join("") ?? ""
    )
  return String(v)
}
const num = (v) => {
  if (!v) return undefined
  const cleaned = String(v).replace(/[^\d.-]/g, "")
  if (!cleaned) return undefined
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

const wb = new ExcelJS.Workbook()
const buf = fs.readFileSync(FILE)
try {
  await wb.xlsx.load(buf)
} catch {
  await wb.xlsx.load(await normalise(buf))
}
const sheet = wb.worksheets[0]

// Columns of the Sales Transactions report (header on row 4).
const ORDER = 1
const DATE = 2
const CUSTOMER = 4
const STATUS = 5
const ORDER_TOTAL = 7
const ITEM = 9
const SKU = 10
const QTY = 11
const LINE_TOTAL = 12

const orders = []
let current = null
for (let r = 5; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r)
  const orderNo = text(row.getCell(ORDER)).trim()
  if (orderNo) {
    current = {
      order: orderNo,
      date: text(row.getCell(DATE)).trim(),
      customer: text(row.getCell(CUSTOMER)).trim(),
      status: text(row.getCell(STATUS)).trim(),
      total: num(text(row.getCell(ORDER_TOTAL))),
      items: [],
    }
    orders.push(current)
    continue
  }
  const sku = text(row.getCell(SKU)).trim()
  const quantity = num(text(row.getCell(QTY)))
  if (!current || !sku || !quantity) continue
  const lineTotal = num(text(row.getCell(LINE_TOTAL)))
  if (lineTotal === undefined) continue
  current.items.push({
    sku,
    name: text(row.getCell(ITEM)).trim(),
    quantity,
    price: parseFloat((lineTotal / quantity).toFixed(2)),
  })
}

const client = new MongoClient(URI)
await client.connect()
const db = client.db("pos")
const sales = db.collection("sales")
const products = db.collection("products")

const productBySku = new Map()
for (const p of await products
  .find({}, { projection: { sku: 1, name: 1 } })
  .toArray())
  if (p.sku) productBySku.set(String(p.sku).trim(), p)

const reasons = {
  updated: 0,
  noItemsInFile: [],
  notInDatabase: [],
  notImported: [],
  unknownSku: [],
}

for (const order of orders) {
  if (!order.items.length) {
    reasons.noItemsInFile.push(order)
    continue
  }
  const sale = await sales.findOne(
    { saleNumber: order.order },
    { projection: { isImported: 1, total: 1 } }
  )
  if (!sale) {
    reasons.notInDatabase.push(order)
    continue
  }
  if (!sale.isImported) {
    reasons.notImported.push(order)
    continue
  }
  const missing = order.items
    .map((i) => i.sku)
    .filter((sku) => !productBySku.has(sku))
  if (missing.length) {
    reasons.unknownSku.push({ ...order, missing: [...new Set(missing)] })
    continue
  }

  const lines = order.items.map((item) => {
    const product = productBySku.get(item.sku)
    const subTotal = parseFloat((item.price * item.quantity).toFixed(2))
    return {
      product: product._id,
      snapshotName: item.name || product.name,
      snapshotPrice: item.price,
      quantity: item.quantity,
      discount: 0,
      price: item.price,
      subTotal,
      total: subTotal,
      refundedQuantity: 0,
    }
  })
  const linesTotal = parseFloat(
    lines.reduce((sum, l) => sum + l.total, 0).toFixed(2)
  )
  const discount =
    linesTotal > sale.total ? parseFloat((linesTotal - sale.total).toFixed(2)) : 0

  if (APPLY)
    await sales.updateOne(
      { _id: sale._id },
      {
        $set: {
          items: lines,
          subTotal: discount > 0 ? linesTotal : sale.total,
          discount,
        },
      }
    )
  reasons.updated++
}

console.log(APPLY ? "=== APPLIED ===" : "=== DRY RUN ===")
console.log("orders in file:", orders.length)
console.log("items attached:", reasons.updated)
console.log("no item lines in file:", reasons.noItemsInFile.length)
console.log("no such sale in database:", reasons.notInDatabase.length)
console.log("sale exists but not an import:", reasons.notImported.length)
console.log("item SKU not in products:", reasons.unknownSku.length)

const byStatus = new Map()
for (const o of reasons.notInDatabase)
  byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1)
console.log("  missing sales by status:", [...byStatus.entries()])
console.log(
  "  sample missing:",
  reasons.notInDatabase.slice(0, 5).map((o) => `${o.order} ${o.date} ${o.status} ${o.total}`)
)
if (reasons.unknownSku.length)
  console.log(
    "  sample unknown SKUs:",
    reasons.unknownSku.slice(0, 5).map((o) => `${o.order}: ${o.missing.join(",")}`)
  )
if (reasons.noItemsInFile.length)
  console.log(
    "  no-item orders:",
    reasons.noItemsInFile.slice(0, 5).map((o) => `${o.order} ${o.status}`)
  )

await client.close()
