import z from "zod"

export const customerSchema = z.object({
  _id: z.string().optional().nullable(),
  name: z.string().nonempty("Name is required"),
  email: z.email("Invalid email address").optional().nullable(),
})

export const adjustAccountLimitSchema = z.object({
  _id: z.string().nonempty("Customer id is required"),
  amount: z.number().finite("Amount must be a valid number"),
})

export const adjustStoreCreditSchema = z.object({
  _id: z.string().nonempty("Customer id is required"),
  amount: z.number().finite("Amount must be a valid number"),
  description: z.string().optional().nullable(),
})
