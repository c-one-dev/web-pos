import z from "zod"

export const brandSchema = z.object({
  _id: z.string().optional().nullable(),
  name: z.string().nonempty("Name is required"),
})
