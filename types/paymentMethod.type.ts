import type { Types } from "mongoose"

export enum PaymentType {
  "PHYSICAL" = "PHYSICAL",
  "DIGITAL" = "DIGITAL",
  "OTHER" = "OTHER",
}

export interface IPaymentMethod {
  _id: Types.ObjectId | string
  name: string
  type: PaymentType
  isActive: boolean
}

export interface IPaymentMethodInput {
  name: string
  type: PaymentType
}

export interface IPaymentMethodNode {
  _id: Types.ObjectId | string
  name: string
  type: PaymentType
  isActive: boolean
}
