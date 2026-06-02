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
import { outletSchema } from "@/validators/outlet.validator"
import { toast } from "sonner"
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

const CREATE_OUTLET = gql`
  mutation CreateOutlet($input: OutletInput!) {
    createOutlet(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_OUTLET = gql`
  mutation UpdateOutlet($id: ID!, $input: OutletInput!) {
    updateOutlet(_id: $id, input: $input) {
      ok
      message
      data
    }
  }
`

const FETCH_OUTLET = gql`
  query Outlet($_id: ID!) {
    outlet(_id: $_id) {
      _id
      name
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
  const [createOutlet] = useMutation(CREATE_OUTLET, {
    updateQueries: {
      OutletTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.createOutlet.ok) return prev
        const newOutlet = mutationResult.data.createOutlet.data
        return {
          ...prev,
          outletTable: {
            ...prev.outletTable,
            edges: [
              ...prev.outletTable.edges,
              {
                node: newOutlet.node,
                cursor: newOutlet.cursor,
                __typename: "OutletEdge",
              },
            ],
          },
        }
      },
    },
  })
  const [updateOutlet] = useMutation(UPDATE_OUTLET, {
    updateQueries: {
      OutletTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.updateOutlet.ok) return prev
        const updatedOutlet = mutationResult.data.updateOutlet.data
        const updatedEdges = prev.outletTable.edges.map((edge: any) =>
          edge.node._id === updatedOutlet._id
            ? { ...edge, node: { ...edge.node, ...updatedOutlet } }
            : edge
        )
        return {
          ...prev,
          outletTable: {
            ...prev.outletTable,
            edges: updatedEdges,
          },
        }
      },
    },
  })
  const { data }: any = useQuery(FETCH_OUTLET, {
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
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          outletSchema.parse(value)
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
          }

          const result: any = isUpdate
            ? await updateOutlet({
                variables: {
                  id: _id,
                  input: payload,
                },
              })
            : await createOutlet({
                variables: {
                  input: payload,
                },
              })

          if (result.data.createOutlet?.ok || result.data.updateOutlet?.ok) {
            setOpen(false)
            toast.success(
              result.data.createOutlet?.message ||
                result.data.updateOutlet?.message
            )
            form.reset()
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        }
      }),
  })

  useEffect(() => {
    if (data?.outlet) {
      form.setFieldValue("name", data.outlet.name)
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
          <Button>Create Outlet</Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Outlet Form</SheetTitle>
          <SheetDescription>
            Make changes to your outlet here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <form
            id="outlet-form"
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
            </FieldSet>
          </form>
        </div>
        <SheetFooter>
          <Button type="submit" form="outlet-form" disabled={isPending}>
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
