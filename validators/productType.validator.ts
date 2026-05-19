import z from "zod"

export const productTypeSchema = z.object({
  _id: z.string().optional().nullable(),
  name: z.string().nonempty("Name is required"),
  parent: z.string().optional().nullable(),
})
