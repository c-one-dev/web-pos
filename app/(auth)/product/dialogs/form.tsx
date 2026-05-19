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
import { productSchema } from "@/validators/product.validator"
import { toast } from "sonner"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ButtonGroup } from "@/components/ui/button-group"
import { cn } from "@/lib/utils"
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

const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: ProductInput!) {
    createProduct(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($id: ID!, $input: ProductInput!) {
    updateProduct(_id: $id, input: $input) {
      ok
      message
      data
    }
  }
`

const FETCH_PRODUCT = gql`
  query Product($_id: ID!) {
    product(_id: $_id) {
      _id
      name
      image
      sku
      name
      barcode
      description
      type {
        _id
        name
      }
      brand {
        _id
        name
      }
      registers {
        _id
        name
      }
      currentPrice
    }
  }
`

const FETCH_OPTIONS = gql`
  query Options {
    productTypeOptions {
      label
      value
    }
    brandOptions {
      label
      value
    }
    registerOptions {
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
  const [createProduct] = useMutation(CREATE_PRODUCT, {
    refetchQueries: ["ProcessedRegister", "ProductTable"],
    awaitRefetchQueries: true,
  })
  const [updateProduct] = useMutation(UPDATE_PRODUCT, {
    refetchQueries: ["ProcessedRegister", "ProductTable"],
    awaitRefetchQueries: true,
  })
  const { data }: any = useQuery(FETCH_PRODUCT, {
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
  const productTypeOptions = optionsData?.productTypeOptions || []
  const brandOptions = optionsData?.brandOptions || []
  const registerOptions = optionsData?.registerOptions || []
  const [openProductTypeCommand, setOpenProductTypeCommand] = useState(false)
  const [openBrandCommand, setOpenBrandCommand] = useState(false)
  const [openRegisterCommand, setOpenRegisterCommand] = useState(false)

  const form = useForm({
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      description: "",
      currentPrice: 0,
      type: "",
      brand: "",
      registers: [] as any[],
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          productSchema.parse(value)
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
            sku: value.sku,
            barcode: value.barcode,
            description: value.description,
            currentPrice: value.currentPrice,
            type: value.type || null,
            brand: value.brand || null,
            registers: value.registers || [],
          }

          const result: any = isUpdate
            ? await updateProduct({
                variables: {
                  id: _id,
                  input: payload,
                },
              })
            : await createProduct({
                variables: {
                  input: payload,
                },
              })

          if (result.data.createProduct?.ok || result.data.updateProduct?.ok) {
            setOpen(false)
            toast.success(
              result.data.createProduct?.message ||
                result.data.updateProduct?.message
            )
            form.reset()
          }
        } catch (error: any) {
          console.error(JSON.stringify(error, null, 2))
        }
      }),
  })

  useEffect(() => {
    if (data?.product) {
      form.setFieldValue("name", data.product.name)
      form.setFieldValue("sku", data.product.sku)
      form.setFieldValue("barcode", data.product.barcode)
      form.setFieldValue("description", data.product.description)
      form.setFieldValue("currentPrice", data.product.currentPrice)
      form.setFieldValue("type", data.product.type?._id || "")
      form.setFieldValue("brand", data.product.brand?._id || "")
      form.setFieldValue(
        "registers",
        data.product.registers
          ? data.product.registers.map((register: any) => register._id)
          : []
      )
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
          <Button>Create Product</Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Product Form</SheetTitle>
          <SheetDescription>
            Make changes to your product here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <form
            id="product-form"
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
              <form.Field name="sku">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>SKU</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="SKU"
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
              <form.Field name="barcode">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Barcode</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Barcode"
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
              <form.Field name="currentPrice">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Current Price
                      </FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupAddon>₱</InputGroupAddon>
                        <InputGroupInput
                          placeholder="Current Price"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(parseFloat(e.target.value))
                          }
                          aria-invalid={isInvalid}
                          type="number"
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
                          placeholder="Description"
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
                      <FieldLabel htmlFor={field.name}>Type</FieldLabel>
                      <Popover
                        open={openProductTypeCommand}
                        onOpenChange={setOpenProductTypeCommand}
                      >
                        <PopoverTrigger asChild>
                          <ButtonGroup className="w-full">
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openProductTypeCommand}
                              className={cn(
                                field.state.value &&
                                  "rounded-tr-none rounded-br-none",
                                isInvalid && "border-destructive",
                                "flex-1 justify-between bg-transparent text-black/80 capitalize"
                              )}
                              type="button"
                            >
                              {field.state.value
                                ? productTypeOptions?.find(
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
                                {productTypeOptions?.map((o: IOption) => (
                                  <CommandItem
                                    key={o.value}
                                    value={o.value}
                                    onSelect={(val) => {
                                      if (val === field.state.value)
                                        field.setValue("")
                                      else {
                                        field.setValue(val.trim())
                                      }
                                      setOpenProductTypeCommand(false)
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
              <form.Field name="brand">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Brand</FieldLabel>
                      <Popover
                        open={openBrandCommand}
                        onOpenChange={setOpenBrandCommand}
                      >
                        <PopoverTrigger asChild>
                          <ButtonGroup className="w-full">
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openBrandCommand}
                              className={cn(
                                field.state.value &&
                                  "rounded-tr-none rounded-br-none",
                                isInvalid && "border-destructive",
                                "flex-1 justify-between bg-transparent text-black/80 capitalize"
                              )}
                              type="button"
                            >
                              {field.state.value
                                ? brandOptions?.find(
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
                                {brandOptions?.map((o: IOption) => (
                                  <CommandItem
                                    key={o.value}
                                    value={o.value}
                                    onSelect={(val) => {
                                      if (val === field.state.value)
                                        field.setValue("")
                                      else {
                                        field.setValue(val.trim())
                                      }
                                      setOpenBrandCommand(false)
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
              <form.Field name="registers">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Registers</FieldLabel>
                      <Popover
                        open={openRegisterCommand}
                        onOpenChange={setOpenRegisterCommand}
                      >
                        <PopoverTrigger asChild>
                          <ButtonGroup className="w-full">
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openRegisterCommand}
                              className={cn(
                                field.state.value &&
                                  "rounded-tr-none rounded-br-none",
                                isInvalid && "border-destructive",
                                "flex-1 justify-between bg-transparent text-black/80 capitalize"
                              )}
                              type="button"
                            >
                              {field.state.value
                                ? `${field.state.value.length} selected`
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
                                {registerOptions?.map((o: IOption) => (
                                  <CommandItem
                                    key={o.value}
                                    value={o.value}
                                    onSelect={(val) => {
                                      if (field.state.value.includes(val)) {
                                        field.setValue(
                                          field.state.value.filter(
                                            (v: string) => v !== val
                                          )
                                        )
                                      } else {
                                        field.setValue([
                                          ...field.state.value,
                                          val,
                                        ])
                                      }
                                    }}
                                  >
                                    <span className="block">{o.label}</span>
                                    {field.state.value.includes(o.value) && (
                                      <CheckIcon className="block" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {field.state.value.length > 0 && (
                        <FieldDescription className="mt-1 block text-sm text-muted-foreground">
                          Selected:{" "}
                          <span className="font-medium">
                            {registerOptions
                              .filter((o: IOption) =>
                                field.state.value.includes(o.value)
                              )
                              .map((o: IOption) => o.label)
                              .join(", ")}
                          </span>
                        </FieldDescription>
                      )}
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
          <Button type="submit" form="product-form" disabled={isPending}>
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
