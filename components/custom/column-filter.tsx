"use client"
import { Filter, FilterType } from "@/types/shared.type"
import { useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group"
import { Check, CheckIcon, EraserIcon } from "@phosphor-icons/react"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { Button } from "../ui/button"
import { cn } from "@/lib/utils"
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr"
import { ButtonGroup } from "../ui/button-group"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem,
} from "../ui/command"
import { Label } from "../ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"

type Props = {
  label: string
  filterKey: string
  filterType: FilterType
  filter: Filter[]
  onFilterChange: (value: any) => void
  options?: { label: string; value: string }[] // For select filters
}

export default function ColumnFilter({
  label,
  filterKey,
  filterType,
  filter,
  onFilterChange,
  options = [],
}: Props) {
  const [filterValue, setFilterValue] = useState(
    filter.find((f) => f.key === filterKey)?.value || ""
  )
  // Select filter
  const [openCommand, setOpenCommand] = useState<boolean>(false)

  const clearFilter = () => {
    setFilterValue("")
    onFilterChange((prev: Filter[]) =>
      prev.filter((f: Filter) => f.key != filterKey)
    )
  }

  switch (filterType) {
    case FilterType.TEXT:
      return (
        <InputGroup>
          <InputGroupInput
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder={`Filter ${label}`}
            onKeyDown={(e) => {
              const trimmed = filterValue.trim()
              if (e.key === "Enter") {
                if (!trimmed) clearFilter()
                else
                  onFilterChange((prev: Filter[]) => [
                    ...prev.filter((f: Filter) => f.key != filterKey),
                    { key: filterKey, value: trimmed, type: FilterType.TEXT },
                  ])
              }
            }}
          />
          {filterValue && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={clearFilter}>
                <EraserIcon className="text-destructive" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      )
    case FilterType.NUMBER:
      return (
        <InputGroup>
          <InputGroupInput
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder={`Filter ${label}`}
            type="number"
            onKeyDown={(e) => {
              const trimmed = filterValue.trim()
              if (e.key === "Enter") {
                if (!trimmed) clearFilter()
                else
                  onFilterChange((prev: Filter[]) => [
                    ...prev.filter((f: Filter) => f.key != filterKey),
                    { key: filterKey, value: trimmed, type: FilterType.NUMBER },
                  ])
              }
            }}
          />
          {filterValue && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={clearFilter}>
                <EraserIcon className="text-destructive" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      )
    case FilterType.SELECT:
      return (
        <Popover open={openCommand} onOpenChange={setOpenCommand}>
          <PopoverTrigger asChild>
            <ButtonGroup className="w-full">
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCommand}
                className={cn(
                  filterValue && "rounded-tr-none rounded-br-none text-black",
                  "flex-1 justify-between bg-transparent text-muted-foreground capitalize hover:bg-transparent hover:text-muted-foreground"
                )}
              >
                {filter.some((f: any) => f.key === filterKey)
                  ? options?.find(
                      (o: { label: string; value: string }) =>
                        o.value === filterValue.toString()
                    )?.label
                  : `Filter ${label}`}
                <CaretDownIcon />
              </Button>
              {filterValue && (
                <Button
                  variant="outline"
                  onClick={clearFilter}
                  className="rounded-l-none"
                >
                  <EraserIcon className="text-destructive" />
                </Button>
              )}
            </ButtonGroup>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder={`Filter ${label}`} />
              <CommandList>
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup>
                  {options?.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={o.value}
                      onSelect={(val) => {
                        if (val === filterValue) clearFilter()
                        else {
                          setFilterValue(val.trim())
                          onFilterChange((prev: Filter[]) => [
                            ...prev.filter((f: Filter) => f.key != filterKey),
                            {
                              key: filterKey,
                              value: val.trim(),
                              type: FilterType.SELECT,
                            },
                          ])
                        }
                        setOpenCommand(false)
                      }}
                    >
                      <span className="block">{o.label}</span>
                      {filterValue.toString() === o.value && (
                        <CheckIcon className="block" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )
    case FilterType.BOOLEAN:
      return (
        <div className="flex">
          <Select
            value={filter.find((f: Filter) => f.key === filterKey)?.value || ""}
            onValueChange={(value) => {
              if (value)
                onFilterChange((prev: Filter[]) => [
                  ...prev.filter((f: Filter) => f.key != filterKey),
                  {
                    key: filterKey,
                    value,
                    type: FilterType.BOOLEAN,
                  },
                ])
              else clearFilter()
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Filter ${label}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
          {filterValue && (
            <Button
              variant="outline"
              onClick={clearFilter}
              className="rounded-l-none border-l-0"
            >
              <EraserIcon className="text-destructive" />
            </Button>
          )}
        </div>
      )
    default:
      return <span>Test</span>
  }
}
