import { Button } from "@/components/ui/button"
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

const GET_CUSTOMER_OPTIONS = gql`
  query CustomerOptions {
    customerOptions {
      label
      value
    }
  }
`

function AddCustomer({ form }: { form: any }) {
  const { data: customerOptionsData, loading } = useQuery(
    GET_CUSTOMER_OPTIONS,
    {
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "network-only",
    }
  )
  const customerOptions = (customerOptionsData as any)?.customerOptions
  const [openCustomerCommand, setOpenCustomerCommand] = useState<boolean>(false)

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
                        </>
                      )}
                    </Button>
                  </ButtonGroup>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder={`Filter ${field.name}`} />
                    <CommandList>
                      <CommandEmpty>No option/s found.</CommandEmpty>
                      <CommandGroup>
                        {customerOptions?.map((o: IOption) => (
                          <CommandItem
                            key={o.value}
                            value={o.value}
                            onSelect={(val) => {
                              if (val === field.state.value) field.setValue("")
                              else {
                                field.setValue(val.trim())
                              }
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
                  </Command>
                </PopoverContent>
              </Popover>
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      </form.Field>
    </div>
  )
}

export default AddCustomer
