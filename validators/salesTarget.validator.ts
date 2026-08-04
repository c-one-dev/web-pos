import z from "zod"

export const salesTargetSchema = z.object({
  user: z.string().nonempty("User is required"),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY"], "Period is required"),
  target: z.number().nonnegative("Target cannot be negative"),
})
