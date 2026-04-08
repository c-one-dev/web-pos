import z from "zod"
import ProductType from "../models/productType.model"
import { Types } from "mongoose"

export const productTypeSchema = z
  .object({
    _id: z.string().optional(),
    name: z.string().nonoptional("Name is required"),
    parent: z.string().optional().nullable(),
  })
  .superRefine(async (data, ctx) => {
    const isUpdate = !!data._id
    const [nameAlreadyExists, invalidParent] = await Promise.all([
      await ProductType.exists({
        name: data.name,
        ...(isUpdate ? { _id: { $ne: new Types.ObjectId(data?._id) } } : {}),
      }),
      !(data.parent
        ? await ProductType.exists({
            _id: data.parent,
          })
        : true),
    ])

    if (nameAlreadyExists)
      ctx.addIssue({
        code: "custom",
        message: "Name already exists.",
        path: ["name"],
      })

    if (invalidParent)
      ctx.addIssue({
        code: "custom",
        message: "Invalid parent product type.",
        path: ["parent"],
      })
  })
