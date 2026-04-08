import { model, Schema } from "mongoose"
import type {
  IProductPriceHistoryItem,
  IProduct,
} from "../types/product.type"

const ProductPriceHistoryItem = new Schema<IProductPriceHistoryItem>(
  {
    price: { type: Number, required: true },
    date: { type: Date, required: true },
  },
  {
    _id: false,
  },
)

const Product = new Schema<IProduct>(
  {
    image: { type: String, required: false },
    name: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, required: false },
    description: { type: String, required: false },
    type: {
      type: Schema.Types.ObjectId,
      ref: "Product_Type",
      required: false,
    },
    currentPrice: { type: Number, required: true },
    priceHistory: { type: [ProductPriceHistoryItem], required: true },
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: false },
    registers: {
      type: [Schema.Types.ObjectId],
      ref: "Register",
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export default model<IProduct>("Product", Product)
