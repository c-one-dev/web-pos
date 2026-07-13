import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useMutation, useQuery } from "@apollo/client/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import { ArrowElbowDownRightIcon, XIcon } from "@phosphor-icons/react"
import { Separator } from "@/components/ui/separator"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useTransition } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type Props = {
  _id?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
  external?: boolean
}

const GET_SALE = gql`
  query Sale($_id: ID!) {
    sale(_id: $_id) {
      _id
      saleNumber
      subTotal
      discount
      total
      receivedAmount
      changeAmount
      netAmount
      notes
      currentSaleStatus
      isOnAccount
      createdAt
      customer {
        _id
        name
      }
      items {
        snapshotName
        snapshotPrice
        quantity
        discount
        price
        subTotal
        total
      }
      payments {
        amount
        change
        note
        date
        method {
          _id
          name
        }
        payment {
          _id
          by {
            _id
            name
            surname
          }
        }
      }
      saleStatusHistory {
        status
        date
        by {
          _id
          name
          surname
        }
      }
      register {
        _id
        name
      }
      by {
        _id
        name
        surname
      }
      currentSalePaymentStatus
    }
  }
`

const VOID_SALE = gql`
  mutation VoidSale($_id: ID!) {
    voidSale(_id: $_id) {
      ok
      message
    }
  }
`

