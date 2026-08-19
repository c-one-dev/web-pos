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
  // Opening balances, accepted on create only. Both seed a history entry so
  // the starting figure is auditable the same way a later adjustment is.
  accountLimit: z
    .number()
    .min(0, "Account limit cannot be negative")
    .optional()
    .nullable(),
  storeCredit: z
    .number()
    .min(0, "Store credit cannot be negative")
    .optional()
    .nullable(),
})

// updateCustomer writes with flatten(), which would $set a bare number over
// the accountLimit/storeCredit subdocuments and destroy their max/current/
// history shape. Balances are only ever changed through adjustAccountLimit,
// adjustStoreCredit and settleAccountBalance, so they are omitted here rather
// than relying on the resolver to remember to strip them.
export const customerUpdateSchema = customerSchema.omit({
  accountLimit: true,
  storeCredit: true,
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
