import { Sort } from "@/types/shared.type"
import { Button } from "../ui/button"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretUpDownIcon,
} from "@phosphor-icons/react"

type Props = {
  label: string
  sortKey: string
  sortState: Sort | null
  onSortChange: (sort: Sort | null) => void
}

const SortHeader = ({ label, sortKey, sortState, onSortChange }: Props) => {
  return (
    <div>
      <Button
        className="p-0 text-foreground"
        size="sm"
        variant="link"
        onClick={() => {
          if (!sortState || sortState.key !== sortKey) {
            onSortChange({ key: sortKey, order: "ASC" })
          } else if (sortState.order === "ASC" && sortState.key === sortKey) {
            onSortChange({ key: sortKey, order: "DESC" })
          } else if (sortState.order === "DESC" && sortState.key === sortKey) {
            onSortChange(null)
          }
        }}
      >
        {label}
        <div>
          {sortState?.key === sortKey ? (
            sortState.order == "ASC" ? (
              <ArrowUpIcon />
            ) : (
              <ArrowDownIcon />
            )
          ) : (
            <CaretUpDownIcon />
          )}
        </div>
      </Button>
    </div>
  )
}

export default SortHeader