export default function RowViewDialog({
  _id,
  open,
  setOpen,
  onClose,
  external = false,
}: Props) {
  const { data, loading }: any = useQuery(GET_SALE, {
    variables: {
      _id,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [isPending, startTransition] = useTransition()
  const [voidSale] = useMutation(VOID_SALE, {
    refetchQueries: ["Sale"],
    awaitRefetchQueries: true,
  })

  const handleClose = () => {
    setOpen?.(false)
    onClose?.()
  }

  const isVoided = data?.sale?.currentSaleStatus === "VOIDED"

  const handleVoid = () =>
    startTransition(async () => {
      try {
        const result: any = await voidSale({ variables: { _id } })
        if (result.data.voidSale.ok) {
          toast.success(result.data.voidSale.message)
        }
      } catch (error: any) {
        toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
      }
    })

  return (
    <Drawer modal open={open} onOpenChange={handleClose} direction="right">
      <DrawerContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="min-w-screen lg:min-w-5xl"
      >
        <DrawerHeader className="flex flex-row justify-between">
          <div>
            <DrawerTitle>Sales Order</DrawerTitle>
            <DrawerDescription>
              Details of sales order {data?.sale?.saleNumber || "-"}
            </DrawerDescription>
            <ButtonGroup>
              <Button className="bg-blue-500">Print</Button>
              <Button className="bg-orange-500">Email</Button>
              <Button variant="default" className="border">
                Refund
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={isVoided || loading || isPending}
                  >
                    {isVoided ? "Voided" : "Void"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Void this sale?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This marks sale {data?.sale?.saleNumber} as voided. This
                      does not reverse any payments already recorded, and cannot
                      be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive"
                      onClick={handleVoid}
                    >
                      Yes, Void Sale
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </ButtonGroup>
          </div>
          <DrawerClose asChild>
            <Button variant="outline" size="lg" className="h-full">
              <XIcon />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-10" />
          </div>
        ) : (
          <div className="flex flex-col space-y-2 overflow-y-auto px-4">
            <div className="space-y-2">
              <div className="overflow-y-auto bg-muted px-3 py-2">
                <Label className="text-lg font-semibold text-primary">
                  Sales Summary
                </Label>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <div className="-space-y-px">
                      <span className="block text-left">
                        Customer:{" "}
                        <span className="text-muted-foreground">
                          {data?.sale?.customer
                            ? data.sale.customer.name
                            : "Walk-in"}
                        </span>
                      </span>
                      <span className="block text-left">
                        Sales #:{" "}
                        <Tooltip>
                          <TooltipTrigger>
                            <span
                              className={cn(
                                "w-full cursor-pointer font-medium",
                                data?.sale?.saleNumber
                                  ? "text-primary hover:underline"
                                  : "text-muted-foreground"
                              )}
                              onClick={() => {
                                if (!data?.sale?.saleNumber) {
                                  toast.warning("No saleNumber to copy.")
                                  return
                                }
                                navigator.clipboard.writeText(
                                  data?.sale?.saleNumber || ""
                                )
                                toast.success(
                                  `Sale Number: ${data?.sale?.saleNumber} copied to clipboard`
                                )
                              }}
                            >
                              {data?.sale?.saleNumber || "No sales no."}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Copy to clipboard.</p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    </div>
                    <div className="-space-y-px">
                      <span className="block text-right">
                        Order Date:{" "}
                        <span className="text-muted-foreground">
                          {data?.sale?.createdAt
                            ? format(Number(data.sale.createdAt), "PPpp")
                            : "-"}
                        </span>
                      </span>
                      <span className="block text-right">
                        User:{" "}
                        <span className="text-muted-foreground">
                          {data?.sale?.by
                            ? `${data.sale.by.name} ${data.sale.by.surname}`
                            : "-"}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {data?.sale?.items.map((item: any, index: number) => (
                      <div className="space-y-2" key={index}>
                        <div className="flex items-center justify-between rounded-sm hover:bg-muted">
                          <div className="flex items-center gap-2">
                            <div className="flex h-15 w-15 items-center justify-center bg-slate-300">
                              <span className="block text-3xl font-medium text-white">
                                {`${item.snapshotName[0]}${item.snapshotName[1] || ""}`.toUpperCase()}
                              </span>
                            </div>
                            <div className="-space-y-px">
                              <span className="block text-lg">
                                {item.snapshotName}
                              </span>
                              <span className="block text-xs font-medium text-foreground">
                                {new Intl.NumberFormat("en-PH", {
                                  style: "currency",
                                  currency: "PHP",
                                }).format(item.price)}{" "}
                                <span className="text-muted-foreground">
                                  x{item.quantity}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div className="flex h-full flex-col justify-start">
                            <span className="block text-lg font-medium">
                              {new Intl.NumberFormat("en-PH", {
                                style: "currency",
                                currency: "PHP",
                              }).format(item.total)}
                            </span>
                          </div>
                        </div>
                        <Separator />
                      </div>
                    )) || (
                      <span className="text-muted-foreground">No items</span>
                    )}
                  </div>
                  <div className="flex flex-col space-y-1">
                    <div className="flex w-full items-center justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(data?.sale?.subTotal || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="mt-1 flex w-full items-center justify-between">
                      <span className="block">Discount</span>
                      <span className="block font-medium">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(data?.sale?.discount || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="mt-1 flex w-full items-center justify-between">
                      <span>Total</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(data?.sale?.total || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="mt-1 flex w-full items-center justify-between">
                      <span>Received</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(data?.sale?.receivedAmount || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="mt-1 flex w-full items-center justify-between">
                      <span>Change</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(data?.sale?.changeAmount || 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="mt-1 flex w-full items-center justify-between">
                      <span className="font-semibold">Net Amount</span>
                      <span className="font-semibold underline">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(data?.sale?.netAmount || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-y-auto bg-muted px-3 py-2">
                <Label className="text-lg font-semibold text-primary">
                  Notes
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <span
                      className={cn(
                        "w-full cursor-pointer font-medium",
                        data?.sales?.notes
                          ? "text-primary hover:underline"
                          : "text-muted-foreground"
                      )}
                      onClick={() => {
                        if (!data?.sales?.notes) {
                          toast.warning("No notes to copy.")
                          return
                        }
                        navigator.clipboard.writeText(data?.sales?.notes || "")
                        toast.success(
                          `Note: ${data?.sales?.notes} copied to clipboard`
                        )
                      }}
                    >
                      {data?.sales?.notes || "No notes."}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy to clipboard.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1 overflow-y-auto bg-muted px-3 py-2">
                <Label className="text-lg font-semibold text-primary">
                  Payment Summary
                </Label>
                <Table className="border bg-white">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableCaption className="mt-1.5 font-medium">
                    Payment Status:{" "}
                    <span className="font-semibold text-foreground">
                      {data?.sale?.currentSalePaymentStatus}
                    </span>
                  </TableCaption>
                  <TableBody>
                    {data?.sale?.payments.length > 0 ? (
                      data.sale.payments.map((payment: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {format(Number(payment.date), "PP")}
                          </TableCell>
                          <TableCell>
                            {payment.method.name}
                            {payment.note != "" && (
                              <Label className="text-xs text-muted-foreground">
                                <ArrowElbowDownRightIcon className="-mr-1" />{" "}
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span
                                      className="cursor-pointer font-medium text-primary hover:underline"
                                      onClick={() => {
                                        navigator.clipboard.writeText(
                                          payment?.note || ""
                                        )
                                        toast.success(
                                          `Note: ${payment?.note} copied to clipboard`
                                        )
                                      }}
                                    >
                                      {payment.note}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Copy to clipboard.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                            )}
                          </TableCell>
                          <TableCell className="w-[150px]">
                            <span className="block">
                              {payment.payment.by.name}
                            </span>
                          </TableCell>
                          <TableCell className="w-[250px] text-right">
                            {new Intl.NumberFormat("en-PH", {
                              style: "currency",
                              currency: "PHP",
                            }).format(payment.amount - payment.change)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          No payments
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-1 overflow-y-auto bg-muted px-3 py-2">
                <Label className="text-lg font-semibold text-primary">
                  Sale History
                </Label>
                <Table className="border bg-white">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableCaption className="mt-1.5 font-medium">
                    Sale Status:{" "}
                    <span className="font-semibold text-foreground">
                      {data?.sale?.currentSaleStatus}
                    </span>
                  </TableCaption>
                  <TableBody>
                    {data?.sale?.saleStatusHistory.length > 0 ? (
                      data.sale.saleStatusHistory.map(
                        (item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {format(Number(item.date), "PP")}
                            </TableCell>
                            <TableCell>{item.status}</TableCell>
                            <TableCell className="w-[400px]">
                              <span className="block">{item.by.name}</span>
                            </TableCell>
                          </TableRow>
                        )
                      )
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground"
                        >
                          No status history.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
