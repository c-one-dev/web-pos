import { model, models, Schema } from "mongoose"
import {
  IAccountLimit,
  IAccountLimitHistoryItem,
  IStoreCredit,
  IStoreCreditHistoryItem,
  ICurrentBalance,
  ICurrentBalanceHistoryItem,
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

// Change the customer left on their account at checkout. Kept apart from
// store credit so each wallet has a single source: this one only ever grows
// from kept change and shrinks when spent as a tender.
const CurrentBalanceHistoryItem = new Schema<ICurrentBalanceHistoryItem>({
  remaining: { type: Number, required: true },
  transacted: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String, required: true },
})

const CurrentBalance = new Schema<ICurrentBalance>(
  {
    current: { type: Number, required: true, default: 0 },
    history: { type: [CurrentBalanceHistoryItem], required: false },
  },
  { _id: false }
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
    // Not required: customers created before Current Balance existed simply
    // have no wallet yet, and read as 0 until their first kept change.
    currentBalance: {
      type: CurrentBalance,
      required: false,
      default: () => ({ current: 0, history: [] }),
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default models.Customer || model<ICustomer>("Customer", Customer)
