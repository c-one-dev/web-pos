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
import { customerSchema } from "@/validators/customer.validator"
import { toast } from "sonner"
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CREATE_CUSTOMER = gql`
  mutation CreateCustomer($input: CustomerInput!) {
    createCustomer(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_CUSTOMER = gql`
  mutation UpdateCustomer($id: ID!, $input: CustomerInput!) {
    updateCustomer(_id: $id, input: $input) {
      ok
      message
      data
    }
  }
`

const FETCH_CUSTOMER = gql`
  query Customer($_id: ID!) {
    customer(_id: $_id) {
      _id
      firstName
      middleName
      lastName
      type
      email
    }
  }
`

type Props = {
  _id?: string
  onClose?: () => void
  // Lets a caller supply its own trigger instead of the default
  // "Create Customer" button - the register's customer picker opens this
  // same form from inside its popover.
  trigger?: React.ReactNode
  // Fires with the newly created customer node so a caller can select it
  // straight away rather than making the cashier re-open the list.
  onCreated?: (customer: any) => void
  // Optional controlled mode. The register opens this form from inside a
  // popover; rendering the sheet as a child of the popover would unmount it
  // the moment it took focus, so the caller keeps it as a sibling and drives
  // it from here instead.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function FormDialog({
  _id,
  trigger,
  onCreated,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const isUpdate = Boolean(_id)
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }
  const [isPending, startTransition] = useTransition()
  const [createCustomer] = useMutation(CREATE_CUSTOMER, {
    // Keeps the register's customer dropdown in step - it reads
    // CustomerOptions, which updateQueries below does not touch.
    refetchQueries: ["CustomerOptions"],
    updateQueries: {
      CustomerTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.createCustomer.ok) return prev
        const newCustomer = mutationResult.data.createCustomer.data
        return {
          ...prev,
          customerTable: {
            ...prev.customerTable,
            edges: [
              ...prev.customerTable.edges,
              {
                node: newCustomer.node,
                cursor: newCustomer.cursor,
                __typename: "CustomerEdge",
              },
            ],
          },
        }
      },
    },
  })
  const [updateCustomer] = useMutation(UPDATE_CUSTOMER, {
    updateQueries: {
      CustomerTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.updateCustomer.ok) return prev
        const updatedCustomer = mutationResult.data.updateCustomer.data
        const updatedEdges = prev.customerTable.edges.map((edge: any) =>
          edge.node._id === updatedCustomer._id
            ? { ...edge, node: { ...edge.node, ...updatedCustomer } }
            : edge
        )
        return {
          ...prev,
          customerTable: {
            ...prev.customerTable,
            edges: updatedEdges,
          },
        }
      },
    },
  })
  const { data }: any = useQuery(FETCH_CUSTOMER, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    skip: !isUpdate || !open,
  })

  const form = useForm({
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      type: "CUSTOMER",
      email: "",
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          customerSchema.parse(value)
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
            firstName: value.firstName.trim(),
            middleName: value.middleName?.trim() || null,
            lastName: value.lastName.trim(),
            type: value.type || "CUSTOMER",
            email: value.email?.trim() || null,
          }

          const result: any = isUpdate
            ? await updateCustomer({
                variables: {
                  id: _id,
                  input: payload,
                },
              })
            : await createCustomer({
                variables: {
                  input: payload,
                },
              })

          if (
            result.data.createCustomer?.ok ||
            result.data.updateCustomer?.ok
          ) {
            setOpen(false)
            toast.success(
              result.data.createCustomer?.message ||
                result.data.updateCustomer?.message
            )
            if (result.data.createCustomer?.ok)
              onCreated?.(result.data.createCustomer.data?.node)
            form.reset()
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        }
      }),
  })

  useEffect(() => {
    if (data?.customer) {
      form.setFieldValue("firstName", data.customer.firstName || "")
      form.setFieldValue("middleName", data.customer.middleName || "")
      form.setFieldValue("lastName", data.customer.lastName || "")
      form.setFieldValue("type", data.customer.type || "CUSTOMER")
      form.setFieldValue("email", data.customer.email || "")
    }
  }, [data, form])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <SheetTrigger asChild>
          {trigger ??
            (isUpdate ? (
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Edit
              </DropdownMenuItem>
            ) : (
              <Button className="cursor-pointer rounded-[10px]">
                Create Customer
              </Button>
            ))}
        </SheetTrigger>
      )}
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Customer Form</SheetTitle>
          <SheetDescription>
            Make changes to your customer here. Click save when you&apos;re
            done.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <form
            id="customer-form"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldSet>
              {(
                [
                  ["firstName", "First Name", true],
                  ["middleName", "Middle Name", false],
                  ["lastName", "Last Name", true],
                ] as const
              ).map(([name, label, required]) => (
                <form.Field key={name} name={name}>
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          {label}
                          {!required && (
                            <span className="text-muted-foreground">
                              {" "}
                              (optional)
                            </span>
                          )}
                        </FieldLabel>
                        <InputGroup className="-my-1">
                          <InputGroupInput
                            placeholder={label}
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
              ))}
              <form.Field name="type">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Type</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                      disabled={isPending}
                    >
                      <SelectTrigger id={field.name} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUSTOMER">Customer</SelectItem>
                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
              {/* Derived, never typed - mirrors what the server builds so the
                  user can see the name that will appear on receipts. */}
              <form.Subscribe
                selector={(state) =>
                  [state.values.firstName, state.values.lastName] as const
                }
              >
                {([firstName, lastName]) => (
                  <Field>
                    <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
                    <InputGroup className="-my-1">
                      <InputGroupInput
                        id="displayName"
                        readOnly
                        tabIndex={-1}
                        className="text-muted-foreground"
                        placeholder="From first and last name"
                        value={[firstName, lastName]
                          .map((p) => (p || "").trim())
                          .filter(Boolean)
                          .join(" ")}
                      />
                    </InputGroup>
                  </Field>
                )}
              </form.Subscribe>
              <form.Field name="email">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Email"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          type="email"
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
        <SheetFooter>
          <Button type="submit" form="customer-form" disabled={isPending}>
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
