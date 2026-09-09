import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cart money is plain float arithmetic, so a line like 0.33 x 100 lands on
// 33.000000000000004. Intl formatting hides that on screen, but the sale is
// stored - and compared against the amount tendered - a hair above what the
// cashier was shown. Every quantity x price result goes through here.
// Returns a number, not a string: .toFixed(2) is a string and money is a Float.
export function roundMoney(value: number) {
  return parseFloat((value || 0).toFixed(2))
}
