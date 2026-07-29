import z from "zod"
import Customer from "../models/customer.model"

export const settleAccountBalanceSchema = z
  .object({
    _id: z.string().nonempty("Customer id is required"),
    amount: z.number().positive("Settlement amount must be greater than zero"),
  })
  .superRefine(async (args, ctx) => {
    const customer = await Customer.findById(args._id).select("accountLimit")

    if (!customer) {
      ctx.addIssue({
        code: "custom",
        path: ["_id"],
        message: "Customer does not exist.",
      })
      return
    }

    const outstanding =
      customer.accountLimit.max - customer.accountLimit.current
    if (args.amount > outstanding) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Settlement amount cannot exceed the outstanding balance.",
      })
    }
  })
