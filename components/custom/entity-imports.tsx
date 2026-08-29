"use client"
import React, { useMemo } from "react"
import gql from "graphql-tag"
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react"
import ImportDialog, {
  type ImportColumn,
  type RowResult,
} from "@/components/custom/import-dialog"
import type { ImportRow } from "@/lib/import-file"
import { refetchOnlyReadyQueries } from "@/lib/refetch"
import { Button } from "@/components/ui/button"
import { UploadSimpleIcon } from "@phosphor-icons/react"

/**
 * The four importers. Each one reuses the same create mutation the normal
 * form uses, one row at a time, so every server-side validation rule still
 * applies - an import cannot write something the UI would have rejected.
 *
 * Files carry human names ("Badminton", "Yonex"), not ObjectIds, so each
 * importer resolves names against the same *Options queries the pickers use.
 */

const GET_LOOKUPS = gql`
  query ImportLookups {
    brandOptions {
      label
      value
    }
    productTypeOptions {
      label
      value
    }
    registerOptions {
      label
      value
    }
  }
`

const GET_CUSTOMER_LOOKUP = gql`
  query ImportCustomerLookup {
    customerOptions {
      label
      value
    }
  }
`

const CREATE_PRODUCT = gql`
  mutation ImportCreateProduct($input: ProductInput) {
    createProduct(input: $input) {
      ok
      message
    }
  }
`

const CREATE_PRODUCT_TYPE = gql`
  mutation ImportCreateProductType($input: ProductTypeInput) {
    createProductType(input: $input) {
      ok
      message
    }
  }
`

const CREATE_CUSTOMER = gql`
  mutation ImportCreateCustomer($input: CustomerInput!) {
    createCustomer(input: $input) {
      ok
      message
    }
  }
`

const IMPORT_LEGACY_SALE = gql`
  mutation ImportLegacySale($input: LegacySaleInput) {
    importLegacySale(input: $input) {
      ok
      message
    }
  }
`

const ADJUST_ACCOUNT_LIMIT = gql`
  mutation ImportAdjustAccountLimit(
    $_id: ID!
    $amount: Float!
    $description: String
  ) {
    adjustAccountLimit(_id: $_id, amount: $amount, description: $description) {
      ok
      message
    }
  }
`

