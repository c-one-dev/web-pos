import type { Types } from "mongoose"

export interface IBrand {
  _id: Types.ObjectId | string
  name: string
  isActive: boolean
}

export interface IBrandInput {
  name: string
}

export interface IBrandNode {
  _id: Types.ObjectId | string
  name: string
  isActive: boolean
}
