import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { CaretDownIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/custom/status-badge"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  _id: string
  active: boolean
}

const GET_ASSIGNED_PRODUCTS = gql`
  query ProductTypeAssignedProducts($_id: ID!, $search: String) {
    productTypeAssignedProducts(_id: $_id, search: $search) {
      _id
      name
      sku
    }
  }
`

// Only what is worth seeing without leaving the product type - the full record
// is a click away on the Products page.
const GET_PRODUCT = gql`
  query AssignedProduct($_id: ID!) {
    product(_id: $_id) {
      _id
      barcode
      description
      currentPrice
      cost
      brand {
        _id
        name
      }
      registers {
        _id
        name
      }
      isActive
    }
  }
`

const peso = (value?: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

function ProductDetails({ _id }: { _id: string }) {
  const { data, loading }: any = useQuery(GET_PRODUCT, {
    variables: { _id },
    fetchPolicy: "cache-first",
  })
  const product = data?.product

  if (loading && !product)
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    )

  const rows: [string, React.ReactNode][] = [
    ["Price", peso(product?.currentPrice)],
    ["Cost", peso(product?.cost)],
    ["Barcode", product?.barcode || "-"],
    ["Brand", product?.brand?.name || "-"],
    [
      "Registers",
      product?.registers?.length
        ? product.registers.map((register: any) => register.name).join(", ")
        : "-",
    ],
    ["Description", product?.description || "-"],
  ]

  return (
    <div className="flex flex-col gap-2 bg-muted/40 p-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-medium break-words">{value}</span>
          </div>
        ))}
      </div>
      <StatusBadge status={product?.isActive ? "ACTIVE" : "INACTIVE"} />
    </div>
  )
}

export default function AssignedProductsTab({ _id, active }: Props) {
  const [search, setSearch] = useState("")
  // One row open at a time: this sits inside a dialog, so several expanded
  // rows would push the list out of view rather than help.
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, loading }: any = useQuery(GET_ASSIGNED_PRODUCTS, {
    variables: { _id, search },
    fetchPolicy: "cache-and-network",
    skip: !_id || !active,
  })

  const products = data?.productTypeAssignedProducts || []

  return (
    <div className="flex h-full flex-col gap-1.5">
      <InputGroup>
        <InputGroupInput
          placeholder="Find products..."
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <InputGroupAddon>
          <MagnifyingGlassIcon />
        </InputGroupAddon>
      </InputGroup>
      <div className="flex-1 overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product name</TableHead>
              <TableHead>SKU</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && products.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="text-center text-muted-foreground"
                >
                  No products assigned.
                </TableCell>
              </TableRow>
            )}
            {products.map((product: any) => {
              const isOpen = openId === product._id
              return (
                <React.Fragment key={product._id}>
                  <TableRow
                    onClick={() => setOpenId(isOpen ? null : product._id)}
                    className={cn(
                      "cursor-pointer",
                      isOpen && "bg-muted/60 hover:bg-muted/60"
                    )}
                  >
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <CaretDownIcon
                          size={12}
                          className={cn(
                            "shrink-0 text-muted-foreground transition-transform",
                            !isOpen && "-rotate-90"
                          )}
                        />
                        {product.name}
                      </span>
                    </TableCell>
                    <TableCell>{product.sku || "-"}</TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={2} className="p-0">
                        <ProductDetails _id={product._id} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
