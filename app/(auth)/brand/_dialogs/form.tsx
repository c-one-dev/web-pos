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
import { brandSchema } from "@/validators/brand.validator"
import { toast } from "sonner"
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

const CREATE_BRAND = gql`
  mutation CreateBrand($input: BrandInput!) {
    createBrand(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_BRAND = gql`
  mutation UpdateBrand($id: ID!, $input: BrandInput!) {
    updateBrand(_id: $id, input: $input) {
      ok
      message
      data
    }
  }
`

const FETCH_BRAND = gql`
  query Brand($_id: ID!) {
    brand(_id: $_id) {
      _id
      name
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
  const [createBrand] = useMutation(CREATE_BRAND, {
    update: (cache, { data }: any) => {
      const newBrand = data.createBrand.data
      const newEdge = {
        __typename: "BrandEdge",
        cursor: newBrand._id,
        node: newBrand,
      }
      cache.modify({
        fields: {
          brandTable(existing = {}) {
            const edges = existing.edges || []
            const exists = edges.some((e: any) => e.node._id === newBrand._id)
            if (exists) return existing
            return {
              ...existing,
              edges: [newEdge, ...edges],
              total: (existing.total || 0) + 1,
            }
          },
        },
      })
    },
  })
  const [updateBrand] = useMutation(UPDATE_BRAND, {
    refetchQueries: ["BrandTable"],
    awaitRefetchQueries: true,
  })
  const { data }: any = useQuery(FETCH_BRAND, {
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
          brandSchema.parse(value)
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
            ? await updateBrand({
                variables: {
                  id: _id,
                  input: payload,
                },
              })
            : await createBrand({
                variables: {
                  input: payload,
                },
              })

          if (result.data.createBrand?.ok || result.data.updateBrand?.ok) {
            setOpen(false)
            toast.success(
              result.data.createBrand?.message ||
                result.data.updateBrand?.message
            )
            form.reset()
          }
        } catch (error: any) {
         console.error(error)
        }
      }),
  })

  useEffect(() => {
    if (data?.brand) {
      form.setFieldValue("name", data.brand.name)
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
          <Button>Create Brand</Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Brand Form</SheetTitle>
          <SheetDescription>
            Make changes to your brand here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <form
            id="brand-form"
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
          <Button type="submit" form="brand-form" disabled={isPending}>
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
