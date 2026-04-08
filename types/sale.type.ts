import type { Types } from "mongoose"
import type { ICustomer } from "./customer.type"
import type { IUser } from "./user.type"
import type { IPayment } from "./payment.type"
import type { IProduct } from "./product.type"

export enum SaleStatus {
  PENDING = "PENDING",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export interface ISaleItem {
  product: Types.ObjectId | string | IProduct
  name: string // Snapshot of the product name at the time of sale
  price: number // Snapshot of the product price at the time of sale
  quantity: number
  subTotal: number
  discount: number
  total: number
}

export interface IPaymentAllocation {
  amount: number
  payment: Types.ObjectId | string | IPayment
  date: Date
}

export interface ISaleHistoryItem {
  status: SaleStatus
  date: Date
  by: Types.ObjectId | string | IUser
}

export interface ISale {
  _id: Types.ObjectId | string
  saleNumber: string
  customer: Types.ObjectId | string | ICustomer | null
  items: ISaleItem[]
  subTotal: number
  discount: number
  total: number
  allocations: IPaymentAllocation[]
  paid: number
  unappliedAmount: number
  date: Date
  by: Types.ObjectId | string | IUser
  currentStatus: SaleStatus
  onAccount: boolean
  statusHistory: ISaleHistoryItem[]
}

// Inputs
export interface ISaleItemInput {
  product: Types.ObjectId | string
  name: string // Snapshot of the product name at the time of sale
  price: number // Snapshot of the product price at the time of sale
  quantity: number
  subTotal: number
  discount: number
  total: number
}

export interface IPaymentAllocationInput {
  amount: number
  payment: Types.ObjectId | string
  date: Date
}

export interface ISaleInput {
  _id: Types.ObjectId | string
  saleNumber: string
  customer: Types.ObjectId | string 
  items: ISaleItemInput[]
  subTotal: number
  discount: number
  total: number
  allocations: IPaymentAllocationInput[]
  paid: number
  unappliedAmount: number
  date: Date
  by: Types.ObjectId | string | IUser
  onAccount: boolean
}

export interface ISaleNode {
  _id: Types.ObjectId | string
  saleNumber: string
  customerName: string | null
  total: number
  date: Date
  currentStatus: SaleStatus
}
