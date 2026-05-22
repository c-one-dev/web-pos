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
      name
      email
    }
  }
`

type Props = {
  _id?: string
  onClose?: () => void
}

export default function FormDialog({ _id, onClose }: Props) {
  const isUpdate = Boolean(_id)
  const [open, setOpen] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  const [createCustomer] = useMutation(CREATE_CUSTOMER, {
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
      name: "",
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
            name: value.name,
            email: value.email,
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
            form.reset()
          }
        } catch (error: any) {
          console.error(error)
        }
      }),
  })

  useEffect(() => {
    if (data?.customer) {
      form.setFieldValue("name", data.customer.name)
      form.setFieldValue("email", data.customer.email || "")
    }
  }, [data])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {isUpdate ? (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Edit
          </DropdownMenuItem>
        ) : (
          <Button>Create Customer</Button>
        )}
      </SheetTrigger>
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
