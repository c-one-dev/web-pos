import z from "zod"
import Outlet from "../models/outlet.model"
import Register from "../models/outlet.model"
import { Types } from "mongoose"
import { Day } from "../types/shared.type"

export const registerSchema = z
  .object({
    _id: z.string().optional(),
    name: z.string().nonoptional("Name is required"),
    outlet: z
      .string()
      .nonempty("Outlet is required")
      .superRefine(async (data, ctx) => {
        if (data) {
          const exists = await Outlet.exists({ _id: data })
          if (!exists) {
            ctx.addIssue({
              code: "custom",
              message: "Invalid outlet.",
              path: ["outlet"],
            })
          }
        }
      }),
    prefix: z.string().nonempty("Prefix is required"),
    schedule: z
      .array(
        z.object({
          day: z
            .enum(Object.values(Day), "Invalid day")
            .nonoptional("Day is required"),
          openingTime: z
            .string()
            .nonempty("Opening time is required")
            .regex(
              /^(?:[01]\d|2[0-3]):[0-5]\d$/,
              "Opening time must be valid.",
            ),
          closingTime: z
            .string()
            .nonempty("Closing time is required")
            .regex(
              /^(?:[01]\d|2[0-3]):[0-5]\d$/,
              "Closing time must be valid.",
            ),
        }),
      )
      .default([]),
  })
  .superRefine(async (data, ctx) => {
    const isUpdate = !!data._id
    const [nameAlreadyExists, prefixAlreadyExists, invalidOutlet] =
      await Promise.all([
        await Register.exists({
          name: data.name,
          ...(isUpdate ? { _id: { $ne: new Types.ObjectId(data?._id) } } : {}),
        }),
        await Register.exists({
          prefix: data.prefix,
          ...(isUpdate ? { _id: { $ne: new Types.ObjectId(data?._id) } } : {}),
        }),
        !(await Outlet.exists({
          _id: data.outlet,
        })),
      ])

    if (nameAlreadyExists)
      ctx.addIssue({
        code: "custom",
        message: "Name already exists.",
        path: ["name"],
      })

    if (prefixAlreadyExists)
      ctx.addIssue({
        code: "custom",
        message: "Prefix already exists.",
        path: ["prefix"],
      })

    if (invalidOutlet)
      ctx.addIssue({
        code: "custom",
        message: "Invalid outlet.",
        path: ["outlet"],
      })
  })
