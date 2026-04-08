import type { Types } from "mongoose"

export interface IProductType {
  _id: Types.ObjectId | string
  name: string
  parent: Types.ObjectId | string | IProductType | null
  isActive: boolean
}

export interface IProductTypeInput {
  name: string
  parent: Types.ObjectId | string | null
}

export interface IProductTypeNode {
  _id: Types.ObjectId | string
  name: string
  parent: string | null
  isActive: boolean
}
