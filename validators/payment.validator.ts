import z from "zod"

export const updatePaymentNoteSchema = z.object({
  _id: z.string().nonempty("Payment id is required"),
  note: z
    .string()
    .max(500, "Note must be at most 500 characters")
    .optional()
    .nullable(),
})
