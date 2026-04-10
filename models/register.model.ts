import { model, models, Schema } from "mongoose"
import { type IScheduleItem, type IRegister } from "../types/register.type"
import { Day } from "../types/shared.type"

const ScheduleItem = new Schema<IScheduleItem>(
  {
    day: { type: String, enum: Object.values(Day), required: true },
    openingTime: { type: String, required: true },
    closingTime: { type: String, required: true },
  },
  { _id: false }
)

const Register = new Schema<IRegister>(
  {
    name: { type: String, required: true },
    outlet: { type: Schema.Types.ObjectId, ref: "Outlet", required: true },
    prefix: { type: String, required: true },
    schedule: { type: [ScheduleItem], default: [] },
    isOpen: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default models.Register || model<IRegister>("Register", Register)
