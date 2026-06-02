import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useEffect, useState, useTransition } from "react"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useForm } from "@tanstack/react-form"
import { paymentMethodSchema } from "@/validators/paymentMethod.validator"
import { toast } from "sonner"
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { IOption } from "@/types/shared.type"
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ButtonGroup } from "@/components/ui/button-group"
import { PaymentType } from "@/types/paymentMethod.type"

const CREATE_PAYMENT_METHOD = gql`
  mutation CreatePaymentMethod($input: PaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_PAYMENT_METHOD = gql`
  mutation UpdatePaymentMethod($id: ID!, $input: PaymentMethodInput!) {
    updatePaymentMethod(_id: $id, input: $input) {
      ok
      message
      data
    }
  }
`

const FETCH_PAYMENT_METHOD = gql`
  query PaymentMethod($_id: ID!) {
    paymentMethod(_id: $_id) {
      _id
      name
      type
    }
  }
`

type Props = {
  _id?: string
  onClose?: () => void
}

export default function FormDialog({ _id }: Props) {
  const isUpdate = Boolean(_id)
  const [open, setOpen] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  const [createPaymentMethod] = useMutation(CREATE_PAYMENT_METHOD, {
    updateQueries: {
      PaymentMethodTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.createPaymentMethod.ok) return prev
        const newPaymentMethod = mutationResult.data.createPaymentMethod.data
        return {
          ...prev,
          paymentMethodTable: {
            ...prev.paymentMethodTable,
            edges: [
              ...prev.paymentMethodTable.edges,
              {
                node: newPaymentMethod.node,
                cursor: newPaymentMethod.cursor,
                __typename: "PaymentMethodEdge",
              },
            ],
          },
        }
      },
    },
  })
  const [updatePaymentMethod] = useMutation(UPDATE_PAYMENT_METHOD, {
    updateQueries: {
      PaymentMethodTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.updatePaymentMethod.ok) return prev
        const updatedPaymentMethod =
          mutationResult.data.updatePaymentMethod.data
        const updatedEdges = prev.paymentMethodTable.edges.map((edge: any) =>
          edge.node._id === updatedPaymentMethod._id
            ? { ...edge, node: { ...edge.node, ...updatedPaymentMethod } }
            : edge
        )
        return {
          ...prev,
          paymentMethodTable: {
            ...prev.paymentMethodTable,
            edges: updatedEdges,
          },
        }
      },
    },
  })
  const { data }: any = useQuery(FETCH_PAYMENT_METHOD, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    skip: !isUpdate || !open,
  })
  const [openCommand, setOpenCommand] = useState(false)
  const options = Object.values(PaymentType).map((type) => ({
    label: type,
    value: type,
  }))

  const form = useForm({
    defaultValues: {
      name: "",
      type: "",
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          paymentMethodSchema.parse(value)
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
          const payload = {
            name: value.name,
            type: value.type,
          }

          const result: any = isUpdate
            ? await updatePaymentMethod({
                variables: {
                  id: _id,
                  input: payload,
                },
              })
            : await createPaymentMethod({
                variables: {
                  input: payload,
                },
              })

          if (
            result.data.createPaymentMethod?.ok ||
            result.data.updatePaymentMethod?.ok
          ) {
            setOpen(false)
            toast.success(
              result.data.createPaymentMethod?.message ||
                result.data.updatePaymentMethod?.message
            )
            form.reset()
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        }
      }),
  })

  useEffect(() => {
    if (data?.paymentMethod) {
      form.setFieldValue("name", data.paymentMethod.name)
      form.setFieldValue("type", data.paymentMethod.type)
    }
  }, [data, form])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {isUpdate ? (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Edit
          </DropdownMenuItem>
        ) : (
          <Button>Create Payment Method</Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Payment Method Form</SheetTitle>
          <SheetDescription>
            Make changes to your payment method here. Click save when
            you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <form
            id="payment-method-form"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldSet>
              <form.Field name="name">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Name"
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
              <form.Field name="type">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Payment Type</FieldLabel>
                      <Popover open={openCommand} onOpenChange={setOpenCommand}>
                        <PopoverTrigger asChild>
                          <ButtonGroup className="w-full">
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openCommand}
                              className={cn(
                                field.state.value &&
                                  "rounded-tr-none rounded-br-none",
                                isInvalid && "border-destructive",
                                "flex-1 justify-between bg-transparent text-black/80 capitalize"
                              )}
                              type="button"
                            >
                              {field.state.value
                                ? options?.find(
                                    (o: IOption) =>
                                      o.value === field.state.value?.toString()
                                  )?.label
                                : `Select ${field.name}`}
                              <CaretDownIcon />
                            </Button>
                          </ButtonGroup>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput
                              placeholder={`Filter ${field.name}`}
                            />
                            <CommandList>
                              <CommandEmpty>No option/s found.</CommandEmpty>
                              <CommandGroup>
                                {options?.map((o: IOption) => (
                                  <CommandItem
                                    key={o.value}
                                    value={o.value}
                                    onSelect={(val) => {
                                      if (val === field.state.value)
                                        field.setValue("")
                                      else {
                                        field.setValue(val.trim())
                                      }
                                      setOpenCommand(false)
                                    }}
                                  >
                                    <span className="block">{o.label}</span>
                                    {field.state.value.toString() ===
                                      o.value && (
                                      <CheckIcon className="block" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
        <SheetFooter>
          <Button type="submit" form="payment-method-form" disabled={isPending}>
            Submit
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