// Strips the markup an export wraps a description in - HIKE writes a
// description as "<p>2Colors Stick</p>" where the cashier only ever saw the
// text inside it.
const stripHtml = (value?: string) =>
  value
    ?.replace(/<[^>]*>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? ""

// An export can leave the product type blank - HIKE does it for 108 of the
// 888 rows in this shop's file - but a product must have one. Rather than
// dropping those rows, they are filed here and can be re-typed afterwards on
// the Products page. Change this if a different type suits better.
const FALLBACK_TYPE = "Merch"

// A product type in an export rarely matches ours exactly: it may be plural
// ("Drinks" for Drink), or name two types at once ("Merch;Merchandise").
// Tries the name as written, then the first of a list, then singular.
const findType = (index: Map<string, string>, value: string) => {
  const name = value.trim().toLowerCase()
  const first = name.split(";")[0].trim()
  return (
    index.get(name) ??
    index.get(first) ??
    (first.endsWith("s") ? index.get(first.slice(0, -1)) : undefined)
  )
}

// An exported name often carries baggage the stored one does not - a trailing
// "( Company Name )" and doubled spaces are both routine in a HIKE export.
const normaliseName = (value: string) =>
  value
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

// Looks a name up as written, then again with that baggage removed.
const findByName = (index: Map<string, string>, value: string) =>
  index.get(value.trim().toLowerCase()) ?? index.get(normaliseName(value))

// Case- and space-insensitive name lookup, since a spreadsheet will not match
// the stored casing reliably.
const buildIndex = (options: { label: string; value: string }[] = []) => {
  const index = new Map<string, string>()
  for (const option of options)
    index.set((option.label || "").trim().toLowerCase(), option.value)
  return index
}

const parseNumber = (value?: string) => {
  if (!value) return undefined
  // Tolerate "₱1,234.50" and "1 234.50" - spreadsheets format prices freely.
  const cleaned = value.replace(/[^\d.-]/g, "")
  if (!cleaned) return undefined
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

// Spreadsheets spell booleans every which way - TRUE/FALSE from an export,
// yes/no from a hand-edit, 1/0 from a CSV. Anything unrecognised is left
// undefined so the caller can decide the default.
const parseBoolean = (value?: string) => {
  const cleaned = value?.trim().toLowerCase()
  if (!cleaned) return undefined
  if (["true", "yes", "y", "1", "active"].includes(cleaned)) return true
  if (["false", "no", "n", "0", "inactive"].includes(cleaned)) return false
  return undefined
}

// Mongo rejects a second product with the same name (unique index on `name`).
// A real export legitimately carries the same name twice - the same item under
// two SKUs, or two variants nobody bothered to name apart - so the message is
// matched narrowly on that one index. A duplicate SKU is a different mistake
// and must still surface.
const isDuplicateName = (message?: string) =>
  !!message && /E11000/.test(message) && /index:\s*name_1/.test(message)

const errorMessage = (error: any) =>
  error?.graphQLErrors?.[0]?.message ?? error?.message ?? ""

// Enough to clear any realistic pile-up of the same name without spinning on a
// server that keeps reporting a clash for some other reason.
const MAX_NAME_ATTEMPTS = 50

// "09 Jan, 2026 - 10:35am" is how HIKE prints a sale date, and Date.parse
// makes nothing of it. Falls back to the browser for ISO and the other
// ordinary shapes.
const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
]

const parseDate = (value?: string) => {
  const text = value?.trim()
  if (!text) return undefined
  const match = text.match(
    /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s*(\d{4})(?:\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm))?$/i
  )
  if (match) {
    const month = MONTHS.indexOf(match[2].toLowerCase())
    if (month >= 0) {
      let hour = match[4] ? Number(match[4]) % 12 : 0
      if (match[6]?.toLowerCase() === "pm") hour += 12
      return new Date(
        Number(match[3]),
        month,
        Number(match[1]),
        hour,
        Number(match[5] ?? 0)
      ).toISOString()
    }
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

// First column that carries a value, so an export's own header name works
// without the file having to be rewritten first.
const pick = (row: ImportRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key]?.trim()
    if (value) return value
  }
  return undefined
}

/* ------------------------------------------------------------------ types */

const PRODUCT_TYPE_COLUMNS: ImportColumn[] = [
  { key: "name", required: true, example: "Badminton Products" },
]

export function ImportProductTypes({
  onFinished,
}: {
  onFinished?: () => void
}) {
  const [createProductType] = useMutation(CREATE_PRODUCT_TYPE, {
    refetchQueries: ["ProductTypeTable", "ProductTypeOptions"],
    onQueryUpdated: refetchOnlyReadyQueries,
  })

  const importRow = async (row: ImportRow): Promise<RowResult> => {
    const name = row["name"]?.trim()
    if (!name) return { ok: false, error: "name is required" }
    const result: any = await createProductType({
      variables: { input: { name } },
    })
    return result?.data?.createProductType?.ok
      ? { ok: true }
      : {
          ok: false,
          error: result?.data?.createProductType?.message ?? "Failed",
        }
  }

  return (
    <ImportDialog
      title="Import Product Types"
      description="Each row creates one product type. Existing names are rejected by the server, so re-importing the same file will not create duplicates."
      columns={PRODUCT_TYPE_COLUMNS}
      importRow={importRow}
      onFinished={onFinished}
    />
  )
}

/* --------------------------------------------------------------- products */

const PRODUCT_COLUMNS: ImportColumn[] = [
  { key: "name", required: true, example: "Yonex Shoes White 25.5" },
  { key: "sku", required: true, example: "1002270" },
  {
    key: "price",
    aliases: ["retail price", "selling price"],
    required: true,
    hint: "selling price",
    example: "4500",
  },
  { key: "barcode", example: "4901234567894" },
  {
    key: "cost",
    aliases: ["cost price", "purchase price"],
    hint: "purchase cost",
    example: "3200",
  },
  {
    key: "brand",
    aliases: ["brand name"],
    hint: "must already exist",
    example: "Yonex",
  },
  {
    key: "type",
    aliases: ["product type"],
    hint: `must already exist, blank rows are filed under ${FALLBACK_TYPE}`,
    example: "Merchandise",
  },
  {
    key: "registers",
    hint: "semicolon-separated, all registers when left out",
    example: "Main Counter/Reception",
  },
  { key: "description", example: "" },
  {
    key: "active",
    hint: "TRUE or FALSE, defaults to TRUE",
    example: "TRUE",
  },
]

