import { model, models, Schema } from "mongoose"
import {
  IAccountLimit,
  IAccountLimitHistoryItem,
  IStoreCredit,
  IStoreCreditHistoryItem,
  type ICustomer,
} from "../types/customer.type"

const AccountLimitHistoryItem = new Schema<IAccountLimitHistoryItem>({
  remaining: { type: Number, required: true },
  transacted: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String, required: false },
})

const AccountLimit = new Schema<IAccountLimit>(
  {
    max: { type: Number, required: true },
    current: { type: Number, required: true },
    history: { type: [AccountLimitHistoryItem], required: false },
  },
  { _id: false }
)

const StoreCreditHistoryItem = new Schema<IStoreCreditHistoryItem>({
  remaining: { type: Number, required: true },
  transacted: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String, required: true },
})

const StoreCredit = new Schema<IStoreCredit>(
  {
    current: { type: Number, required: true },
    history: { type: [StoreCreditHistoryItem], required: false },
  },
  {
    _id: false,
  }
)

const Customer = new Schema<ICustomer>(
  {
    name: { type: String, required: true },
    email: { type: String, required: false },
    accountLimit: { type: AccountLimit, required: true },
    storeCredit: { type: StoreCredit, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default models.Customer || model<ICustomer>("Customer", Customer)
