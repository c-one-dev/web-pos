"use client"
import { Filter, FilterType } from "@/types/shared.type"
import { useEffect, useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group"
import { CalendarIcon, CheckIcon, EraserIcon } from "@phosphor-icons/react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { Calendar } from "../ui/calendar"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { formatDateRange } from "little-date"

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
  // Date filter
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  })

  useEffect(() => {
    if (filterType === "DATE" && filter.find((f: any) => f.key === filterKey)) {
      const [from, to] = filter
        .find((f: any) => f.key === filterKey)!
        .value.split("_")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDateRange({
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      })
    }
  }, [filterType, filterValue, filterKey, filter])

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
    case FilterType.DATE:
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              data-empty={!dateRange}
              className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
            >
              <CalendarIcon />
              {dateRange?.from && dateRange?.to ? (
                formatDateRange(dateRange.from, dateRange.to, {
                  includeTime: false,
                })
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 pt-4 px-1">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              required
              numberOfMonths={2}
            />
            <div className="flex justify-end px-4 pb-4">
              <ButtonGroup className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDateRange({ from: undefined, to: undefined })
                    onFilterChange((prev: Filter[]) =>
                      prev.filter((f: Filter) => f.key != filterKey)
                    )
                  }}
                >
                  Reset
                </Button>
                <Button
                  onClick={() => {
                    if (!dateRange?.from || !dateRange?.to) return
                    const dateRangeISO = `${dateRange.from.toISOString()}_${dateRange.to.toISOString()}`
                    onFilterChange((prev: Filter[]) => [
                      ...prev.filter((f: Filter) => f.key != filterKey),
                      {
                        key: filterKey,
                        value: dateRangeISO,
                        type: FilterType.DATE,
                      },
                    ])
                  }}
                >
                  Apply
                </Button>
              </ButtonGroup>
            </div>
          </PopoverContent>
        </Popover>
      )
    default:
      return <span>Test</span>
  }
}
