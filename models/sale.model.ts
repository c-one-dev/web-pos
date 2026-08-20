import { model, models, Schema } from "mongoose"
import {
  SaleStatus,
  type ISalePayment,
  type ISale,
  type ISaleItem,
  ISaleStatusHistoryItem,
  ISalePaymentStatusHistoryItem,
  SalePaymentStatus,
} from "../types/sale.type"

const SaleItem = new Schema<ISaleItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    snapshotName: { type: String, required: true },
    snapshotPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    price: { type: Number, required: true },
    subTotal: { type: Number, required: true },
    total: { type: Number, required: true },
    // How much of this line has already been refunded as store credit, so a
    // unit can never be refunded twice across several partial refunds.
    refundedQuantity: { type: Number, required: true, default: 0 },
  },
  { _id: false }
)

const SaleRefundItem = new Schema(
  {
    itemIndex: { type: Number, required: true },
    snapshotName: { type: String, required: true },
    quantity: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
)

const SaleRefund = new Schema(
  {
    items: { type: [SaleRefundItem], required: true },
    amount: { type: Number, required: true },
    note: { type: String },
    date: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
)

// A repayment against the On Account portion of a sale. Stamped with the
// register session it was taken in, so cash settlements land in that shift's
// closure tally instead of vanishing from the drawer count.
const SaleSettlement = new Schema(
  {
    amount: { type: Number, required: true },
    method: {
      type: Schema.Types.ObjectId,
      ref: "Payment_Method",
      required: true,
    },
    payment: { type: Schema.Types.ObjectId, ref: "Payment" },
    note: { type: String },
    date: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    register: { type: Schema.Types.ObjectId, ref: "Register" },
    registerSession: { type: Schema.Types.ObjectId, ref: "Register_Session" },
  },
  { _id: false }
)

const SalePayment = new Schema<ISalePayment>(
  {
    method: {
      type: Schema.Types.ObjectId,
      ref: "Payment_Method",
      required: true,
    },
    amount: { type: Number, required: true },
    change: { type: Number, required: true, default: 0 },
    note: { type: String },
    date: { type: Date, required: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment" },
  },
  { _id: false }
)

const SaleStatusHistoryItem = new Schema<ISaleStatusHistoryItem>(
  {
    status: {
      type: String,
      enum: Object.values(SaleStatus),
      required: true,
    },
    date: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
)

const SalePaymentStatusHistoryItem = new Schema<ISalePaymentStatusHistoryItem>(
  {
    status: {
      type: String,
      enum: Object.values(SalePaymentStatus),
      required: true,
    },
    paymentRef: { type: Schema.Types.ObjectId, ref: "Payment" },
    date: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
)

const Sale = new Schema<ISale>(
  {
    saleNumber: { type: String, required: true, unique: true },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
      default: null,
      set: (value: any) => (value === "" ? null : value),
    },
    items: {
      type: [SaleItem],
      required: true,
      default: [],
    },
    payments: {
      type: [SalePayment],
      required: true,
      default: [],
    },
    subTotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    total: { type: Number, required: true },
    receivedAmount: { type: Number, required: true },
    changeAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    // Recorded so a receipt or audit can tell a zero-change sale apart from
    // one whose change was retained as store credit.
    changeToStoreCredit: { type: Boolean, default: false },
    changeCreditedAmount: { type: Number, default: 0 },
    // Running total of store credit issued back against this sale, and the
    // individual refunds that make it up.
    // How much of the On Account debt has been repaid, and the repayments
    // that make it up.
    settledAmount: { type: Number, required: true, default: 0 },
    settlements: { type: [SaleSettlement], required: false, default: [] },
    refundedAmount: { type: Number, required: true, default: 0 },
    refunds: { type: [SaleRefund], required: false, default: [] },
    notes: { type: String },
    currentSalePaymentStatus: {
      type: String,
      enum: Object.values(SalePaymentStatus),
      required: true,
    },
    salePaymentStatusHistory: {
      type: [SalePaymentStatusHistoryItem],
      default: [],
    },
    currentSaleStatus: {
      type: String,
      enum: Object.values(SaleStatus),
      required: true,
    },
    saleStatusHistory: {
      type: [SaleStatusHistoryItem],
      default: [],
    },
    register: { type: Schema.Types.ObjectId, ref: "Register", required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isOnAccount: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
)

export default models.Sale || model<ISale>("Sale", Sale)
