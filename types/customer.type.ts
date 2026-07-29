import type { Types } from "mongoose"

export interface IAccountLimitHistoryItem {
  _id: Types.ObjectId | string
  remaining: number
  transacted: number
  date: Date
  description?: string
}

export interface IAccountLimit {
  max: number
  current: number
  history: IAccountLimitHistoryItem[]
}

export interface IStoreCreditHistoryItem {
  _id: Types.ObjectId | string
  remaining: number
  transacted: number
  date: Date
  description: string
}

export interface IStoreCredit {
  current: number
  history: IStoreCreditHistoryItem[]
}

export interface ICustomer {
  _id: Types.ObjectId | string
  name: string
  email: string
  accountLimit: IAccountLimit
  storeCredit: IStoreCredit
  isActive: boolean
}

export interface IAccountLimitHistoryItemInput {
  remaining: number
  transacted: number
  date: Date
  description?: string
}

export interface IAccountLimitInput {
  max: number
  current: number
  history: IAccountLimitHistoryItemInput[]
}

export interface IStoreCreditHistoryItemInput {
  remaining: number
  transacted: number
  date: Date
  description: string
}

export interface IStoreCreditInput {
  current: number
  history: IStoreCreditHistoryItemInput[]
}

export interface ICustomerInput {
  name: string
  email: string
  accountLimit: IAccountLimitInput
  storeCredit: IStoreCreditInput
}

export interface ICustomerNode {
  _id: Types.ObjectId | string
  name: string
  remainingAccountLimit: number
  remainingStoreCredit: number
  isActive: boolean
}
