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
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { useMutation, useQuery } from "@apollo/client/react"
import { useForm } from "@tanstack/react-form"
import gql from "graphql-tag"
import React, { useState, useTransition } from "react"
import { toast } from "sonner"
import z from "zod"

type Props = {
  _id: string
}

const GET_CUSTOMER_REPORT = gql`
  query CustomerReportForSettlement($_id: ID!) {
    customerReport(_id: $_id) {
      _id
      name
      accountLimit {
        max
        current
      }
    }
  }
`

const SETTLE_ACCOUNT_BALANCE = gql`
  mutation SettleAccountBalance($_id: ID!, $amount: Float!) {
    settleAccountBalance(_id: $_id, amount: $amount) {
      ok
      message
      data
    }
  }
`

const settleBalanceSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
})

const currency = (value?: number | null) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0)

export default function SettleBalanceDialog({ _id }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_CUSTOMER_REPORT, {
    variables: { _id },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const outstanding =
    (data?.customerReport?.accountLimit?.max || 0) -
    (data?.customerReport?.accountLimit?.current || 0)

  const [settleBalance] = useMutation(SETTLE_ACCOUNT_BALANCE, {
    refetchQueries: ["ViewAccountLimitDetails", "CustomerReport"],
    awaitRefetchQueries: true,
    updateQueries: {
      CustomerReportTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.settleAccountBalance.ok) return prev
        const updatedCustomerReport =
          mutationResult.data.settleAccountBalance.data
        const updatedEdges = prev.customerReportTable.edges.map((edge: any) =>
          edge.node._id === updatedCustomerReport._id
            ? { ...edge, node: { ...edge.node, ...updatedCustomerReport } }
            : edge
        )
        return {
          ...prev,
          customerReportTable: {
            ...prev.customerReportTable,
            edges: updatedEdges,
          },
        }
      },
    },
  })

  const form = useForm({
    defaultValues: {
      amount: 0,
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          settleBalanceSchema.parse(value)
        } catch (error: any) {
          JSON.parse(error).map(({ path, message }: any) => {
            const pathName = path.join(".")
            formApi.fieldInfo[pathName].instance?.setErrorMap({
              onSubmit: { message },
            })
          })
        }
      },
    },
    onSubmit: ({ value }: any) =>
      startTransition(async () => {
        try {
          const result: any = await settleBalance({
            variables: { _id, amount: value.amount },
          })
          if (result.data.settleAccountBalance.ok) {
            toast.success(result.data.settleAccountBalance.message)
            form.reset()
            setOpen(false)
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        }
      }),
  })

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) form.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button className="cursor-pointer rounded-[10px] bg-green-700 hover:bg-green-700/80">
          Settle Balance
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            Settle Balance for{" "}
            <span className="underline">{data?.customerReport?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Record a repayment toward this customer&apos;s outstanding On
            Account balance. This restores their available credit without
            raising their max limit.
          </DialogDescription>
        </DialogHeader>
        <div>
          <form
            id="settle-balance-form"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldSet>
              <div className="border p-2">
                <Label>Outstanding Balance</Label>
                <span className="block text-lg font-medium text-destructive">
                  {currency(outstanding)}
                </span>
              </div>
              <form.Field name="amount">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Settlement Amount
                      </FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupAddon>
                          <InputGroupText>₱</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          placeholder="Amount"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={
                            Number.isNaN(field.state.value)
                              ? ""
                              : field.state.value
                          }
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(parseFloat(e.target.value))
                          }
                          onFocus={(e) => e.currentTarget.select()}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          max={outstanding}
                          aria-invalid={isInvalid}
                        />
                      </InputGroup>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              </form.Field>
            </FieldSet>
          </form>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer rounded-[10px]">
              Close
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form="settle-balance-form"
            disabled={isPending}
            className="cursor-pointer rounded-[10px]"
          >
            Settle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
