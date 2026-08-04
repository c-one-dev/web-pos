import type { Types } from "mongoose"
import type { IUser } from "./user.type"

export interface ITimeCard {
  _id: Types.ObjectId | string
  user: Types.ObjectId | string | IUser
  clockIn: Date
  clockOut?: Date | null
}
