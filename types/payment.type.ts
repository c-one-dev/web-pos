import type { Types } from "mongoose"
import type { IPaymentMethod } from "./paymentMethod.type"
import type { IUser } from "./user.type"
import type { ISale } from "./sale.type"

export interface ISalesAllocation {
  amount: number
  sale: Types.ObjectId | string | ISale
}

export interface IPayment {
  _id: Types.ObjectId | string
  method: Types.ObjectId | string | IPaymentMethod
  amount: number
  allocations: ISalesAllocation[]
  date: Date
  remarks: string
  by: Types.ObjectId | string | IUser
}

export interface ISalesAllocationInput {
  amount: number
  sale: Types.ObjectId | string
}

export interface IPaymentInput {
  method: Types.ObjectId | string
  amount: number
  date: Date
  remarks: string
  by: Types.ObjectId | string
}

export interface ISalesAllocationInput {
  amount: number
  sale: Types.ObjectId | string
}

export interface IPaymentNode {
  _id: Types.ObjectId | string
  method: string
  amount: number
  date: Date
  by: string
}
