import type { Types } from "mongoose"
import type { IUser } from "./user.type"

export type SalesTargetPeriod = "DAILY" | "WEEKLY" | "MONTHLY"

export interface ISalesTarget {
  _id: Types.ObjectId | string
  user: Types.ObjectId | string | IUser
  period: SalesTargetPeriod
  target: number
}
