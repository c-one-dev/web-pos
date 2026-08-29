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
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
      cost
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

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

// One combobox for all three pickers. They were three near-identical 50-line
// blocks, so a styling fix had to be made three times and drifted between them.
function OptionCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  invalid,
  disabled,
  multiple = false,
}: {
  options: IOption[]
  value: string | string[]
  onChange: (next: string | string[]) => void
  placeholder: string
  searchPlaceholder: string
  invalid?: boolean
  disabled?: boolean
  multiple?: boolean
}) {
  const [open, setOpen] = useState(false)

  const selectedValues = multiple
    ? (value as string[])
    : value
      ? [value as string]
      : []
  const selected = options.filter((option) =>
    selectedValues.includes(option.value)
  )
  // An empty multi-select is `[]`, which is truthy - the old check showed
  // "0 selected" where the placeholder belonged.
  const hasValue = selectedValues.length > 0
  const label = !hasValue
    ? placeholder
    : multiple
      ? `${selected.length} selected`
      : (selected[0]?.label ?? placeholder)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !hasValue && "text-muted-foreground",
            invalid && "border-destructive"
          )}
        >
          <span className="truncate">{label}</span>
          <CaretDownIcon className="shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No option/s found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const active = selectedValues.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    // Items are keyed by ObjectId, so without this the search
                    // box filters against ids and never matches what's typed.
                    keywords={[option.label]}
                    onSelect={(next) => {
                      if (multiple) {
                        const list = value as string[]
                        onChange(
                          active
                            ? list.filter((item) => item !== next)
                            : [...list, next]
                        )
                        return
                      }
                      onChange(active ? "" : next.trim())
                      setOpen(false)
                    }}
                  >
                    <span className="flex-1">{option.label}</span>
                    {active && <CheckIcon className="shrink-0" />}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function FormDialog({ _id, onClose }: Props) {
  const isUpdate = Boolean(_id)
  const [open, setOpen] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  const [createProduct] = useMutation(CREATE_PRODUCT, {
    // A new row changes `total` / `pages`, which only the server can
    // recompute - patching edges into the cache would leave the table
    // paginating against a stale count.
    refetchQueries: ["ProductTable"],
    awaitRefetchQueries: true,
  })
  const [updateProduct] = useMutation(UPDATE_PRODUCT, {
    updateQueries: {
      ProductTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.updateProduct.ok) return prev
        const updatedProduct = mutationResult.data.updateProduct.data
        const updatedEdges = prev.productTable.edges.map((edge: any) =>
          edge.node._id === updatedProduct._id
            ? { ...edge, node: { ...edge.node, ...updatedProduct } }
            : edge
        )
        return {
          ...prev,
          productTable: {
            ...prev.productTable,
            edges: updatedEdges,
          },
        }
      },
    },
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

  const form = useForm({
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      description: "",
      currentPrice: 0,
      cost: 0,
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
            cost: value.cost,
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
      form.setFieldValue("cost", data.product.cost || 0)
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
      {/* Matches the side variant, otherwise the base
          data-[side=right]:sm:max-w-sm keeps winning. */}
      <SheetContent className="data-[side=right]:sm:max-w-md">
        <SheetHeader className="shrink-0 gap-1 border-b p-4">
          <SheetTitle>{isUpdate ? "Edit product" : "New product"}</SheetTitle>
          <SheetDescription>
            {isUpdate
              ? "Update this product's details, price and where it can be sold."
              : "Add a product to the catalogue and choose where it can be sold."}
          </SheetDescription>
        </SheetHeader>

        {/* min-h-0 is what lets this scroll instead of pushing the footer -
            and its buttons - off the bottom of the sheet. */}
        <form
          id="product-form"
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <Section title="Details">
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        placeholder="Assorted Hairclips"
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

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="sku">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>SKU</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          placeholder="1002365"
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
                      <InputGroup>
                        <InputGroupInput
                          placeholder="Scan or type"
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
            </div>

            <form.Field name="description">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                    <InputGroup>
                      <InputGroupTextarea
                        placeholder="Optional notes about this product"
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
          </Section>

          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <form.Field name="currentPrice">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Price</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>₱</InputGroupAddon>
                        <InputGroupInput
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

              <form.Field name="cost">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Cost</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>₱</InputGroupAddon>
                        <InputGroupInput
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
            </div>
            <FieldDescription>
              Cost is the purchase price per unit, used by the Cost of Goods
              Sold report. Leave at 0 if unknown.
            </FieldDescription>
          </Section>

          <Section title="Classification">
            <form.Field name="type">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Type</FieldLabel>
                    <OptionCombobox
                      options={productTypeOptions}
                      value={field.state.value}
                      onChange={(next) => field.setValue(next as string)}
                      placeholder="Select type"
                      searchPlaceholder="Filter types"
                      invalid={isInvalid}
                      disabled={isPending}
                    />
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
                    <OptionCombobox
                      options={brandOptions}
                      value={field.state.value}
                      onChange={(next) => field.setValue(next as string)}
                      placeholder="Select brand"
                      searchPlaceholder="Filter brands"
                      invalid={isInvalid}
                      disabled={isPending}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </Section>

          <Section title="Availability">
            <form.Field name="registers">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                const selected = registerOptions.filter((option: IOption) =>
                  field.state.value.includes(option.value)
                )
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Registers</FieldLabel>
                    <OptionCombobox
                      multiple
                      options={registerOptions}
                      value={field.state.value}
                      onChange={(next) => field.setValue(next as string[])}
                      placeholder="Select registers"
                      searchPlaceholder="Filter registers"
                      invalid={isInvalid}
                      disabled={isPending}
                    />
                    {selected.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selected.map((option: IOption) => (
                          <Badge
                            key={option.value}
                            variant="secondary"
                            className="font-normal"
                          >
                            {option.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </Section>
        </form>

        <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t p-4">
          <SheetClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form="product-form" disabled={isPending}>
            {isPending
              ? "Saving..."
              : isUpdate
                ? "Save changes"
                : "Create product"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
