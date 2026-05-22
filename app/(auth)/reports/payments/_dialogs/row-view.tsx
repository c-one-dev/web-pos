import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useQuery } from "@apollo/client/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import SaleRowViewDialog from "@/app/(auth)/sale-history/_dialogs/row-view"
import { useState } from "react"

type Props = {
  _id?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
}

const GET_PAYMENT = gql`
  query Payment($_id: ID!) {
    payment(_id: $_id) {
      _id
      amount
      change
      date
      note
      createdAt
      updatedAt
      method {
        _id
        name
      }
      by {
        _id
        name
        surname
      }
      sale {
        _id
        saleNumber
      }
    }
  }
`

export default function RowViewDialog({ _id, open, setOpen, onClose }: Props) {
  const { data }: any = useQuery(GET_PAYMENT, {
    variables: {
      _id,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })
  const [openInternalPaymentDialog, setOpenInternalPaymentDialog] =
    useState<boolean>(false)

  const handleClose = () => {
    setOpen?.(false)
    onClose?.()
  }

  return (
    <Dialog modal open={open} onOpenChange={handleClose}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>View Payment</DialogTitle>
          <DialogDescription>Details of the payment.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="col-span-2">
            <Label>Net Amount</Label>
            <span className="block font-medium text-primary underline">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(data?.payment?.amount - data?.payment?.change)}
            </span>
          </div>
          <div>
            <Label>Paid Amount</Label>
            <span className="block text-muted-foreground">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(data?.payment?.amount)}
            </span>
          </div>
          <div>
            <Label>Change</Label>
            <span className="block text-muted-foreground">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(data?.payment?.change)}
            </span>
          </div>
          <Separator className="col-span-2" />
          <div className="col-span-2">
            <Label>Sales</Label>
            <div className="flex flex-col gap-1">
              {Array.isArray(data?.payment?.sale)
                ? data.payment.sale.map((s: any) => (
                    <div key={s._id}>
                      <SaleRowViewDialog
                        _id={s._id}
                        external
                        open={openInternalPaymentDialog}
                        setOpen={setOpenInternalPaymentDialog}
                        onClose={() => setOpenInternalPaymentDialog(false)}
                      />
                      <span
                        className="text-muted-foreground hover:cursor-pointer hover:text-primary"
                        onClick={() => setOpenInternalPaymentDialog(true)}
                      >
                        {s.saleNumber}
                      </span>
                    </div>
                  ))
                : "N/A"}
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <span className="block text-muted-foreground">
              {data?.payment?.note || "N/A"}
            </span>
          </div>
          <div>
            <Label>Payment Date</Label>
            <span className="block text-muted-foreground">
              {data?.payment?.date
                ? format(new Date(Number(data.payment.date)), "PPpp")
                : "N/A"}
            </span>
          </div>
          <div>
            <Label>Method</Label>
            <span className="block text-muted-foreground">
              {data?.payment?.method?.name || "N/A"}
            </span>
          </div>
          <div>
            <Label>By</Label>
            <span className="block text-muted-foreground">
              {data?.payment?.by
                ? `${data.payment.by.name} ${data.payment.by.surname}`
                : "N/A"}
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
