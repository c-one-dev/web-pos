import { model, models, Schema } from "mongoose"
import {
  type ICashMovement,
  type ITallyItem,
  type IRegisterSession,
} from "../types/registerSession.type"

const CashMovement = new Schema<ICashMovement>(
  {
    type: { type: String, enum: ["IN", "OUT"], required: true },
    amount: { type: Number, required: true },
    note: { type: String },
    date: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
)

const TallyItem = new Schema<ITallyItem>(
  {
    method: {
      type: Schema.Types.ObjectId,
      ref: "Payment_Method",
      required: true,
    },
    expected: { type: Number, required: true },
    counted: { type: Number, required: true },
    difference: { type: Number, required: true },
  },
  { _id: false }
)

const RegisterSession = new Schema<IRegisterSession>(
  {
    register: { type: Schema.Types.ObjectId, ref: "Register", required: true },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    openedAt: { type: Date, required: true, default: Date.now },
    openingFloat: { type: Number, required: true, default: 0 },
    cashMovements: { type: [CashMovement], default: [] },
    tally: { type: [TallyItem], default: [] },
    notes: { type: String },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      required: true,
      default: "OPEN",
    },
  },
  { timestamps: true }
)

export default models.RegisterSession ||
  model<IRegisterSession>("RegisterSession", RegisterSession)
