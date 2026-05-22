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
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
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
  query CustomerReport($_id: ID!) {
    customerReport(_id: $_id) {
      _id
      name
      storeCredit {
        current
      }
    }
  }
`

const ADJUST_STORE_CREDIT = gql`
  mutation AdjustStoreCredit($_id: ID!, $amount: Float!, $description: String) {
    adjustStoreCredit(_id: $_id, amount: $amount, description: $description) {
      ok
      message
      data
    }
  }
`

const adjustCreditSchema = z.object({
  amount: z.number(),
  description: z.string().optional().nullable(),
})

export default function AdjustCreditDialog({ _id }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_CUSTOMER_REPORT, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [adjustCredit] = useMutation(ADJUST_STORE_CREDIT, {
    refetchQueries: ["ViewStoreCreditDetails", "CustomerReport"],
    awaitRefetchQueries: true,
    updateQueries: {
      CustomerReportTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.adjustStoreCredit.ok) return prev
        const updatedCustomerReport = mutationResult.data.adjustStoreCredit.data
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
      description: "",
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          adjustCreditSchema.parse(value)
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
          const result: any = await adjustCredit({
            variables: { _id, ...value },
          })
          if (result.data.adjustStoreCredit.ok) {
            toast.success(result.data.adjustStoreCredit.message)
            setOpen(false)
          }
        } catch (error) {
          console.error("Error adjusting store credit:", error)
        }
      }),
  })

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-destructive hover:bg-destructive/80">
          Issue Store Credit
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            Adjust Store Credit for{" "}
            <span className="underline">{data?.customerReport?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Adjust the store credit for this customer.
          </DialogDescription>
        </DialogHeader>
        <div>
          <form
            id="adjust-credit-form"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldSet>
              <div className="flex flex-col gap-1.5 border p-2">
                <Label>Remaining Store Credit</Label>
                <span className="block text-lg font-medium">
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(data?.customerReport?.storeCredit?.current || 0)}
                </span>
              </div>
              <form.Field name="amount">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Amount</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupAddon>
                          <InputGroupText>₱</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          placeholder="Amount"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(Number(e.target.value))
                          }
                          type="number"
                          inputMode="decimal"
                          step="any"
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
              <form.Field name="description">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupTextarea
                          placeholder="Description (optional)"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button type="submit" form="adjust-credit-form" disabled={isPending}>
            Adjust
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
