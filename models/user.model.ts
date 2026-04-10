import { model, models, Schema } from "mongoose"
import { Role, type IUser } from "../types/user.type"

const User = new Schema<IUser>(
  {
    image: { type: String, required: false },
    name: { type: String, required: true },
    surname: { type: String, required: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: false, select: false },
    role: {
      type: String,
      enum: Object.values(Role),
      required: true,
    },
    pin: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default models.User || model<IUser>("User", User)
