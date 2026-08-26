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
import { Separator } from "@/components/ui/separator"
import { useQuery } from "@apollo/client/react"
import { format } from "date-fns"
import gql from "graphql-tag"
import {
  CalendarBlankIcon,
  NoteIcon,
  WalletIcon,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

type Props = {
  _id?: string
  customerId?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
}

const GET_CREDIT_ITEM = gql`
  query customerCreditHistoryItemById($customerId: ID!, $itemId: ID!) {
    customerCreditHistoryItemById(customerId: $customerId, itemId: $itemId) {
      _id
      description
      date
      transacted
      remaining
    }
  }
`

const peso = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value ?? 0)

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <div className="text-base break-words">{children}</div>
      </div>
    </div>
  )
}

export default function RowViewCreditHistoryItemDialog({
  _id: itemId,
  customerId,
  open,
  setOpen,
  onClose,
}: Props) {
  const { data }: any = useQuery(GET_CREDIT_ITEM, {
    variables: {
      customerId,
      itemId,
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    skip: !itemId || !open,
  })
  const item = data?.customerCreditHistoryItemById

  const handleClose = () => {
    setOpen?.(false)
    onClose?.()
  }

  // Credit added vs credit spent. Drives the whole colour treatment, so it is
  // worked out once rather than re-tested at each usage.
  const isCredit = (item?.transacted ?? 0) >= 0

  return (
    <Dialog modal open={open} onOpenChange={handleClose}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="gap-5 p-4 sm:max-w-lg sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            Store credit entry
          </DialogTitle>
          <DialogDescription className="text-base">
            One movement in this customer&apos;s store credit.
          </DialogDescription>
        </DialogHeader>

        {/*
          The transacted amount is the thing being looked up, so it gets the
          weight - sign, colour and its own block together, rather than a small
          coloured number in a list of four equal fields. Added vs spent is
          carried by the +/- sign, the colour and the wording, so it does not
          rest on colour alone.
        */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-md border p-4",
            isCredit
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5"
          )}
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              isCredit
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {/*
              Peso sign rather than a direction arrow. Phosphor has no peso
              glyph, so this is the character itself - which is also what the
              amount beside it is denominated in.
            */}
            <span className="text-2xl font-semibold">₱</span>
          </span>
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {isCredit ? "Credit added" : "Credit spent"}
            </p>
            <p
              className={cn(
                "text-2xl font-semibold",
                isCredit ? "text-primary" : "text-destructive"
              )}
            >
              {isCredit && "+"}
              {peso(item?.transacted)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <DetailRow icon={<WalletIcon size={20} />} label="Balance after">
            <span className="font-medium">{peso(item?.remaining)}</span>
          </DetailRow>
          <Separator />
          <DetailRow icon={<NoteIcon size={20} />} label="Description">
            <span className={cn(!item?.description && "text-muted-foreground")}>
              {item?.description || "No description"}
            </span>
          </DetailRow>
          <Separator />
          <DetailRow icon={<CalendarBlankIcon size={20} />} label="Date">
            {item?.date ? format(Number(item.date), "PPpp") : "-"}
          </DetailRow>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="outline"
              size="lg"
              className="w-full text-base sm:w-auto"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
