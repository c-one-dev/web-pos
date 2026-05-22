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
import { productTypeSchema } from "@/validators/productType.validator"
import { toast } from "sonner"
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ButtonGroup } from "@/components/ui/button-group"
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

const CREATE_PRODUCT_TYPE = gql`
  mutation CreateProductType($input: ProductTypeInput!) {
    createProductType(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_PRODUCT_TYPE = gql`
  mutation UpdateProductType($id: ID!, $input: ProductTypeInput!) {
    updateProductType(_id: $id, input: $input) {
      ok
      message
      data
    }
  }
`

const FETCH_PRODUCT_TYPE = gql`
  query ProductType($_id: ID!) {
    productType(_id: $_id) {
      _id
      name
      parent {
        _id
      }
    }
  }
`

const FETCH_OPTIONS = gql`
  query ProductTypeOptions {
    productTypeOptions {
      label
      value
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
  const [createProductType] = useMutation(CREATE_PRODUCT_TYPE, {
    // refetchQueries: ["ProcessedRegister"],
    // awaitRefetchQueries: true,
    updateQueries: {
      ProductTypeTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.createProductType.ok) return prev
        const newProductType = mutationResult.data.createProductType.data
        return {
          ...prev,
          productTypeTable: {
            ...prev.productTypeTable,
            edges: [
              ...prev.productTypeTable.edges,
              {
                node: newProductType.node,
                cursor: newProductType.cursor,
                __typename: "ProductTypeEdge",
              },
            ],
          },
        }
      },
    },
  })
  const [updateProductType] = useMutation(UPDATE_PRODUCT_TYPE, {
    // refetchQueries: ["ProcessedRegister"],
    // awaitRefetchQueries: true,
    updateQueries: {
      ProductTypeTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.updateProductType.ok) return prev
        const updatedProductType = mutationResult.data.updateProductType.data
        const updatedEdges = prev.productTypeTable.edges.map((edge: any) =>
          edge.node._id === updatedProductType._id
            ? { ...edge, node: { ...edge.node, ...updatedProductType } }
            : edge
        )
        return {
          ...prev,
          productTypeTable: {
            ...prev.productTypeTable,
            edges: updatedEdges,
          },
        }
      },
    },
  })
  const { data }: any = useQuery(FETCH_PRODUCT_TYPE, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    skip: !isUpdate || !open,
  })
  const { data: optionsData }: any = useQuery(FETCH_OPTIONS, {
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    skip: !open,
  })
  const options = optionsData?.productTypeOptions || []
  const [openCommand, setOpenCommand] = useState(false)

  const form = useForm({
    defaultValues: {
      name: "",
      parent: "",
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          productTypeSchema.parse(value)
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
            parent: !!value.parent ? value.parent : null,
          }
          const result: any = isUpdate
            ? await updateProductType({
                variables: {
                  id: _id,
                  input: payload,
                },
              })
            : await createProductType({
                variables: {
                  input: payload,
                },
              })

          if (
            result.data.createProductType?.ok ||
            result.data.updateProductType?.ok
          ) {
            setOpen(false)
            toast.success(
              result.data.createProductType?.message ||
                result.data.updateProductType?.message
            )
            onClose?.()
            form.reset()
          }
        } catch (error: any) {
          console.error(error)
          throw error
        }
      }),
  })

  useEffect(() => {
    if (data?.productType) {
      form.setFieldValue("name", data.productType.name)
      form.setFieldValue("parent", data.productType.parent?._id || "")
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
          <Button>Create Product Type</Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Product Type Form</SheetTitle>
          <SheetDescription>
            Make changes to your product type here. Click save when you&apos;re
            done.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <form
            id="product-type-form"
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
              <form.Field name="parent">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Parent</FieldLabel>
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
          <Button type="submit" form="product-type-form" disabled={isPending}>
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
