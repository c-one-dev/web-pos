import { model, models, Schema } from "mongoose"
import type { ICustomer } from "../types/customer.type"

const Customer = new Schema<ICustomer>(
  {
    name: { type: String, required: true },
    email: { type: String, required: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default models.Customer || model<ICustomer>("Customer", Customer)
