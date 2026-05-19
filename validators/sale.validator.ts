import { z } from "zod"

export const saleSchema = z.object({
  customer: z.string().optional().nullable(),
  items: z.array(
    z.object({
      product: z.string(),
      snapshotName: z.string(),
      snapshotPrice: z.number(),
      price: z.number(),
      quantity: z.number(),
      subTotal: z.number(),
      discount: z.number(),
      total: z.number(),
    })
  ),
  notes: z.string().optional().nullable(),
  subTotal: z.number(),
  discount: z.number(),
  total: z.number(),
  receivedAmount: z.number(),
  changeAmount: z.number(),
  netAmount: z.number(),
  register: z.string(),
})
