import { GraphQLError } from "graphql"
import Payment from "../models/payment.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { isISOString } from "../helpers/isoString"
import Sale from "../models/sale.model"
import PaymentMethod from "../models/paymentMethod.model"

const CURSOR_TYPE = "payment"

const generateNode = (payment: any) => ({
  _id: payment._id,
  amount: payment.amount - payment.change,
  note: payment.note,
  byName: `${payment.by.name} ${payment.by.surname}`,
  saleList: payment.sale.map((s: any) => s.saleNumber),
  methodName: payment.method.name,
  paymentDate: payment.date,
})

export const paymentResolver = {
  Query: {
    payment: async (_: any, { _id }: any) => {
      try {
        const payment = await Payment.findById(_id)
          .populate("method by sale")
          .lean()
        if (!payment) throw new GraphQLError("Payment not found")
        return payment
      } catch (error) {
        throw error
      }
    },
    paymentTable: async (
      _: any,
      { first = 10, after, search, filter, sort }: IDataTableArgs
    ) => {
      try {
        const matchStage: Record<string, any> = {}

        if (search)
          matchStage.$or = [
            { note: { $regex: search, $options: "i" } },
            { byName: { $regex: search, $options: "i" } },
            { methodName: { $regex: search, $options: "i" } },
            { "sale.saleNumber": { $regex: search, $options: "i" } },
            { amount: isNaN(Number(search)) ? undefined : Number(search) },
          ]

        if (filter && filter.length > 0)
          matchStage.$and = filter.map(({ type, key, value }) => {
            switch (type) {
              case "TEXT":
              case "SELECT":
                if (key === "methodName")
                  return { "method._id": new Types.ObjectId(value) }
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
        const total = await Payment.countDocuments(matchStage)

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
              from: "payment_methods",
              localField: "method",
              foreignField: "_id",
              as: "method",
            },
          },
          {
            $unwind: {
              path: "$method",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "sales",
              localField: "sale",
              foreignField: "_id",
              as: "sale",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "by",
              foreignField: "_id",
              as: "by",
            },
          },
          {
            $unwind: {
              path: "$by",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $addFields: {
              amount: {
                $subtract: ["$amount", "$change"],
              },
              paymentDate: "$date",
              methodName: "$method.name",
              byName: {
                $concat: ["$by.name", " ", "$by.surname"],
              },
              saleList: {
                $map: {
                  input: "$sale",
                  as: "s",
                  in: "$$s.saleNumber",
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
              _id: 1,
              amount: 1,
              note: 1,
              paymentDate: 1,
              methodName: 1,
              byName: 1,
              saleList: 1,
            },
          },
        ]

        const result = await Payment.aggregate(pipeline)
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
    paymentSummary: async (
      _: any,
      { start, end }: { start: string; end: string }
    ) => {
      try {
        const rangeStart = startOfDay(new Date(start))
        const rangeEnd = endOfDay(new Date(end))

        const [totals] = await Sale.aggregate([
          {
            $match: {
              currentSaleStatus: { $ne: "VOIDED" },
              createdAt: { $gte: rangeStart, $lte: rangeEnd },
            },
          },
          {
            $group: {
              _id: null,
              salesEx: { $sum: "$subTotal" },
              discounts: { $sum: "$discount" },
            },
          },
        ])

        const salesEx = totals?.salesEx || 0
        const discounts = totals?.discounts || 0
        const refunds = 0 // No refund logic exists in this app.

        return {
          salesInc: salesEx, // No tax concept, so Inc/Ex are equal.
          salesEx,
          refunds,
          discounts,
          netSales: salesEx - discounts - refunds,
        }
      } catch (error) {
        throw error
      }
    },
    paymentTypeSummary: async (
      _: any,
      { start, end }: { start: string; end: string }
    ) => {
      try {
        const rangeStart = startOfDay(new Date(start))
        const rangeEnd = endOfDay(new Date(end))

        const [methods, totals] = await Promise.all([
          PaymentMethod.find().select("_id name").sort({ name: 1 }).lean(),
          Sale.aggregate([
            {
              $match: {
                currentSaleStatus: { $ne: "VOIDED" },
                createdAt: { $gte: rangeStart, $lte: rangeEnd },
              },
            },
            { $unwind: "$payments" },
            {
              $group: {
                _id: "$payments.method",
                totalCollected: {
                  $sum: {
                    $subtract: [
                      "$payments.amount",
                      { $ifNull: ["$payments.change", 0] },
                    ],
                  },
                },
              },
            },
          ]),
        ])

        const totalsByMethod = new Map(
          totals.map((total: any) => [
            total._id.toString(),
            total.totalCollected,
          ])
        )

        return methods.map((method: any) => {
          const totalCollected = totalsByMethod.get(method._id.toString()) || 0
          const refunds = 0 // No refund logic exists in this app.
          return {
            _id: method._id,
            name: method.name,
            totalCollected,
            refunds,
            net: totalCollected - refunds,
          }
        })
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    updatePaymentNote: async (_: any, { _id, note }: any) => {
      try {
        const payment = await Payment.findByIdAndUpdate(
          _id,
          { note },
          { returnDocument: "after" }
        )
          .populate("method by sale")
          .lean()
        // Update corresponding note in sales payments array
        await Sale.updateMany(
          {
            "payments.payment": new Types.ObjectId(_id),
          },
          { $set: { "payments.$.note": note } }
        )
        if (!payment) throw new GraphQLError("Payment not found")
        return {
          ok: true,
          message: "Payment note and its references updated successfully.",
          data: generateNode(payment),
        }
      } catch (error) {
        throw error
      }
    },
  },
}
