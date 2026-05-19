import z from "zod"

export const productSchema = z.object({
  _id: z.string().optional().nullable(),
  name: z.string().nonempty("Name is required"),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  currentPrice: z
    .number()
    .nonnegative()
    .min(0, { message: "Please enter a valid price." }),
  type: z.string().nonempty("Type is required"),
  brand: z.string().optional().nullable(),
  registers: z.array(z.string()).optional(),
})
