import { model, Schema } from "mongoose"
import { type IProductType } from "../types/productType.type"

const ProductType = new Schema<IProductType>(
  {
    name: { type: String, required: true },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Product_Type",
      required: false,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export default model<IProductType>("Product_Type", ProductType)
