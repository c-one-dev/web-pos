import { z } from "zod"

export const openRegisterSessionSchema = z.object({
  register: z.string(),
  openingFloat: z.number().nonnegative(),
})

export const cashMovementSchema = z.object({
  _id: z.string(),
  type: z.enum(["IN", "OUT"]),
  amount: z.number().positive(),
  note: z.string().optional().nullable(),
})

export const closeRegisterSessionSchema = z.object({
  _id: z.string(),
  tally: z.array(
    z.object({
      method: z.string(),
      counted: z.number().nonnegative(),
    })
  ),
  notes: z.string().optional().nullable(),
})
