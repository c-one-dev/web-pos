import { Button } from "@/components/ui/button"
import ShortcutHint from "./shortcut-hint"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { IOption } from "@/types/shared.type"
import { gql } from "@apollo/client"
import { useQuery } from "@apollo/client/react"
import { CaretDownIcon, CheckIcon, PlusCircleIcon } from "@phosphor-icons/react"
import React, { useState } from "react"
import CustomerFormDialog from "@/app/(auth)/customer/_dialogs/form"

const GET_CUSTOMER_OPTIONS = gql`
  query CustomerOptions {
    customerOptions {
      label
      value
    }
  }
`

function AddCustomer({
  form,
  open,
  onOpenChange,
}: {
  form: any
  // Optional controlled mode so the register page can open this picker from
  // the F2 shortcut. Uncontrolled by default.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { data: customerOptionsData, loading } = useQuery(
    GET_CUSTOMER_OPTIONS,
    {
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "network-only",
    }
  )
  const customerOptions = (customerOptionsData as any)?.customerOptions
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(false)
  const openCustomerCommand = open ?? uncontrolledOpen
  const setOpenCustomerCommand = (next: boolean) => {
    if (open !== undefined) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }
  const [openCreateCustomer, setOpenCreateCustomer] = useState<boolean>(false)

  return (
    <div>
      <form.Field name="customer">
        {(field: any) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={isInvalid}>
              <Popover
                open={openCustomerCommand}
                onOpenChange={setOpenCustomerCommand}
              >
                <PopoverTrigger asChild>
                  <ButtonGroup className="w-full">
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCustomerCommand}
                      className={cn(
                        "flex flex-1 items-center justify-center bg-transparent text-muted-foreground capitalize",
                        field.state.value &&
                          "justify-start rounded-tr-none rounded-br-none text-black"
                      )}
                      type="button"
                    >
                      {field.state.value ? (
                        customerOptions?.find(
                          (o: IOption) =>
                            o.value === field.state.value?.toString()
                        )?.label
                      ) : (
                        <>
                          <PlusCircleIcon /> Add Customer
                          <ShortcutHint
                            keys="F2"
                            className="ml-1 h-6 min-w-8 px-1.5 text-xs font-semibold"
                          />
                        </>
                      )}
                    </Button>
                  </ButtonGroup>
                </PopoverTrigger>
                <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                  <Command>
                    <CommandInput placeholder={`Filter ${field.name}`} />
                    <CommandList>
                      <CommandEmpty>No option/s found.</CommandEmpty>
                      <CommandGroup>
                        {customerOptions?.map((o: IOption) => (
                          <CommandItem
                            key={o.value}
                            // cmdk matches the typed query against `value`, so
                            // it has to be the name - an ObjectId never
                            // matches what the cashier types.
                            value={o.label}
                            className="cursor-pointer"
                            onSelect={() => {
                              if (o.value === field.state.value?.toString())
                                field.setValue("")
                              else field.setValue(o.value.toString())
                              setOpenCustomerCommand(false)
                            }}
                          >
                            <span className="block">{o.label}</span>
                            {field.state.value?.toString() === o.value && (
                              <CheckIcon className="block" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                    <div className="border-t p-1">
                      <Button
                        variant="ghost"
                        type="button"
                        className="w-full justify-start font-normal"
                        onClick={() => {
                          setOpenCustomerCommand(false)
                          setOpenCreateCustomer(true)
                        }}
                      >
                        <PlusCircleIcon /> Create Customer
                      </Button>
                    </div>
                  </Command>
                </PopoverContent>
              </Popover>
              {/* Sibling of the popover, not a child - see the controlled
                  open note in the customer form dialog. */}
              <CustomerFormDialog
                open={openCreateCustomer}
                onOpenChange={setOpenCreateCustomer}
                onCreated={(customer) => {
                  // Select the customer that was just created so the cashier
                  // can carry straight on to payment.
                  if (customer?._id) field.setValue(customer._id.toString())
                }}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      </form.Field>
    </div>
  )
}

export default AddCustomer
