import type { Types } from "mongoose"
import type { IBrand } from "./brand.type"
import type { IProductType } from "./productType.type"
import type { IRegister } from "./register.type"

export interface IProductPriceHistoryItem {
  price: number
  date: Date
}

export interface IProduct {
  _id: Types.ObjectId | string
  image: string
  sku: string
  name: string
  barcode: string
  description: string
  currentPrice: number
  priceHistory: IProductPriceHistoryItem[]
  brand: Types.ObjectId | string | IBrand
  type: Types.ObjectId | string | IProductType
  registers: Types.ObjectId[] | string[] | IRegister[]
  isActive: boolean
}

export interface IProductInput {
  image: string
  sku: string
  name: string
  barcode: string
  description: string
  currentPrice: number
  brand: Types.ObjectId | string
  type: Types.ObjectId | string
  registers: Types.ObjectId[] | string[]
}

export interface IProductNode {
  _id: Types.ObjectId | string
  image: string
  name: string
  sku: string
  currentPrice: number
  isActive: boolean
}