export function ImportProducts({ onFinished }: { onFinished?: () => void }) {
  const { data } = useQuery(GET_LOOKUPS, { fetchPolicy: "cache-and-network" })
  const [createProduct] = useMutation(CREATE_PRODUCT, {
    refetchQueries: ["ProductTable", "ProductOptions"],
    onQueryUpdated: refetchOnlyReadyQueries,
  })

  const lookups = useMemo(() => {
    const result = data as any
    return {
      brands: buildIndex(result?.brandOptions),
      types: buildIndex(result?.productTypeOptions),
      registers: buildIndex(result?.registerOptions),
    }
  }, [data])

  const importRow = async (row: ImportRow): Promise<RowResult> => {
    const name = row["name"]?.trim()
    const sku = row["sku"]?.trim()
    const price = parseNumber(row["price"])
    if (!name) return { ok: false, error: "name is required" }
    if (!sku) return { ok: false, error: "sku is required" }
    if (price === undefined)
      return { ok: false, error: "price is missing or not a number" }

    // Names that don't resolve are reported rather than silently dropped: a
    // product filed under no type would be invisible on the register.
    const brandName = row["brand"]?.trim().toLowerCase()
    const brand = brandName ? lookups.brands.get(brandName) : undefined
    if (brandName && !brand)
      return { ok: false, error: `brand "${row["brand"]}" not found` }

    // Checked here rather than left to the server: a product with no type is
    // rejected either way, and the server's generic "Form validation error."
    // hides which column is at fault.
    const typeName = row["type"]?.trim() || FALLBACK_TYPE
    const type = findType(lookups.types, typeName)
    if (!type)
      return {
        ok: false,
        error: row["type"]?.trim()
          ? `type "${row["type"]}" not found`
          : `no type given and the fallback "${FALLBACK_TYPE}" does not exist`,
      }

    const registerNames = (row["registers"] || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
    const registers: string[] = []
    for (const registerName of registerNames) {
      const id = lookups.registers.get(registerName.toLowerCase())
      if (!id)
        return { ok: false, error: `register "${registerName}" not found` }
      registers.push(id)
    }
    // A file that says nothing about registers means the product should be
    // sellable everywhere - the alternative is a product no register can ring
    // up, which is never what an import intends.
    if (!registers.length) registers.push(...lookups.registers.values())

    // An export carrying discontinued lines should land them deactivated
    // rather than on the register.
    const active = parseBoolean(row["active"])
    if (row["active"]?.trim() && active === undefined)
      return { ok: false, error: `active "${row["active"]}" is not TRUE/FALSE` }

    const input = {
      sku,
      barcode: row["barcode"]?.trim() || "",
      description: stripHtml(row["description"]),
      image: "",
      currentPrice: price,
      cost: parseNumber(row["cost"]) ?? 0,
      brand,
      type,
      registers,
      isActive: active ?? true,
    }

    // A name already taken is retried as "Name (2)", then "(3)", and so on,
    // so a repeated name costs the row its exact label rather than the whole
    // record. Anything else - a duplicate SKU, a validation failure - is
    // reported untouched.
    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
      const attemptedName = attempt === 1 ? name : `${name} (${attempt})`
      try {
        const result: any = await createProduct({
          variables: { input: { ...input, name: attemptedName } },
        })
        if (result?.data?.createProduct?.ok) return { ok: true }
        const message = result?.data?.createProduct?.message ?? "Failed"
        if (!isDuplicateName(message)) return { ok: false, error: message }
      } catch (error: any) {
        if (!isDuplicateName(errorMessage(error))) throw error
      }
    }
    return {
      ok: false,
      error: `"${name}" is already taken ${MAX_NAME_ATTEMPTS} times over`,
    }
  }

  return (
    <ImportDialog
      title="Import Products"
      description="Each row creates one product. Brand, type and register are matched by name and must already exist — create those first. A name already in use is imported as “Name (2)”."
      columns={PRODUCT_COLUMNS}
      importRow={importRow}
      onFinished={onFinished}
    />
  )
}

