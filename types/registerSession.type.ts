import type { Types } from "mongoose"
import type { IRegister } from "./register.type"
import type { IUser } from "./user.type"
import type { IPaymentMethod } from "./paymentMethod.type"

export type CashMovementType = "IN" | "OUT"
export type RegisterSessionStatus = "OPEN" | "CLOSED"

export interface ICashMovement {
  type: CashMovementType
  amount: number
  note?: string
  date: Date
  by: Types.ObjectId | string | IUser
}

export interface ITallyItem {
  method: Types.ObjectId | string | IPaymentMethod
  expected: number
  counted: number
  difference: number
}

export interface IRegisterSession {
  _id: Types.ObjectId | string
  register: Types.ObjectId | string | IRegister
  openedBy: Types.ObjectId | string | IUser
  openedAt: Date
  openingFloat: number
  cashMovements: ICashMovement[]
  tally: ITallyItem[]
  notes?: string
  closedBy?: Types.ObjectId | string | IUser
  closedAt?: Date
  status: RegisterSessionStatus
}

export interface IRegisterSessionTableNode {
  _id: Types.ObjectId | string
  registerName: string
  outletName: string
  openedAt: string
  closedAt: string
  expected: number
  actual: number
  difference: number
}
