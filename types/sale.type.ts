import type { Types } from "mongoose"
import type { ICustomer } from "./customer.type"
import type { IUser } from "./user.type"
import type { IProduct } from "./product.type"
import { IPaymentMethod } from "./paymentMethod.type"

export enum SaleStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  REFUNDED = "REFUNDED",
  VOIDED = "VOIDED",
}

export enum SalePaymentStatus {
  PAID = "PAID",
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  REFUNDED = "REFUNDED",
}

export interface ISaleItem {
  product: IProduct | Types.ObjectId | string
  snapshotName: string
  snapshotPrice: number
  quantity: number
  discount: number
  price: number
  subTotal: number
  total: number
}

export interface ISalePayment {
  method: IPaymentMethod | Types.ObjectId | string
  amount: number
  change: number
  note?: string
  date: string | Date
  payment?: Types.ObjectId | string
}

export interface ISalePaymentStatusHistoryItem {
  status: SalePaymentStatus
  paymentRef?: Types.ObjectId | string
  date: string | Date
  by: IUser | Types.ObjectId | string
}

export interface ISaleStatusHistoryItem {
  status: SaleStatus
  date: string | Date
  by: IUser | Types.ObjectId | string
}

export interface ISale {
  _id: Types.ObjectId
  saleNumber: string
  customer: ICustomer | null | Types.ObjectId | string
  items: ISaleItem[]
  payments: ISalePayment[]
  subTotal: number
  discount: number
  total: number
  receivedAmount: number
  changeAmount: number
  netAmount: number
  notes: string
  currentSalePaymentStatus: SalePaymentStatus
  salePaymentStatusHistory: ISalePaymentStatusHistoryItem[]
  currentSaleStatus: SaleStatus
  saleStatusHistory: ISaleStatusHistoryItem[]
  register?: Types.ObjectId | string
  by: IUser | Types.ObjectId | string
  isOnAccount: boolean
}

export interface ISaleHistoryNode {
  _id: Types.ObjectId
  date: string
  saleNumber: string
  customerName: string
  saleTotal: number
  currentSaleStatus: SaleStatus
  currentSalePaymentStatus: SalePaymentStatus
  notes: string
  paymentNotes: string
}
