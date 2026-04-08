import type { Types } from "mongoose"

export interface ICustomer {
  _id: Types.ObjectId | string
  name: string
  email: string
  accountLimit: number
  isActive: boolean
}

export interface ICustomerInput {
  name: string
  email: string
  accountLimit: number
}

export interface ICustomerNode {
  _id: Types.ObjectId | string
  name: string
  email: string
  accountLimit: number
  isActive: boolean
}
