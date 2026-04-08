import z from "zod"
import Brand from "../models/brand.model"
import { Types } from "mongoose"

export const brandSchema = z
  .object({
    _id: z.string().optional(),
    name: z.string().nonoptional("Name is required"),
  })
  .superRefine(async (data, ctx) => {
    const isUpdate = !!data._id
    const [nameAlreadyExists] = await Promise.all([
      await Brand.exists({
        name: data.name,
        ...(isUpdate ? { _id: { $ne: new Types.ObjectId(data?._id) } } : {}),
      }),
    ])

    if (nameAlreadyExists) {
      ctx.addIssue({
        code: "custom",
        message: "Name already exists.",
        path: ["name"],
      })
    }
  })
