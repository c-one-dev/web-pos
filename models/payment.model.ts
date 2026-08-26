import { model, models, Schema } from "mongoose"
import { type IPayment } from "../types/payment.type"

const Payment = new Schema<IPayment>(
  {
    amount: { type: Number, required: true },
    method: {
      type: Schema.Types.ObjectId,
      ref: "Payment_Method",
      required: true,
    },
    change: { type: Number, required: true, default: 0 },
    date: { type: Date, required: true },
    note: { type: String },
    // Kept separate from `note`: a note is free text the cashier may add for
    // any reason, while this is the provider's reference / approval code and
    // is required for digital tenders. Merging them meant a stray note looked
    // like a captured reference.
    reference: { type: String },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sale: [{ type: Schema.Types.ObjectId, ref: "Sale", required: true }],
  },
  { timestamps: true }
)

export default models.Payment || model<IPayment>("Payment", Payment)
