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
    mustChangePassword: { type: Boolean, default: true },
    // Fine-grained access permissions (validators/permissionRegistry.ts).
    // Deliberately has NO default: an unset field means "no explicit
    // permissions saved for this user yet", which keeps pure role-based
    // access. An empty array is a real, meaningful value - it means an admin
    // saved the Permissions dialog with nothing ticked.
    permissions: { type: [String], default: undefined },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default models.User || model<IUser>("User", User)
