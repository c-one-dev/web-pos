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
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useState } from "react"

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

export default function AssignedProductsTab({ _id, active }: Props) {
  const [search, setSearch] = useState("")
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
            {products.map((product: any) => (
              <TableRow key={product._id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.sku || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
