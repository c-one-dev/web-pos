import type { Types } from "mongoose"
import type { IPaymentMethod } from "./paymentMethod.type"
import type { IUser } from "./user.type"
import type { ISale } from "./sale.type"

export interface IPayment {
  _id: Types.ObjectId
  method: IPaymentMethod | Types.ObjectId | string
  amount: number
  change: number
  note?: string
  date: string | Date
  by: IUser | Types.ObjectId | string
  sale: ISale[] | Types.ObjectId[] | string[]
}

export interface IPaymentNode {
  _id: Types.ObjectId
  amount: number
  note: string
  byName: string
  saleList: string[]
  methodName: string
  paymentDate: string
}
