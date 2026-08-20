import { z } from "zod"

const saleItemSchema = z
  .object({
    product: z.string(),
    snapshotName: z.string(),
    snapshotPrice: z.number().nonnegative(),
    price: z.number().nonnegative(),
    quantity: z.number().int().positive(),
    subTotal: z.number().nonnegative(),
    discount: z.number().nonnegative(),
    total: z.number().nonnegative(),
  })
  .refine((item) => item.discount <= item.snapshotPrice, {
    message: "Discount cannot exceed the item price",
    path: ["discount"],
  })

const salePaymentSchema = z
  .object({
    method: z.string(),
    amount: z.number().nonnegative(),
    change: z.number().nonnegative(),
    note: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
  })
  .refine((payment) => payment.change <= payment.amount, {
    message: "Change cannot exceed the amount tendered",
    path: ["change"],
  })

export const saleSchema = z
  .object({
    customer: z.string().optional().nullable(),
    items: z.array(saleItemSchema),
    payments: z.array(salePaymentSchema),
    notes: z.string().optional().nullable(),
    subTotal: z.number().nonnegative(),
    discount: z.number().nonnegative(),
    total: z.number().nonnegative(),
    receivedAmount: z.number().nonnegative(),
    changeAmount: z.number().nonnegative(),
    netAmount: z.number().nonnegative(),
    changeToStoreCredit: z.boolean().optional().nullable(),
    register: z.string(),
  })
  .refine((sale) => sale.discount <= sale.subTotal, {
    message: "Discount cannot exceed the subtotal",
    path: ["discount"],
  })

// Notes are edited on their own from the Sale Order dialog, without touching
// items or payments, so they get their own small schema rather than reusing
// saleSchema (which would demand the whole sale back).
export const updateSaleNotesSchema = z.object({
  _id: z.string().nonempty("Sale id is required"),
  notes: z
    .string()
    .max(1000, "Notes must be at most 1000 characters")
    .optional()
    .nullable(),
})

// Refunds are issued as store credit, per line item - see refundSaleItems in
// resolvers/sale.resolver.ts for the balance rules this can't express
// (remaining quantity per line, walk-in sales, voided sales).
export const refundSaleItemsSchema = z.object({
  _id: z.string().nonempty("Sale id is required"),
  items: z
    .array(
      z.object({
        itemIndex: z.number().int().nonnegative(),
        quantity: z
          .number()
          .int()
          .positive("Refund quantity must be at least 1"),
      })
    )
    .nonempty("Select at least one item to refund"),
  note: z
    .string()
    .max(500, "Note must be at most 500 characters")
    .optional()
    .nullable(),
})

// Settling the On Account debt on one or more sales. The per-sale rules the
// server enforces on top of this shape (how much is still owed, whether the
// register session is open) live in settleSales.
export const settleSalesSchema = z.object({
  sales: z
    .array(
      z.object({
        _id: z.string().nonempty("Sale is required"),
        amount: z.number().positive("Settlement amount must be more than 0"),
      })
    )
    .nonempty("Select at least one sale to settle"),
  method: z.string().nonempty("Payment method is required"),
  register: z.string().nonempty("Register is required"),
  note: z
    .string()
    .max(500, "Note must be at most 500 characters")
    .optional()
    .nullable(),
})
