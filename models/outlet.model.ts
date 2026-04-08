import { model, Schema } from "mongoose"
import { type IOutlet } from "../types/outlet.type"

const Outlet = new Schema<IOutlet>(
  {
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export default model<IOutlet>("Outlet", Outlet)
