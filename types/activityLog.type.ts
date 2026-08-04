import type { Types } from "mongoose"
import type { IUser } from "./user.type"

export interface IActivityLog {
  _id: Types.ObjectId | string
  user?: Types.ObjectId | string | IUser | null
  userName: string
  activity: string
  ipAddress?: string
  deviceName?: string
  browser?: string
  date: Date
}
