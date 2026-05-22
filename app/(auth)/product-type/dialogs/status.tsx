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
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { toast } from "sonner"

type Props = {
  _id: string
  status: boolean
  onClose: () => void
}

const GET_PRODUCT_TYPE = gql`
  query productType($_id: ID!) {
    productType(_id: $_id) {
      _id
      name
    }
  }
`

const CHANGE_STATUS = gql`
  mutation ChangeProductTypeStatus($_id: ID!) {
    changeProductTypeStatus(_id: $_id) {
      ok
      message
      data
    }
  }
`

export default function StatusDialog({ _id, status, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_PRODUCT_TYPE, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [changeStatus] = useMutation(CHANGE_STATUS, {
    // refetchQueries: ["ProcessedRegister"],
    // awaitRefetchQueries: true,
    updateQueries: {
      ProductTypeTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.changeProductTypeStatus.ok) return prev
        const updatedProductType =
          mutationResult.data.changeProductTypeStatus.data
        const updatedEdges = prev.productTypeTable.edges.map((edge: any) => {
          return edge.node._id === updatedProductType._id
            ? { ...edge, node: { ...edge.node, ...updatedProductType } }
            : edge
        })
        return {
          ...prev,
          productTypeTable: {
            ...prev.productTypeTable,
            edges: updatedEdges,
          },
        }
      },
    },
  })
  const statusText = status ? "Deactivate" : "Activate"

  const onStatusChange = async () => {
    try {
      const result: any = await changeStatus({ variables: { _id } })
      if (result.data.changeProductTypeStatus?.ok) {
        // Optionally, you can show a success message here
        toast.success(result.data.changeProductTypeStatus.message)
        onClose?.()
      }
    } catch (error) {
      console.error("Error changing status:", error)
    }
  }

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          {statusText}
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            {statusText} Product Type:{" "}
            <span className="underline">{data?.productType?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to {statusText.toLowerCase()} this
            productType?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button
            variant={status ? "destructive" : "default"}
            onClick={onStatusChange}
          >
            {statusText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
