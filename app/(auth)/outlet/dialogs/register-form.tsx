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
import { registerSchema } from "@/validators/register.validator"
import { toast } from "sonner"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ButtonGroup } from "@/components/ui/button-group"
import { cn } from "@/lib/utils"
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Day, IOption } from "@/types/shared.type"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import timeOptions from "./timeOptions"

const CREATE_REGISTER = gql`
  mutation CreateRegister($input: RegisterInput!) {
    createRegister(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_REGISTER = gql`
  mutation UpdateRegister($id: ID!, $input: RegisterInput!) {
    updateRegister(_id: $id, input: $input) {
      ok
      message
      data
    }
  }
`

const FETCH_REGISTER_AND_OPTIONS = gql`
  query Register($_id: ID!) {
    register(_id: $_id) {
      _id
      name
      outlet {
        _id
      }
      prefix
      schedule {
        day
        openingTime
        closingTime
      }
      paymentMethods {
        _id
      }
    }
  }
`

const FETCH_OPTIONS = gql`
  query Options {
    outletOptions {
      label
      value
    }
    paymentMethodOptions {
      label
      value
    }
  }
`

type Props = {
  _id?: string
  onClose?: () => void
  outlet?: string
}

export default function RegisterFormDialog({ _id, outlet }: Props) {
  const isUpdate = Boolean(_id)
  const [open, setOpen] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  const [createRegister] = useMutation(CREATE_REGISTER, {
    refetchQueries: ["OutletTable"],
    awaitRefetchQueries: true,
  })
  const [updateRegister] = useMutation(UPDATE_REGISTER, {
    refetchQueries: "active",
    awaitRefetchQueries: true,
  })
  const { data }: any = useQuery(FETCH_REGISTER_AND_OPTIONS, {
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
  const outletOptions = optionsData?.outletOptions || []
  const paymentMethodOptions = optionsData?.paymentMethodOptions || []
  const [openOutletCommand, setOpenOutletCommand] = useState<boolean>(false)
  const [openPaymentMethodCommand, setOpenPaymentMethodCommand] =
    useState<boolean>(false)

  const form = useForm({
    defaultValues: {
      name: "",
      schedule: [] as any,
      paymentMethods: [] as any,
      prefix: "",
      outlet: outlet || "",
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          registerSchema.parse(value)
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
            outlet: value.outlet,
            prefix: value.prefix,
            schedule: value.schedule.map((s: any) => ({
              day: s.day,
              openingTime: s.openingTime,
              closingTime: s.closingTime,
            })),
            paymentMethods: value.paymentMethods || [],
          }

          const result: any = isUpdate
            ? await updateRegister({
                variables: {
                  id: _id,
                  input: payload,
                },
              })
            : await createRegister({
                variables: {
                  input: payload,
                },
              })

          if (
            result.data.createRegister?.ok ||
            result.data.updateRegister?.ok
          ) {
            setOpen(false)
            toast.success(
              result.data.createRegister?.message ||
                result.data.updateRegister?.message
            )
            form.reset()
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        }
      }),
  })

  useEffect(() => {
    if (data?.register) {
      form.setFieldValue("name", data.register.name)
      form.setFieldValue("prefix", data.register.prefix)
      form.setFieldValue("outlet", data.register.outlet._id)
      form.setFieldValue("schedule", data.register.schedule || [])
      form.setFieldValue(
        "paymentMethods",
        data.register.paymentMethods
          ? data.register.paymentMethods.map((method: any) => method._id)
          : []
      )
    }
  }, [data, form, outlet])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {isUpdate ? (
          <Button>Edit</Button>
        ) : (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Add Register
          </DropdownMenuItem>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Register Form</SheetTitle>
          <SheetDescription>
            Make changes to your register here. Click save when you&apos;re
            done.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <form
            id="register-form"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldSet>
              <form.Field name="outlet">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Outlet</FieldLabel>
                      <Popover
                        open={openOutletCommand}
                        onOpenChange={setOpenOutletCommand}
                      >
                        <PopoverTrigger
                          asChild
                          disabled={true}
                          className="pointer-events-none"
                        >
                          <ButtonGroup className="w-full">
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openOutletCommand}
                              className={cn(
                                field.state.value &&
                                  "rounded-tr-none rounded-br-none text-black",
                                "flex-1 justify-between bg-transparent text-muted-foreground capitalize hover:bg-transparent hover:text-muted-foreground"
                              )}
                              type="button"
                              disabled={true}
                            >
                              {field.state.value
                                ? outletOptions?.find(
                                    (o: IOption) =>
                                      o.value === field.state.value.toString()
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
                                {outletOptions?.map((o: IOption) => (
                                  <CommandItem
                                    key={o.value}
                                    value={o.value}
                                    onSelect={(val) => {
                                      if (val === field.state.value)
                                        field.setValue("")
                                      else {
                                        field.setValue(val.trim())
                                      }
                                      setOpenOutletCommand(false)
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
              <form.Field name="prefix">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Prefix</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="ex. REG"
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
              <form.Field name="schedule">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Schedule</FieldLabel>
                      <FieldContent className="flex flex-col gap-1.5">
                        <div className="grid grid-cols-3 gap-1.5">
                          <span className="block text-center font-medium">
                            Day
                          </span>
                          <span className="block text-center font-medium">
                            Opening
                          </span>
                          <span className="block text-center font-medium">
                            Closing
                          </span>
                        </div>
                        {Object.values(Day).map((day) => (
                          <div className="grid grid-cols-3 gap-1.5" key={day}>
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={
                                  !!field.state.value.find(
                                    (s: any) => s.day === day
                                  )
                                }
                                className={cn(
                                  (day === Day.SUNDAY ||
                                    day === Day.SATURDAY) &&
                                    "data-[state=checked]:bg-sky-700"
                                )}
                                onCheckedChange={(checked) => {
                                  if (checked)
                                    field.setValue((prev: any) => [
                                      ...prev,
                                      {
                                        day,
                                        openingTime: "",
                                        closingTime: "",
                                      },
                                    ])
                                  else
                                    field.setValue((prev: any) =>
                                      prev.filter((s: any) => s.day !== day)
                                    )
                                }}
                              />
                              <FieldLabel
                                className={cn(
                                  "capitalize",
                                  (day === Day.SUNDAY ||
                                    day === Day.SATURDAY) &&
                                    "text-sky-700"
                                )}
                              >
                                {day.toLocaleLowerCase()}
                              </FieldLabel>
                            </div>
                            <Select
                              onValueChange={(val) => {
                                field.setValue((prev: any) =>
                                  prev.map((s: any) =>
                                    s.day === day
                                      ? { ...s, openingTime: val }
                                      : s
                                  )
                                )
                              }}
                              value={
                                field.state.value.find(
                                  (s: any) => s.day === day
                                )?.openingTime || ""
                              }
                            >
                              <SelectTrigger
                                size="sm"
                                className="w-full"
                                disabled={
                                  !field.state.value.find(
                                    (s: any) => s.day === day
                                  )
                                }
                              >
                                <SelectValue placeholder="Time Slot" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {timeOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Select
                              onValueChange={(val) => {
                                field.setValue((prev: any) =>
                                  prev.map((s: any) =>
                                    s.day === day
                                      ? { ...s, closingTime: val }
                                      : s
                                  )
                                )
                              }}
                              value={
                                field.state.value.find(
                                  (s: any) => s.day === day
                                )?.closingTime || ""
                              }
                            >
                              <SelectTrigger
                                size="sm"
                                className="w-full"
                                disabled={
                                  !field.state.value.find(
                                    (s: any) => s.day === day
                                  )
                                }
                              >
                                <SelectValue placeholder="Time Slot" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {timeOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </FieldContent>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              </form.Field>
              <form.Field name="paymentMethods">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Payment Methods
                      </FieldLabel>
                      <Popover
                        open={openPaymentMethodCommand}
                        onOpenChange={setOpenPaymentMethodCommand}
                      >
                        <PopoverTrigger asChild>
                          <ButtonGroup className="w-full">
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openPaymentMethodCommand}
                              className={cn(
                                field.state.value &&
                                  "rounded-tr-none rounded-br-none",  isInvalid && "border-destructive",
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
                                {paymentMethodOptions?.map((o: IOption) => (
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
                            {paymentMethodOptions
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
          <Button type="submit" form="register-form" disabled={isPending}>
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
