import z from "zod"
import Brand from "../models/brand.model"
import { Types } from "mongoose"
import { PaymentType } from "@/types/paymentMethod.type"

export const paymentMethodSchema = z.object({
  _id: z.string().optional().nullable(),
  name: z.string().nonempty("Name is required"),
  type: z
    .enum(Object.values(PaymentType), "Invalid payment type")
    .nonoptional("Type is required"),
})
