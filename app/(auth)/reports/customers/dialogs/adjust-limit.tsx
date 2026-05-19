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
      accountLimit {
        max
        current
      }
    }
  }
`

const ADJUST_ACCOUNT_LIMIT = gql`
  mutation AdjustAccountLimit($_id: ID!, $amount: Float!) {
    adjustAccountLimit(_id: $_id, amount: $amount) {
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
  const [adjustCredit] = useMutation(ADJUST_ACCOUNT_LIMIT, {
    refetchQueries: [
      "CustomerReport",
      "CustomerReportTable",
      "ViewAccountLimitDetails",
    ],
    awaitRefetchQueries: true,
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
          if (result.data.adjustAccountLimit.ok) {
            toast.success(result.data.adjustAccountLimit.message)
            setOpen(false)
          }
        } catch (error) {
          console.error("Error adjusting account limit:", error)
        }
      }),
  })

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-700 hover:bg-blue-700/80">
          Adjust Account Limit
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            Adjust Max Account Limit for{" "}
            <span className="underline">{data?.customerReport?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Adjust the account limit for this customer.
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
              <div className="grid grid-cols-2 gap-1.5 border p-2">
                <div>
                  <Label>Max Account Limit</Label>
                  <span className="block text-lg font-medium ">
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(data?.customerReport?.accountLimit?.max || 0)}
                  </span>
                </div>
                <div>
                  <Label>Remaining</Label>
                  <span className="block text-lg font-medium text-muted-foreground">
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(data?.customerReport?.accountLimit?.current || 0)}
                  </span>
                </div>
              </div>
              <form.Field name="amount">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Adjustment Amount for Max Limit</FieldLabel>
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
