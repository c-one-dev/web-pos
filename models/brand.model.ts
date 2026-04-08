import { model, Schema } from "mongoose"
import { type IBrand } from "../types/brand.type"

const Brand = new Schema<IBrand>(
  {
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export default model<IBrand>("Brand", Brand)
