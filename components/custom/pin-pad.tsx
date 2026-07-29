"use client"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  maxLength?: number
  disabled?: boolean
}

const DIGIT_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
]

export default function PinPad({
  value,
  onChange,
  onComplete,
  maxLength = 4,
  disabled,
}: Props) {
  const press = (digit: string) => {
    if (disabled || value.length >= maxLength) return
    const next = value + digit
    onChange(next)
    if (next.length === maxLength) onComplete?.(next)
  }

  const clear = () => onChange("")

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-2">
        {Array.from({ length: maxLength }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "flex size-14 items-center justify-center border text-lg",
              index === value.length && "border-ring ring-1 ring-ring/50"
            )}
          >
            {index < value.length && (
              <span className="size-2.5 rounded-full bg-foreground" />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        {DIGIT_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-3">
            {row.map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={disabled}
                onClick={() => press(digit)}
                className="flex size-14 items-center justify-center rounded-full border text-xl transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => press("0")}
            className="flex size-14 items-center justify-center rounded-full border text-xl transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={disabled || !value.length}
            onClick={clear}
            className="flex h-14 items-center justify-center px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
