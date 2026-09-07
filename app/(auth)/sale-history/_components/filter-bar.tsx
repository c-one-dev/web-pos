"use client"

import { useMemo, useState } from "react"
import gql from "graphql-tag"
import { useQuery } from "@apollo/client/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CaretDownIcon, CaretUpIcon, XIcon } from "@phosphor-icons/react"

/**
 * The filter bar above Sale History.
 *
 * The table's own column filters stay where they are - they answer "find this
 * sale". These answer "show me this slice of trading": one outlet, one till,
 * one cashier, one payment method, sales over or under an amount. They are
 * collapsed by default so the page still opens on the list rather than on a
 * wall of dropdowns.
 */

export type SaleHistoryFilters = {
  register?: string
  outlet?: string
  by?: string
  method?: string
  totalOperator?: string
  totalValue?: number
  includeImported: boolean
}

// Order value is asked as a comparison - "over 5,000", "exactly 100" - so the
// filter takes an operator and one amount rather than a from/to pair.
const TOTAL_OPERATORS: Option[] = [
  { value: "<", label: "< (Less than)" },
  { value: "<=", label: "<= (Less than or equal to)" },
  { value: ">", label: "> (Greater than)" },
  { value: ">=", label: ">= (Greater than or equal to)" },
  { value: "=", label: "= (Equal)" },
]

export const emptyFilters: SaleHistoryFilters = { includeImported: true }

const GET_FILTER_OPTIONS = gql`
  query SaleHistoryFilterOptions {
    outletOptions {
      label
      value
    }
    registerOptions {
      label
      value
    }
    paymentMethodOptions {
      label
      value
    }
    activeUsers {
      _id
      fullName
    }
  }
`

// "All" rather than an empty string: a Select item cannot carry an empty
// value, and the placeholder alone would leave no way back to unfiltered.
const ALL = "__all__"

type Option = { label: string; value: string }

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value?: string
  options: Option[]
  onChange: (value?: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value ?? ALL}
        onValueChange={(next) => onChange(next === ALL ? undefined : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function SaleHistoryFilterBar({
  filters,
  onChange,
}: {
  filters: SaleHistoryFilters
  onChange: (next: SaleHistoryFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const { data }: any = useQuery(GET_FILTER_OPTIONS, {
    fetchPolicy: "cache-first",
  })

  const outlets: Option[] = data?.outletOptions ?? []
  const registers: Option[] = data?.registerOptions ?? []
  const methods: Option[] = data?.paymentMethodOptions ?? []
  const users: Option[] = useMemo(
    () =>
      (data?.activeUsers ?? []).map((user: any) => ({
        label: user.fullName,
        value: user._id,
      })),
    [data]
  )

  const set = (patch: Partial<SaleHistoryFilters>) =>
    onChange({ ...filters, ...patch })

  const nameOf = (options: Option[], value?: string) =>
    options.find((option) => option.value === value)?.label ?? value

  // One chip per applied filter, so what is narrowing the list stays visible
  // after the panel is collapsed again.
  const chips: { label: string; clear: () => void }[] = []
  if (filters.outlet)
    chips.push({
      label: `Outlet: ${nameOf(outlets, filters.outlet)}`,
      clear: () => set({ outlet: undefined }),
    })
  if (filters.register)
    chips.push({
      label: `Register: ${nameOf(registers, filters.register)}`,
      clear: () => set({ register: undefined }),
    })
  if (filters.by)
    chips.push({
      label: `Processed by: ${nameOf(users, filters.by)}`,
      clear: () => set({ by: undefined }),
    })
  if (filters.method)
    chips.push({
      label: `Payment: ${nameOf(methods, filters.method)}`,
      clear: () => set({ method: undefined }),
    })
  // Only once both halves are filled in - an operator with no amount filters
  // nothing, so it should not look as though it does.
  if (filters.totalOperator && filters.totalValue !== undefined)
    chips.push({
      label: `Order value ${filters.totalOperator} ${filters.totalValue}`,
      clear: () => set({ totalOperator: undefined, totalValue: undefined }),
    })
  if (!filters.includeImported)
    chips.push({
      label: "Carried-over hidden",
      clear: () => set({ includeImported: true }),
    })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((previous) => !previous)}
        >
          {open ? <CaretUpIcon /> : <CaretDownIcon />}
          {open ? "Less filters" : "More filters"}
          {!open && chips.length > 0 ? ` (${chips.length})` : ""}
        </Button>
        {chips.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(emptyFilters)}
          >
            Clear all
          </Button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Outlet"
            value={filters.outlet}
            options={outlets}
            onChange={(value) => set({ outlet: value })}
          />
          <FilterSelect
            label="Register"
            value={filters.register}
            options={registers}
            onChange={(value) => set({ register: value })}
          />
          <FilterSelect
            label="Processed by"
            value={filters.by}
            options={users}
            onChange={(value) => set({ by: value })}
          />
          <FilterSelect
            label="Payment method"
            value={filters.method}
            options={methods}
            onChange={(value) => set({ method: value })}
          />
          <FilterSelect
            label="Order value"
            value={filters.totalOperator}
            options={TOTAL_OPERATORS}
            onChange={(value) =>
              set({
                totalOperator: value,
                // Dropping the operator drops the amount with it, or the chip
                // would claim a filter that is no longer being applied.
                totalValue: value ? filters.totalValue : undefined,
              })
            }
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Amount</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Any"
              disabled={!filters.totalOperator}
              value={filters.totalValue ?? ""}
              onChange={(event) =>
                set({
                  totalValue: event.currentTarget.value
                    ? Number(event.currentTarget.value)
                    : undefined,
                })
              }
            />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Checkbox
              id="include-imported"
              checked={filters.includeImported}
              onCheckedChange={(checked) =>
                set({ includeImported: checked !== false })
              }
            />
            <Label htmlFor="include-imported" className="text-sm font-normal">
              Include receipts carried over from the previous POS
            </Label>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Badge
              key={chip.label}
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={chip.clear}
            >
              {chip.label}
              <XIcon />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