/* -------------------------------------------------------------- customers */

const CUSTOMER_COLUMNS: ImportColumn[] = [
  { key: "first name", required: true, example: "Juan" },
  {
    key: "last name",
    hint: "blank for a business or one-name customer",
    example: "Dela Cruz",
  },
  { key: "middle name", example: "Santos" },
  { key: "type", hint: "CUSTOMER or EMPLOYEE", example: "CUSTOMER" },
  { key: "email", example: "juan@example.com" },
  {
    key: "account limit",
    aliases: ["credit limit"],
    hint: "opening limit, or 'credit limit'",
    example: "10000",
  },
  { key: "store credit", hint: "opening credit", example: "0" },
]

export function ImportCustomers({ onFinished }: { onFinished?: () => void }) {
  const [createCustomer] = useMutation(CREATE_CUSTOMER, {
    refetchQueries: ["CustomerTable", "CustomerOptions"],
    onQueryUpdated: refetchOnlyReadyQueries,
  })

  const importRow = async (row: ImportRow): Promise<RowResult> => {
    const firstName = row["first name"]?.trim()
    const lastName = row["last name"]?.trim()
    if (!firstName) return { ok: false, error: "first name is required" }

    const type = (row["type"] || "CUSTOMER").trim().toUpperCase()
    if (type !== "CUSTOMER" && type !== "EMPLOYEE")
      return { ok: false, error: `type must be CUSTOMER or EMPLOYEE` }

    const result: any = await createCustomer({
      variables: {
        input: {
          firstName,
          middleName: row["middle name"]?.trim() || null,
          lastName: lastName || null,
          type,
          email: row["email"]?.trim() || null,
          // "credit limit" is what a HIKE export calls it.
          accountLimit:
            parseNumber(pick(row, "account limit", "credit limit")) ?? 0,
          storeCredit: parseNumber(row["store credit"]) ?? 0,
        },
      },
    })
    return result?.data?.createCustomer?.ok
      ? { ok: true }
      : { ok: false, error: result?.data?.createCustomer?.message ?? "Failed" }
  }

  return (
    <ImportDialog
      title="Import Customers"
      description="Each row creates one customer. Display name is built from first + last name, the same as the form. Last name may be blank, and a HIKE export’s “credit limit” column is read as the account limit."
      columns={CUSTOMER_COLUMNS}
      importRow={importRow}
      onFinished={onFinished}
    />
  )
}

/* --------------------------------------------- on-account opening balances */

const OPENING_BALANCE_COLUMNS: ImportColumn[] = [
  {
    key: "customer",
    required: true,
    hint: "must already exist, matched by display name",
    example: "Juan Dela Cruz",
  },
  {
    key: "amount owed",
    aliases: ["outstanding"],
    required: true,
    hint: "outstanding balance to carry over",
    example: "1500",
  },
  {
    key: "note",
    hint: "shows in the limit history, e.g. the old invoice number",
    example: "AC103 - 09 Jan, 2026",
  },
]

export function ImportOpeningBalances({
  onFinished,
}: {
  onFinished?: () => void
}) {
  const client = useApolloClient()
  const { data } = useQuery(GET_CUSTOMER_LOOKUP, {
    fetchPolicy: "cache-and-network",
  })
  const [adjustAccountLimit] = useMutation(ADJUST_ACCOUNT_LIMIT, {
    refetchQueries: ["CustomerReport", "ViewAccountLimitDetails"],
    onQueryUpdated: refetchOnlyReadyQueries,
  })

  const customers = useMemo(
    () => buildIndex((data as any)?.customerOptions),
    [data]
  )

  const importRow = async (row: ImportRow): Promise<RowResult> => {
    const name = row["customer"]?.trim()
    const owed = parseNumber(row["amount owed"])
    if (!name) return { ok: false, error: "customer is required" }
    if (owed === undefined)
      return { ok: false, error: "amount owed is missing or not a number" }
    if (owed <= 0)
      return { ok: false, error: "amount owed must be greater than zero" }

    const customerId = findByName(customers, name)
    if (!customerId) return { ok: false, error: `customer "${name}" not found` }

    // A carried-over debt is recorded as a NEGATIVE limit adjustment: it
    // consumes available credit exactly as an unpaid on-account sale would,
    // and lands in the customer's limit history with the rest.
    const result: any = await adjustAccountLimit({
      variables: {
        _id: customerId,
        amount: -Math.abs(owed),
        description: row["note"]?.trim() || null,
      },
    })
    return result?.data?.adjustAccountLimit?.ok
      ? { ok: true }
      : {
          ok: false,
          error: result?.data?.adjustAccountLimit?.message ?? "Failed",
        }
  }

  return (
    <ImportDialog
      title="Import On-Account Balances"
      description="Carries existing customer debts over from another system. Each row reduces that customer's available account limit by the amount owed and is recorded in their limit history, with the note against it. It does not create sales."
      columns={OPENING_BALANCE_COLUMNS}
      importRow={importRow}
      onFinished={() => {
        client.refetchQueries({ include: ["CustomerReportTable"] })
        onFinished?.()
      }}
    >
      <Button variant="outline" className="gap-1.5">
        <UploadSimpleIcon /> Import balances
      </Button>
    </ImportDialog>
  )
}

