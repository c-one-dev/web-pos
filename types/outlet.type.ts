import type { Types } from "mongoose"

export interface IOutlet {
  _id: Types.ObjectId | string
  name: string
  isActive: boolean
}

export interface IOutletInput {
  name: string
}

export interface IOutletNode {
  _id: Types.ObjectId | string
  name: string
  isActive: boolean
}
