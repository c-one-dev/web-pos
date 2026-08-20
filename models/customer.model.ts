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
    firstName: { type: String, required: true },
    middleName: { type: String, required: false },
    lastName: { type: String, required: true },
    // Display name, derived server-side as "firstName lastName". Kept as a
    // stored field because receipts, sale history and the report aggregation
    // pipelines all read customer.name directly - deriving it on write means
    // none of those had to change, and records created before the name was
    // split keep working untouched.
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["CUSTOMER", "EMPLOYEE"],
      default: "CUSTOMER",
    },
    email: { type: String, required: false },
    accountLimit: { type: AccountLimit, required: true },
    storeCredit: { type: StoreCredit, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default models.Customer || model<ICustomer>("Customer", Customer)
