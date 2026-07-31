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
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/custom/status-badge"
import { TagIcon, CalendarIcon } from "@phosphor-icons/react"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { format } from "date-fns"
import AssignedProductsTab from "./assigned-products"

type Props = {
  _id: string
  onClose: () => void
}

const GET_PRODUCT_TYPE = gql`
  query ProductType($_id: ID!) {
    productType(_id: $_id) {
      _id
      name
      parent {
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
  const { data }: any = useQuery(GET_PRODUCT_TYPE, {
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
        className="flex h-[520px] flex-col sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>View Product Type</DialogTitle>
          <DialogDescription>Details of the product type.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="details" className="flex-1 overflow-hidden">
          <TabsList variant="line">
            <TabsTrigger value="details">Product type</TabsTrigger>
            <TabsTrigger value="products">Assigned products</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="overflow-y-auto">
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <TagIcon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {data?.productType?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data?.productType?.parent?.name
                        ? `Under ${data.productType.parent.name}`
                        : "No parent type"}
                    </p>
                  </div>
                </div>
                <StatusBadge
                  status={data?.productType?.isActive ? "ACTIVE" : "INACTIVE"}
                />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <CalendarIcon
                    size={16}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-xs font-medium">
                      {data?.productType?.createdAt
                        ? format(Number(data.productType.createdAt), "PPp")
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarIcon
                    size={16}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p className="text-xs font-medium">
                      {data?.productType?.updatedAt
                        ? format(Number(data.productType.updatedAt), "PPp")
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="products" className="h-full overflow-hidden">
            <AssignedProductsTab _id={_id} active={open} />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
