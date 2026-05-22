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
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useState } from "react"
import { toast } from "sonner"

type Props = {
  _id: string
  status: boolean
  onClose: () => void
}

const GET_PRODUCT = gql`
  query Product($_id: ID!) {
    product(_id: $_id) {
      _id
      name
    }
  }
`

const CHANGE_STATUS_PRODUCT = gql`
  mutation ChangeProductStatus($_id: ID!) {
    changeProductStatus(_id: $_id) {
      ok
      message
      data
    }
  }
`

export default function StatusDialog({ _id, status, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_PRODUCT, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [changeStatus] = useMutation(CHANGE_STATUS_PRODUCT, {
    updateQueries: {
      ProductTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.changeProductStatus.ok) return prev
        const updatedProduct = mutationResult.data.changeProductStatus.data
        const updatedEdges = prev.productTable.edges.map((edge: any) => {
          return edge.node._id === updatedProduct._id
            ? { ...edge, node: { ...edge.node, ...updatedProduct } }
            : edge
        })
        return {
          ...prev,
          productTable: {
            ...prev.productTable,
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
      if (result.data.changeProductStatus.ok) {
        // Optionally, you can show a success message here
        toast.success(result.data.changeProductStatus.message)
        onClose()
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
            {statusText} Product:{" "}
            <span className="underline">{data?.product?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to {statusText.toLowerCase()} this product?
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
