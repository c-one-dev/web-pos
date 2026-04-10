import { model, models, Schema } from "mongoose"
import {
  SaleStatus,
  type IPaymentAllocation,
  type ISale,
  type ISaleItem,
} from "../types/sale.type"

const SaleItem = new Schema<ISaleItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    subTotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  {
    _id: false,
  }
)

const PaymentAllocation = new Schema<IPaymentAllocation>(
  {
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },
    amount: { type: Number, required: true },
  },
  {
    _id: false,
  }
)

const Sale = new Schema<ISale>(
  {
    saleNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    items: {
      type: [SaleItem],
      required: true,
      default: [],
    },
    subTotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    total: { type: Number, required: true },
    allocations: {
      type: [PaymentAllocation],
      required: true,
      default: [],
    },
    paid: { type: Number, required: true },
    unappliedAmount: { type: Number, required: true },
    date: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    currentStatus: {
      type: String,
      enum: Object.values(SaleStatus),
      required: true,
    },
  },
  { timestamps: true }
)

export default models.Sale || model<ISale>("Sale", Sale)
