import { model, models, Schema } from "mongoose"
import type { ITimeCard } from "../types/timecard.type"

const TimeCard = new Schema<ITimeCard>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clockIn: { type: Date, required: true },
    clockOut: { type: Date },
  },
  { timestamps: true }
)

export default models.TimeCard || model<ITimeCard>("TimeCard", TimeCard)
