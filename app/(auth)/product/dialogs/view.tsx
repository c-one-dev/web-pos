import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { format } from "date-fns"

type Props = {
  _id: string
  onClose: () => void
}

const GET_PRODUCT = gql`
  query Product($_id: ID!) {
    product(_id: $_id) {
      _id
      name
      image
      sku
      name
      barcode
      description
      currentPrice
      type {
        _id
        name
      }
      brand {
        _id
        name
      }
      registers {
        _id
        name
      }
      isActive
      createdAt
      updatedAt
    }
  }
`

export default function ViewDialog({ _id, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_PRODUCT, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          View
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>View Product</DialogTitle>
          <DialogDescription>Details of the product.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="col-span-2">
            <Label>Name</Label>
            <span className="block text-muted-foreground">
              {data?.product?.name}
            </span>
          </div>
          <div>
            <Label>SKU</Label>
            <span className="block text-muted-foreground">
              {data?.product?.sku || "-"}
            </span>
          </div>
          <div>
            <Label>Barcode</Label>
            <span className="block text-muted-foreground">
              {data?.product?.barcode || "-"}
            </span>
          </div>
          <div>
            <Label>Price</Label>
            <span className="block text-muted-foreground">
              {data?.product?.currentPrice !== undefined
                ? new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(data.product.currentPrice)
                : "-"}
            </span>
          </div>
          <div>
            <Label>Type</Label>
            <span className="block text-muted-foreground">
              {data?.product?.type?.name || "-"}
            </span>
          </div>
          <div>
            <Label>Brand</Label>
            <span className="block text-muted-foreground">
              {data?.product?.brand?.name || "-"}
            </span>
          </div>
          <div className="col-span-2">
            <Label>Registers</Label>
            <span className="block text-muted-foreground">
              {data?.product?.registers
                ?.map((register: any) => register.name)
                .join(", ") || "-"}
            </span>
          </div>

          <div className="col-span-2">
            <Label>Description</Label>
            <span className="block text-muted-foreground">
              {data?.product?.description || "-"}
            </span>
          </div>
          <div>
            <Label>Status</Label>
            <span
              className={`block font-medium ${
                data?.product?.isActive ? "text-green-600" : "text-red-600"
              }`}
            >
              {data?.product?.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div>
            <Label>Created Date</Label>
            <span className="block text-muted-foreground">
              {data?.product?.createdAt
                ? format(Number(data.product.createdAt), "PPpp")
                : "-"}
            </span>
          </div>
          <div>
            <Label>Updated Date</Label>
            <span className="block text-muted-foreground">
              {data?.product?.updatedAt
                ? format(Number(data.product.updatedAt), "PPpp")
                : "-"}
            </span>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
