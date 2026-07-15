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

export const saleSchema = z
  .object({
    customer: z.string().optional().nullable(),
    items: z.array(saleItemSchema),
    notes: z.string().optional().nullable(),
    subTotal: z.number().nonnegative(),
    discount: z.number().nonnegative(),
    total: z.number().nonnegative(),
    receivedAmount: z.number().nonnegative(),
    changeAmount: z.number().nonnegative(),
    netAmount: z.number().nonnegative(),
    register: z.string(),
  })
  .refine((sale) => sale.discount <= sale.subTotal, {
    message: "Discount cannot exceed the subtotal",
    path: ["discount"],
  })
