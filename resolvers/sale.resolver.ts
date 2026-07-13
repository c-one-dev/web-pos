import { GraphQLError } from "graphql"
import Sale from "../models/sale.model"
import { startOfDay, endOfDay } from "date-fns"
import mongoose, { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { saleSchema } from "../validators/sale.validator"
import { isISOString } from "../helpers/isoString"
import Register from "@/models/register.model"
import Payment from "@/models/payment.model"
import { checkSalesPaymentStatus } from "@/helpers/salesFn"

const CURSOR_TYPE = "sale"

const generateSaleNode = (sale: any) => ({
  _id: sale._id,
  date: sale.createdAt,
  saleNumber: sale.saleNumber,
  customerName: sale.customer ? sale.customer.name : "Walk-in",
  saleTotal: sale.netAmount,
  currentSaleStatus: sale.currentSaleStatus,
  currentSalePaymentStatus: sale.currentSalePaymentStatus,
  notes: sale.notes,
})

export const saleResolver = {
  Query: {
    sale: async (_: any, { _id }: any) => {
      try {
        const sale = await Sale.findById(_id)
          .populate([
            { path: "customer" },
            { path: "items.product" },
            { path: "payments.payment", populate: { path: "by" } },
            { path: "payments.method" },
            { path: "salePaymentStatusHistory.paymentRef" },
            { path: "salePaymentStatusHistory.by" },
            { path: "saleStatusHistory.by" },
            { path: "by" },
            { path: "register" },
          ])
          .lean()
        if (!sale) throw new GraphQLError("Sale not found")
        return sale
      } catch (error) {
        throw error
      }
    },
    saleHistoryTable: async (
      _: any,
      { first = 10, after, search, filter, sort }: IDataTableArgs
    ) => {
      try {
        const matchStage: Record<string, any> = {}

        if (search)
          matchStage.$or = [
            { notes: { $regex: search, $options: "i" } },
            { paymentNotes: { $regex: search, $options: "i" } },
            { saleNumber: { $regex: search, $options: "i" } },
            { customerName: { $regex: search, $options: "i" } },
            { currentSaleStatus: { $regex: search, $options: "i" } },
            { currentSalePaymentStatus: { $regex: search, $options: "i" } },
            { saleTotal: isNaN(Number(search)) ? undefined : Number(search) },
          ]

        if (filter && filter.length > 0)
          matchStage.$and = filter.map(({ type, key, value }) => {
            switch (type) {
              case "TEXT":
              case "SELECT":
                return { [key]: { $regex: value, $options: "i" } }
              case "NUMBER":
                return { [key]: Number(value) }
              case "DATE":
                const [start, end] = value
                  .split("_")
                  .map((date) => new Date(date))
                if (!start || !end) return null
                return {
                  [key]: {
                    $gte: startOfDay(start),
                    $lte: endOfDay(end),
                  },
                }
              case "BOOLEAN":
                return { [key]: value === "true" }
              default:
                return null
            }
          })

        const sortKey = sort?.key || "_id"
        const sortOrder = sort?.order === "ASC" ? 1 : -1
        const total = await Sale.countDocuments(matchStage)

        if (after) {
          const { id, type, value } = fromCursor(after)
          if (type !== CURSOR_TYPE) throw new Error("Invalid cursor")
          const cursorId = new Types.ObjectId(id)
          const cursorValue = isISOString(value) ? new Date(value) : value

          matchStage.$and = [
            ...(matchStage.$and || []),
            {
              $or: [
                {
                  [sortKey]:
                    sortOrder === 1
                      ? { $gt: cursorValue }
                      : { $lt: cursorValue },
                },
                {
                  [sortKey]: cursorValue,
                  _id: sortOrder === 1 ? { $gt: cursorId } : { $lt: cursorId },
                },
              ],
            },
          ]
        }

        const pipeline: PipelineStage[] = [
          {
            $lookup: {
              from: "customers",
              localField: "customer",
              foreignField: "_id",
              as: "customer",
            },
          },
          {
            $unwind: {
              path: "$customer",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $addFields: {
              date: "$createdAt",
              saleNumber: "$saleNumber",
              customerName: {
                $ifNull: ["$customer.name", "Walk-in"],
              },
              saleTotal: "$netAmount",
              currentSaleStatus: "$currentSaleStatus",
              currentSalePaymentStatus: "$currentSalePaymentStatus",
              paymentNotes: {
                $reduce: {
                  input: {
                    $filter: {
                      input: "$payments",
                      as: "payment",
                      cond: { $ne: ["$$payment.note", ""] },
                    },
                  },
                  initialValue: "",
                  in: {
                    $concat: [
                      "$$value",
                      {
                        $cond: [
                          { $ne: ["$$value", ""] },
                          { $concat: [", ", "$$this.note"] },
                          "$$this.note",
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
          { $match: matchStage },
          {
            $sort: { [sortKey]: sortOrder, _id: sortOrder },
          },
          { $limit: first + 1 },
          {
            $project: {
              date: 1,
              saleNumber: 1,
              customerName: 1,
              saleTotal: 1,
              currentSaleStatus: 1,
              currentSalePaymentStatus: 1,
              notes: 1,
              paymentNotes: 1,
            },
          },
        ]

        const result = await Sale.aggregate(pipeline)
        const sliced = result.slice(0, first)
        const edges = sliced.map((edge) => ({
          node: edge,
          cursor: toCursor({
            type: CURSOR_TYPE,
            id: edge._id.toString(),
            value: edge[sortKey],
          }),
        }))

        return {
          total,
          pages: Math.ceil(total / first),
          edges,
          pageInfo: {
            endCursor: sliced.length
              ? toCursor({
                  id: sliced[sliced.length - 1]._id.toString(),
                  type: CURSOR_TYPE,
                  value: sliced[sliced.length - 1][sortKey],
                })
              : null,
            hasNextPage: result.length > first,
          },
        }
      } catch (error) {
        throw error
      }
    },
    saleOptions: async () => {
      try {
        const sales = await Sale.find({ isActive: true })
          .select("_id name")
          .lean()
        if (!sales || sales.length === 0)
          throw new GraphQLError("No sales found.")
        return sales.map((sale) => ({
          value: sale._id,
          label: sale.name,
        }))
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    generateSale: validate(checkSchema(saleSchema))(
      async (_: any, { input }: any, ctx: any) => {
        const session = await mongoose.startSession()
        try {
          if (!ctx.session)
            throw new GraphQLError("Unauthorized", {
              extensions: { code: "UNAUTHORIZED" },
            })
          const register = await Register.findById(input.register)
            .select("prefix")
            .lean()
          const sales = await Sale.find({
            register: input.register,
          })
            .sort({ createdAt: -1 })
            .select("saleNumber")
            .lean()

          let populatedResult
          await session.withTransaction(async () => {
            // Generate Multiple Payments
            const payments = await Payment.insertMany(
              input.payments.map((payment: any) => ({
                ...payment,
                by: ctx.session._id,
                sale: [], // Will be updated after sale creation
              })),
              { session }
            )
            const count = sales.length
            const paymentStatus = checkSalesPaymentStatus(payments, input.total)
            const newSale = flatten({
              ...input,
              payments: payments.map((payment) => ({
                method: payment.method,
                amount: payment.amount,
                change: payment.change,
                note: payment.note,
                date: payment.date,
                payment: payment._id,
              })),
              saleNumber: `${register?.prefix || "REG"}-${String(count + 1).padStart(5, "0")}`,
              currentSalePaymentStatus: paymentStatus,
              salePaymentStatusHistory: payments.map(
                (payment, index, array) => ({
                  status: checkSalesPaymentStatus(
                    array.slice(0, index + 1),
                    input.total
                  ),
                  paymentRef: payment._id,
                  date: new Date(),
                  by: ctx.session._id,
                })
              ),
              currentSaleStatus: "COMPLETED",
              saleStatusHistory: [
                {
                  status: "COMPLETED",
                  date: new Date(),
                  by: ctx.session._id,
                },
              ],
              by: ctx.session._id,
            })
            const [result] = await Sale.create([newSale], { session })
            // Update payments with the sale ID
            await Payment.updateMany(
              { _id: { $in: payments.map((payment) => payment._id) } },
              { $set: { sale: result._id } },
              { session }
            )
            populatedResult = await Sale.findById(result._id)
              .session(session)
              .populate([
                { path: "customer" },
                { path: "items.product" },
                { path: "payments.payment", populate: { path: "by" } },
                { path: "payments.method" },
                { path: "salePaymentStatusHistory.paymentRef" },
                { path: "salePaymentStatusHistory.by" },
                { path: "saleStatusHistory.by" },
                { path: "by" },
                { path: "register" },
              ])
              .lean()
          })

          return {
            ok: true,
            message: "Sale created successfully.",
            data: generateSaleNode(populatedResult),
          }
        } catch (error) {
          throw error
        } finally {
          await session.endSession()
        }
      }
    ),
  },
}
