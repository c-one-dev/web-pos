import z from "zod"

export const customerSchema = z.object({
  _id: z.string().optional().nullable(),
  firstName: z.string().nonempty("First name is required"),
  middleName: z.string().optional().nullable(),
  lastName: z.string().nonempty("Last name is required"),
  // Defaults to CUSTOMER, so the cashier never has to touch it.
  type: z.enum(["CUSTOMER", "EMPLOYEE"]).optional().nullable(),
  // Display name is derived from firstName + lastName server-side, so it is
  // never accepted from the client.
  email: z
    .email("Invalid email address")
    .optional()
    .nullable()
    .or(z.literal("")),
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
