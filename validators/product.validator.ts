import z from "zod"
import Product from "../models/product.model"
import Register from "../models/register.model"
import ProductType from "../models/productType.model"
import { Types } from "mongoose"
import Brand from "../models/brand.model"

export const productSchema = z
  .object({
    _id: z.string().optional(),
    name: z.string().nonoptional("Name is required"),
    sku: z.string().nonoptional("SKU is required"),
    barcode: z.string().optional(),
    description: z.string().optional(),
    currentPrice: z.number().nonnegative().nonoptional("Price is required"),
    type: z
      .string()
      .optional()
      .superRefine(async (data, ctx) => {
        if (data) {
          const exists = await ProductType.exists({ _id: data })
          if (!exists) {
            ctx.addIssue({
              code: "custom",
              message: "Invalid product type.",
              path: ["type"],
            })
          }
        }
      }),
    brand: z
      .string()
      .optional()
      .superRefine(async (data, ctx) => {
        if (data) {
          const exists = await Brand.exists({ _id: data })
          if (!exists) {
            ctx.addIssue({
              code: "custom",
              message: "Invalid brand.",
              path: ["brand"],
            })
          }
        }
      }),
    registers: z
      .array(z.string().nonoptional("Register is required"))
      .superRefine(async (data, ctx) => {
        if (data.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: "At least one register is required.",
            path: ["register"],
          })
        }
        const invalidRegisters: string[] = []
        for (const registerId of data) {
          const exists = await Register.exists({ _id: registerId })
          if (!exists) {
            invalidRegisters.push(registerId)
          }
        }
        if (invalidRegisters.length > 0) {
          ctx.addIssue({
            code: "custom",
            message: `Invalid registers: ${invalidRegisters.join(", ")}`,
            path: ["register"],
          })
        }
      }),
  })
  .superRefine(async (data, ctx) => {
    const isUpdate = !!data._id
    const [nameAlreadyExists, skuAlreadyExists] = await Promise.all([
      await Product.exists({
        name: data.name,
        ...(isUpdate ? { _id: { $ne: new Types.ObjectId(data?._id) } } : {}),
      }),
      await Product.exists({
        sku: data.sku,
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

    if (skuAlreadyExists) {
      ctx.addIssue({
        code: "custom",
        message: "SKU already exists.",
        path: ["sku"],
      })
    }
  })
