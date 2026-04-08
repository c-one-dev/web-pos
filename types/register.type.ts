import type { Types } from "mongoose"
import type { IOutlet } from "./outlet.type"
import type { Day } from "./shared.type"

export interface IScheduleItem {
  day: Day
  openingTime: string
  closingTime: string
}

export interface IRegister {
  _id: Types.ObjectId | string
  name: string
  outlet: Types.ObjectId | string | IOutlet
  prefix: string
  schedule: IScheduleItem[]
  isOpen: boolean
  isActive: boolean
}

export interface IRegisterInput {
  name: string
  outlet: Types.ObjectId | string
  prefix: string
}

export interface IRegisterNode {
  _id: Types.ObjectId | string
  name: string
  outletName: string
  prefix: string
  isActive: boolean
}
