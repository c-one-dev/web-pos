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
import Customer from "@/models/customer.model"
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
            { path: "register", populate: { path: "outlet" } },
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
    customerSalesTable: async (
      _: any,
      {
        customer,
        first = 10,
        after,
      }: { customer: string; first?: number; after?: string }
    ) => {
      try {
        const CUSTOMER_SALE_CURSOR_TYPE = "customerSale"
        const customerObjectId = new Types.ObjectId(customer)
        const matchStage: Record<string, any> = { customer: customerObjectId }

        const total = await Sale.countDocuments({ customer: customerObjectId })

        if (after) {
          const { id, type } = fromCursor(after)
          if (type !== CUSTOMER_SALE_CURSOR_TYPE)
            throw new Error("Invalid cursor")
          matchStage._id = { $lt: new Types.ObjectId(id) }
        }

        const pipeline: PipelineStage[] = [
          { $match: matchStage },
          { $sort: { _id: -1 } },
          { $limit: first + 1 },
          {
            $lookup: {
              from: "registers",
              localField: "register",
              foreignField: "_id",
              as: "register",
            },
          },
          { $unwind: { path: "$register", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "outlets",
              localField: "register.outlet",
              foreignField: "_id",
              as: "outlet",
            },
          },
          { $unwind: { path: "$outlet", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              date: "$createdAt",
              outletName: { $ifNull: ["$outlet.name", "-"] },
              paid: {
                $reduce: {
                  input: "$payments",
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $subtract: [
                          "$$this.amount",
                          { $ifNull: ["$$this.change", 0] },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
          {
            $addFields: {
              outstanding: { $max: [{ $subtract: ["$total", "$paid"] }, 0] },
            },
          },
          {
            $project: {
              saleNumber: 1,
              date: 1,
              outletName: 1,
              total: 1,
              paid: 1,
              outstanding: 1,
              currentSaleStatus: 1,
              currentSalePaymentStatus: 1,
            },
          },
        ]

        const result = await Sale.aggregate(pipeline)
        const sliced = result.slice(0, first)
        const edges = sliced.map((edge) => ({
          node: edge,
          cursor: toCursor({
            type: CUSTOMER_SALE_CURSOR_TYPE,
            id: edge._id.toString(),
            value: edge._id.toString(),
          }),
        }))

        return {
          total,
          pages: Math.ceil(total / first),
          edges,
          pageInfo: {
            endCursor: sliced.length
              ? toCursor({
                  type: CUSTOMER_SALE_CURSOR_TYPE,
                  id: sliced[sliced.length - 1]._id.toString(),
                  value: sliced[sliced.length - 1]._id.toString(),
                })
              : null,
            hasNextPage: result.length > first,
          },
        }
      } catch (error) {
        throw error
      }
    },
    voidedSaleTable: async (
      _: any,
      {
        first = 8,
        after,
        search,
        start,
        end,
        sort,
      }: {
        first?: number
        after?: string
        search?: string
        start?: string
        end?: string
        sort?: { key: string; order: "ASC" | "DESC" }
      }
    ) => {
      try {
        const VOIDED_SALE_CURSOR_TYPE = "voidedSale"
        const sortKey = sort?.key || "voidedAt"
        const sortOrder = sort?.order === "ASC" ? 1 : -1

        const baseStages: PipelineStage[] = [
          { $match: { currentSaleStatus: "VOIDED" } },
          {
            $addFields: {
              voidEntry: { $arrayElemAt: ["$saleStatusHistory", -1] },
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "voidEntry.by",
              foreignField: "_id",
              as: "voidedByUser",
            },
          },
          {
            $unwind: {
              path: "$voidedByUser",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "registers",
              localField: "register",
              foreignField: "_id",
              as: "register",
            },
          },
          { $unwind: { path: "$register", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "outlets",
              localField: "register.outlet",
              foreignField: "_id",
              as: "outlet",
            },
          },
          { $unwind: { path: "$outlet", preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              registerName: { $ifNull: ["$register.name", "-"] },
              outletName: { $ifNull: ["$outlet.name", "-"] },
              amount: "$total",
              voidedAt: "$voidEntry.date",
              voidedByName: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$voidedByUser.name", ""] },
                      " ",
                      { $ifNull: ["$voidedByUser.surname", ""] },
                    ],
                  },
                },
              },
            },
          },
          ...(search
            ? [
                {
                  $match: {
                    $or: [
                      { saleNumber: { $regex: search, $options: "i" } },
                      { registerName: { $regex: search, $options: "i" } },
                      { outletName: { $regex: search, $options: "i" } },
                      { voidedByName: { $regex: search, $options: "i" } },
                    ],
                  },
                },
              ]
            : []),
          ...(start && end
            ? [
                {
                  $match: {
                    voidedAt: {
                      $gte: new Date(start),
                      $lte: new Date(end),
                    },
                  },
                },
              ]
            : []),
        ]

        const [countResult] = await Sale.aggregate([
          ...baseStages,
          { $count: "total" },
        ])
        const total = countResult?.total || 0

        const paginationStages: PipelineStage[] = []
        if (after) {
          const { id, type, value } = fromCursor(after)
          if (type !== VOIDED_SALE_CURSOR_TYPE)
            throw new Error("Invalid cursor")
          const cursorId = new Types.ObjectId(id)
          const cursorValue = sortKey === "voidedAt" ? new Date(value) : value
          paginationStages.push({
            $match: {
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
          })
        }

        const result = await Sale.aggregate([
          ...baseStages,
          ...paginationStages,
          { $sort: { [sortKey]: sortOrder, _id: sortOrder } },
          { $limit: first + 1 },
          {
            $project: {
              saleNumber: 1,
              registerName: 1,
              outletName: 1,
              amount: 1,
              voidedAt: 1,
              voidedByName: 1,
            },
          },
        ])

        const sliced = result.slice(0, first)
        const edges = sliced.map((edge: any) => ({
          node: edge,
          cursor: toCursor({
            type: VOIDED_SALE_CURSOR_TYPE,
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
                  type: VOIDED_SALE_CURSOR_TYPE,
                  id: sliced[sliced.length - 1]._id.toString(),
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
            .select("prefix isOpen")
            .lean()
          if (!register) throw new GraphQLError("Register not found")
          if (!register.isOpen)
            throw new GraphQLError(
              "Register is closed. Open the register before processing sales.",
              { extensions: { code: "REGISTER_CLOSED" } }
            )
          const sales = await Sale.find({
            register: input.register,
          })
            .sort({ createdAt: -1 })
            .select("saleNumber")
            .lean()

          const onAccountId = process.env.NEXT_PUBLIC_ON_ACCOUNT_ID
          const storeCreditId = process.env.NEXT_PUBLIC_STORE_CREDIT_ID
          const netPaymentAmount = (payment: any) =>
            payment.amount - (payment.change || 0)
          const onAccountTotal = input.payments
            .filter((payment: any) => payment.method === onAccountId)
            .reduce(
              (sum: number, payment: any) => sum + netPaymentAmount(payment),
              0
            )
          const storeCreditTotal = input.payments
            .filter((payment: any) => payment.method === storeCreditId)
            .reduce(
              (sum: number, payment: any) => sum + netPaymentAmount(payment),
              0
            )

          let populatedResult
          await session.withTransaction(async () => {
            let customer: any = null
            if (onAccountTotal > 0 || storeCreditTotal > 0) {
              if (!input.customer)
                throw new GraphQLError(
                  "A customer must be selected to use On Account or Store Credit.",
                  { extensions: { code: "CUSTOMER_REQUIRED" } }
                )
              customer = await Customer.findById(input.customer)
                .select("accountLimit storeCredit")
                .session(session)
                .lean()
              if (!customer) throw new GraphQLError("Customer not found.")
              if (onAccountTotal > customer.accountLimit.current)
                throw new GraphQLError(
                  "On Account amount exceeds the customer's available account limit.",
                  { extensions: { code: "INSUFFICIENT_BALANCE" } }
                )
              if (storeCreditTotal > customer.storeCredit.current)
                throw new GraphQLError(
                  "Store Credit amount exceeds the customer's available store credit.",
                  { extensions: { code: "INSUFFICIENT_BALANCE" } }
                )
            }

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
              isOnAccount: onAccountTotal > 0,
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

            if (customer && onAccountTotal > 0) {
              await Customer.updateOne(
                { _id: customer._id },
                {
                  $inc: { "accountLimit.current": -onAccountTotal },
                  $push: {
                    "accountLimit.history": {
                      remaining: customer.accountLimit.current - onAccountTotal,
                      transacted: -onAccountTotal,
                      date: new Date(),
                    },
                  },
                },
                { session }
              )
            }
            if (customer && storeCreditTotal > 0) {
              await Customer.updateOne(
                { _id: customer._id },
                {
                  $inc: { "storeCredit.current": -storeCreditTotal },
                  $push: {
                    "storeCredit.history": {
                      remaining:
                        customer.storeCredit.current - storeCreditTotal,
                      transacted: -storeCreditTotal,
                      date: new Date(),
                      description: `Applied to sale ${newSale.saleNumber}`,
                    },
                  },
                },
                { session }
              )
            }

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
    voidSale: async (_: any, { _id }: any, ctx: any) => {
      try {
        const result = await Sale.findOneAndUpdate(
          { _id, currentSaleStatus: { $ne: "VOIDED" } },
          {
            $set: { currentSaleStatus: "VOIDED" },
            $push: {
              saleStatusHistory: {
                status: "VOIDED",
                date: new Date(),
                by: ctx.session._id,
              },
            },
          },
          { returnDocument: "after" }
        )
          .select("_id saleNumber currentSaleStatus")
          .lean()
        if (!result) {
          const existing = await Sale.findById(_id)
            .select("currentSaleStatus")
            .lean()
          if (!existing) throw new GraphQLError("Sale not found")
          throw new GraphQLError("Sale is already voided.")
        }
        return {
          ok: true,
          message: `Sale ${result.saleNumber} voided successfully.`,
          data: {
            _id: result._id,
            currentSaleStatus: result.currentSaleStatus,
          },
        }
      } catch (error) {
        throw error
      }
    },
  },
}
