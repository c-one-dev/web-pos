import { model, models, Schema } from "mongoose"
import type { ISalesTarget } from "../types/salesTarget.type"

const SalesTarget = new Schema<ISalesTarget>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    period: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY"],
      required: true,
    },
    target: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
)

// One target value per user per period type - setSalesTarget upserts against
// this pair rather than accumulating duplicate rows.
SalesTarget.index({ user: 1, period: 1 }, { unique: true })

export default models.SalesTarget ||
  model<ISalesTarget>("SalesTarget", SalesTarget)
