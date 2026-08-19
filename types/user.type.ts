import type { Types } from "mongoose"

export enum Role {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  CASHIER = "CASHIER",
}

export interface IUser {
  _id: Types.ObjectId | string
  image: string
  name: string
  surname: string
  displayName: string
  email: string
  username: string
  password: string
  role: Role
  pin: string
  mustChangePassword: boolean
  // Undefined when no explicit permissions have ever been saved for this
  // user - see validators/permissionRegistry.ts.
  permissions?: string[]
  isActive: boolean
}

export interface IUserInput {
  image: string
  name: string
  surname: string
  displayName: string
  email: string
  username: string
  role: Role
  pin: string
}

export interface IUserNode {
  _id: Types.ObjectId | string
  image: string
  fullName: string
  role: Role
  isActive: boolean
}