/* ------------------------------------------------- carried-over sales */

const LEGACY_SALE_COLUMNS: ImportColumn[] = [
  {
    key: "customer",
    required: true,
    hint: "must already exist, matched by display name",
    example: "Juan Dela Cruz",
  },
  {
    key: "sale number",
    aliases: ["order #", "sale #", "order number"],
    required: true,
    hint: "the old receipt number",
    example: "MC44173",
  },
  {
    key: "date",
    required: true,
    hint: "when it was rung up",
    example: "2026-08-25",
  },
  {
    key: "total",
    aliases: ["order total", "sale amount"],
    required: true,
    example: "196",
  },
  {
    key: "outstanding",
    required: true,
    hint: "still owed on it",
    example: "196",
  },
]

export function ImportLegacySales({ onFinished }: { onFinished?: () => void }) {
  const { data } = useQuery(GET_CUSTOMER_LOOKUP, {
    fetchPolicy: "cache-and-network",
  })
  const [importLegacySale] = useMutation(IMPORT_LEGACY_SALE, {
    refetchQueries: ["CustomerSalesTable"],
    onQueryUpdated: refetchOnlyReadyQueries,
  })

  const customers = useMemo(
    () => buildIndex((data as any)?.customerOptions),
    [data]
  )

  const importRow = async (row: ImportRow): Promise<RowResult> => {
    const name = row["customer"]?.trim()
    const saleNumber = row["sale number"]?.trim()
    const total = parseNumber(row["total"])
    const outstanding = parseNumber(row["outstanding"])
    const date = parseDate(row["date"])
    // A report's own totals row has figures but no customer and no receipt
    // number. Skipping it quietly beats reporting it as a failure.
    if (!name && !saleNumber) return { ok: true, skipped: true }
    if (!name) return { ok: false, error: "customer is required" }
    if (!saleNumber) return { ok: false, error: "sale number is required" }
    if (!date)
      return { ok: false, error: `date "${row["date"]}" is not a date` }
    if (total === undefined)
      return { ok: false, error: "total is missing or not a number" }
    if (outstanding === undefined)
      return { ok: false, error: "outstanding is missing or not a number" }

    const customerId = findByName(customers, name)
    if (!customerId) return { ok: false, error: `customer "${name}" not found` }

    const result: any = await importLegacySale({
      variables: {
        input: { customer: customerId, saleNumber, date, total, outstanding },
      },
    })
    return result?.data?.importLegacySale?.ok
      ? { ok: true }
      : {
          ok: false,
          error: result?.data?.importLegacySale?.message ?? "Failed",
        }
  }

  return (
    <ImportDialog
      title="Import Carried-Over Sales"
      description="Adds the unpaid sales a customer had in the previous POS so their account still lists them. The rows carry no line items and are kept out of sale history and the sales report - they are a record of what was owed, not sales made here. Balances are not touched, so run this alongside the on-account balance import, not instead of it."
      columns={LEGACY_SALE_COLUMNS}
      importRow={importRow}
      onFinished={onFinished}
    >
      <Button variant="outline" className="gap-1.5">
        <UploadSimpleIcon /> Import sales
      </Button>
    </ImportDialog>
  )
}
