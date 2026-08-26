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

const ADJUST_ACCOUNT_LIMIT = gql`
  mutation ImportAdjustAccountLimit($_id: ID!, $amount: Float!) {
    adjustAccountLimit(_id: $_id, amount: $amount) {
      ok
      message
    }
  }
`

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
  { key: "price", required: true, hint: "selling price", example: "4500" },
  { key: "barcode", example: "4901234567894" },
  { key: "cost", hint: "purchase cost", example: "3200" },
  { key: "brand", hint: "must already exist", example: "Yonex" },
  {
    key: "type",
    hint: "product type, must already exist",
    example: "Merchandise",
  },
  {
    key: "registers",
    hint: "semicolon-separated",
    example: "Main Counter/Reception",
  },
  { key: "description", example: "" },
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

    const typeName = row["type"]?.trim().toLowerCase()
    const type = typeName ? lookups.types.get(typeName) : undefined
    if (typeName && !type)
      return { ok: false, error: `type "${row["type"]}" not found` }

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

    const result: any = await createProduct({
      variables: {
        input: {
          name,
          sku,
          barcode: row["barcode"]?.trim() || "",
          description: row["description"]?.trim() || "",
          image: "",
          currentPrice: price,
          cost: parseNumber(row["cost"]) ?? 0,
          brand,
          type,
          registers,
        },
      },
    })
    return result?.data?.createProduct?.ok
      ? { ok: true }
      : { ok: false, error: result?.data?.createProduct?.message ?? "Failed" }
  }

  return (
    <ImportDialog
      title="Import Products"
      description="Each row creates one product. Brand, type and register are matched by name and must already exist — create those first."
      columns={PRODUCT_COLUMNS}
      importRow={importRow}
      onFinished={onFinished}
    />
  )
}

/* -------------------------------------------------------------- customers */

const CUSTOMER_COLUMNS: ImportColumn[] = [
  { key: "first name", required: true, example: "Juan" },
  { key: "last name", required: true, example: "Dela Cruz" },
  { key: "middle name", example: "Santos" },
  { key: "type", hint: "CUSTOMER or EMPLOYEE", example: "CUSTOMER" },
  { key: "email", example: "juan@example.com" },
  { key: "account limit", hint: "opening limit", example: "10000" },
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
    if (!lastName) return { ok: false, error: "last name is required" }

    const type = (row["type"] || "CUSTOMER").trim().toUpperCase()
    if (type !== "CUSTOMER" && type !== "EMPLOYEE")
      return { ok: false, error: `type must be CUSTOMER or EMPLOYEE` }

    const result: any = await createCustomer({
      variables: {
        input: {
          firstName,
          middleName: row["middle name"]?.trim() || null,
          lastName,
          type,
          email: row["email"]?.trim() || null,
          accountLimit: parseNumber(row["account limit"]) ?? 0,
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
      description="Each row creates one customer. Display name is built from first + last name, the same as the form."
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
    required: true,
    hint: "outstanding balance to carry over",
    example: "1500",
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

    const customerId = customers.get(name.toLowerCase())
    if (!customerId) return { ok: false, error: `customer "${name}" not found` }

    // A carried-over debt is recorded as a NEGATIVE limit adjustment: it
    // consumes available credit exactly as an unpaid on-account sale would,
    // and lands in the customer's limit history with the rest.
    const result: any = await adjustAccountLimit({
      variables: { _id: customerId, amount: -Math.abs(owed) },
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
      description="Carries existing customer debts over from another system. Each row reduces that customer's available account limit by the amount owed and is recorded in their limit history. It does not create sales."
      columns={OPENING_BALANCE_COLUMNS}
      importRow={importRow}
      onFinished={() => {
        client.refetchQueries({ include: ["CustomerReportTable"] })
        onFinished?.()
      }}
    />
  )
}
