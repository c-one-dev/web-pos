import z from "zod"
import Brand from "../models/brand.model"
import { Types } from "mongoose"

export const brandSchema = z
  .object({
    _id: z.string().optional(),
    name: z.string().nonoptional("Name is required"),
  })

