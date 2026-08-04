import { model, models, Schema } from "mongoose"
import type { IActivityLog } from "../types/activityLog.type"

const ActivityLog = new Schema<IActivityLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, required: true },
    activity: { type: String, required: true },
    ipAddress: { type: String },
    deviceName: { type: String },
    browser: { type: String },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
)

export default models.ActivityLog || model<IActivityLog>("ActivityLog", ActivityLog)
