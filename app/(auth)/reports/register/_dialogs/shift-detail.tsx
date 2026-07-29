import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { format } from "date-fns"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { XIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

type Props = {
  _id?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
}

const GET_SHIFT_DETAIL = gql`
  query ShiftDetail($_id: ID!) {
    registerSession(_id: $_id) {
      _id
      register {
        _id
        name
        outlet {
          _id
          name
        }
      }
      openedBy {
        _id
        name
        surname
      }
      openedAt
      openingFloat
      cashMovements {
        type
        amount
        note
        date
        by {
          _id
          name
          surname
        }
      }
      tally {
        method {
          _id
          name
        }
        expected
        counted
        difference
      }
      notes
      closedBy {
        _id
        name
        surname
      }
      closedAt
      status
    }
  }
`

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

export default function ShiftDetailDrawer({
  _id,
  open,
  setOpen,
  onClose,
}: Props) {
  const { data, loading }: any = useQuery(GET_SHIFT_DETAIL, {
    variables: { _id },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    skip: !_id || !open,
  })
  const session = data?.registerSession

  const handleClose = () => {
    setOpen?.(false)
    onClose?.()
  }

  const totalExpected = (session?.tally || []).reduce(
    (sum: number, item: any) => sum + item.expected,
    0
  )
  const totalCounted = (session?.tally || []).reduce(
    (sum: number, item: any) => sum + item.counted,
    0
  )
  const totalDifference = (session?.tally || []).reduce(
    (sum: number, item: any) => sum + item.difference,
    0
  )

  return (
    <Drawer direction="right" modal open={open} onOpenChange={handleClose}>
      <DrawerContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="lg:min-w-2xl"
      >
        <DrawerHeader className="flex flex-row justify-between">
          <div>
            <DrawerTitle>{session?.register?.name}</DrawerTitle>
            <DrawerDescription>
              {session?.register?.outlet?.name}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline" size="icon-lg" className="h-full">
              <XIcon />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-10" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto px-4">
            <div className="grid grid-cols-2 gap-1.5 bg-muted px-3 py-2">
              <div>
                <Label>Opened</Label>
                <span className="block text-muted-foreground">
                  {session?.openedAt
                    ? format(Number(session.openedAt), "PPp")
                    : "-"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  by{" "}
                  {session?.openedBy
                    ? `${session.openedBy.name} ${session.openedBy.surname}`
                    : "-"}
                </span>
              </div>
              <div>
                <Label>Closed</Label>
                <span className="block text-muted-foreground">
                  {session?.closedAt
                    ? format(Number(session.closedAt), "PPp")
                    : "-"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  by{" "}
                  {session?.closedBy
                    ? `${session.closedBy.name} ${session.closedBy.surname}`
                    : "-"}
                </span>
              </div>
              <div className="col-span-2">
                <Label>Opening Float</Label>
                <span className="block text-muted-foreground">
                  {currency(session?.openingFloat)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 bg-muted px-3 py-2">
              <Label className="text-lg font-semibold text-primary">
                Payment Tally
              </Label>
              <Table className="bg-white">
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment type</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session?.tally?.length > 0 ? (
                    session.tally.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.method?.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {currency(item.expected)}
                        </TableCell>
                        <TableCell className="text-right">
                          {currency(item.counted)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right",
                            item.difference !== 0 &&
                              "font-medium text-destructive"
                          )}
                        >
                          {currency(item.difference)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No tally recorded.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-4 pr-2 text-sm font-medium">
                <span>Total Expected: {currency(totalExpected)}</span>
                <span>Total Counted: {currency(totalCounted)}</span>
                <span
                  className={cn(totalDifference !== 0 && "text-destructive")}
                >
                  Total Difference: {currency(totalDifference)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 bg-muted px-3 py-2">
              <Label className="text-lg font-semibold text-primary">
                Cash In/Out
              </Label>
              <Table className="bg-white">
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session?.cashMovements?.length > 0 ? (
                    session.cashMovements.map(
                      (movement: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {movement.type}
                          </TableCell>
                          <TableCell>{movement.note || "-"}</TableCell>
                          <TableCell>
                            {movement.by
                              ? `${movement.by.name} ${movement.by.surname}`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {currency(movement.amount)}
                          </TableCell>
                        </TableRow>
                      )
                    )
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No cash movements.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {session?.notes && (
              <div className="space-y-1 bg-muted px-3 py-2">
                <Label className="text-lg font-semibold text-primary">
                  Notes
                </Label>
                <Separator />
                <span className="block text-muted-foreground">
                  {session.notes}
                </span>
              </div>
            )}
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
