import { GraphQLError } from "graphql"
import Sale from "../models/sale.model"
import mongoose, { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import {
  saleSchema,
  updateSaleNotesSchema,
  refundSaleItemsSchema,
  settleSalesSchema,
} from "../validators/sale.validator"
import { isISOString } from "../helpers/isoString"
import Register from "@/models/register.model"
import RegisterSession from "@/models/registerSession.model"
import Payment from "@/models/payment.model"
import Customer from "@/models/customer.model"
import { checkSalesPaymentStatus, outstandingAmount } from "@/helpers/salesFn"
import PaymentMethod from "@/models/paymentMethod.model"

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

const netPaymentAmount = (payment: any) =>
  payment.amount - (payment.change || 0)

// Sum of net (tendered minus change) amounts for whichever payment method
// is passed - used to work out how much a sale draws from a customer's
// account limit or store credit, both when applying and when reversing.
const totalForMethod = (payments: any[], methodId?: string) => {
  if (!methodId) return 0
  return (payments || [])
    .filter((payment: any) => {
      const method = payment.method?._id || payment.method
      return method?.toString() === methodId
    })
    .reduce((sum: number, payment: any) => sum + netPaymentAmount(payment), 0)
}

// A sale may only be edited while the shift it belongs to is still open.
// Once a register session closes it freezes a permanent expected/counted
// tally computed from these sales, so retroactively changing one would make
// that reconciliation record no longer add up.
const assertSaleIsEditable = async (sale: any, session?: any) => {
  if (sale.currentSaleStatus === "VOIDED")
    throw new GraphQLError("A voided sale can no longer be edited.", {
      extensions: { code: "SALE_VOIDED" },
    })

  // Editing rewrites the whole item list, which would orphan the per-item
  // refund quantities a refund recorded against those exact lines. Once any
  // store credit has been issued against a sale, its contents are frozen.
  if ((sale.refundedAmount || 0) > 0)
    throw new GraphQLError(
      "This sale has already been refunded as store credit, so its items can no longer be edited.",
      { extensions: { code: "SALE_REFUNDED" } }
    )

  const query = RegisterSession.findOne({
    register: sale.register,
    status: "OPEN",
    openedAt: { $lte: sale.createdAt },
  })
  const openShift = await (session ? query.session(session) : query).lean()

  if (!openShift)
    throw new GraphQLError(
      "This sale belongs to a register shift that has already been closed, so it can no longer be edited.",
      { extensions: { code: "SHIFT_CLOSED" } }
    )
}

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

        // Resolved here rather than in the client so the Edit affordance
        // matches exactly what updateSale would allow - see
        // assertSaleIsEditable for the rules.
        const isEditable = await assertSaleIsEditable({
          ...sale,
          register: (sale.register as any)?._id || sale.register,
        })
          .then(() => true)
          .catch(() => false)

        return {
          ...sale,
          isEditable,
          outstandingAmount: outstandingAmount(
            sale.payments,
            sale.settledAmount || 0
          ),
        }
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
                    $gte: start,
                    $lte: end,
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
        // Snapshot the filter-only match before the cursor block below
        // mutates matchStage - the total must reflect the whole filtered
        // set, not just the page after the cursor.
        const filterMatchStage = { ...matchStage }

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

        // The filter can target computed/aliased fields (date, customerName,
        // saleTotal, paymentNotes) that only exist once $addFields has run,
        // so both the count and the page query have to go through these
        // stages - Sale.countDocuments on the raw collection would silently
        // match nothing and report a total of 0.
        const baseStages: PipelineStage[] = [
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
        ]

        const [countResult] = await Sale.aggregate([
          ...baseStages,
          { $match: filterMatchStage },
          { $count: "total" },
        ])
        const total = countResult?.total || 0

        const pipeline: PipelineStage[] = [
          ...baseStages,
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
        const onAccountObjectId = process.env.NEXT_PUBLIC_ON_ACCOUNT_ID
          ? new Types.ObjectId(process.env.NEXT_PUBLIC_ON_ACCOUNT_ID)
          : null
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
              // An On Account tender is a debt, not money received, so it
              // doesn't count as paid until it's settled (helpers/salesFn.ts
              // applies the same rule for the status badge).
              paid: {
                $add: [
                  {
                    $reduce: {
                      input: {
                        $filter: {
                          input: "$payments",
                          as: "payment",
                          cond: onAccountObjectId
                            ? {
                                $ne: ["$$payment.method", onAccountObjectId],
                              }
                            : true,
                        },
                      },
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
                  { $ifNull: ["$settledAmount", 0] },
                ],
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
    customerOutstandingSales: async (_: any, { customer }: any) => {
      try {
        const sales = await Sale.find({
          customer: new Types.ObjectId(customer),
          currentSaleStatus: { $ne: "VOIDED" },
          isOnAccount: true,
        })
          .select(
            "saleNumber createdAt total payments settledAmount currentSalePaymentStatus"
          )
          .sort({ createdAt: 1 })
          .lean()

        // Filtered in JS rather than the query because what's still owed
        // depends on which tenders were On Account - the same rule the status
        // badge uses, kept in one place (helpers/salesFn.ts).
        return sales
          .map((sale: any) => ({
            _id: sale._id,
            saleNumber: sale.saleNumber,
            date: sale.createdAt,
            total: sale.total,
            settledAmount: sale.settledAmount || 0,
            outstandingAmount: outstandingAmount(
              sale.payments,
              sale.settledAmount || 0
            ),
            currentSalePaymentStatus: sale.currentSalePaymentStatus,
          }))
          .filter((sale: any) => sale.outstandingAmount > 0)
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
          const onAccountTotal = totalForMethod(input.payments, onAccountId)
          const storeCreditTotal = totalForMethod(input.payments, storeCreditId)

          // Change retained as store credit. The cash never leaves the
          // drawer, so the sale must record no change and a net equal to the
          // full tender - otherwise the shift would expect less cash than is
          // physically there. The customer is owed the difference as credit.
          const creditedChange =
            input.changeToStoreCredit && input.changeAmount > 0
              ? input.changeAmount
              : 0
          if (creditedChange > 0 && !input.customer)
            throw new GraphQLError(
              "A customer must be selected to keep the change as store credit.",
              { extensions: { code: "CUSTOMER_REQUIRED" } }
            )
          // Zero the change on the tenders themselves so the sale, its Payment
          // documents and the shift tally all agree nothing was handed back.
          const effectivePayments =
            creditedChange > 0
              ? input.payments.map((payment: any) => ({
                  ...payment,
                  change: 0,
                }))
              : input.payments

          let populatedResult
          await session.withTransaction(async () => {
            let customer: any = null
            if (
              onAccountTotal > 0 ||
              storeCreditTotal > 0 ||
              creditedChange > 0
            ) {
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
              effectivePayments.map((payment: any) => ({
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
              changeAmount: creditedChange > 0 ? 0 : input.changeAmount,
              netAmount:
                creditedChange > 0 ? input.receivedAmount : input.netAmount,
              changeToStoreCredit: creditedChange > 0,
              changeCreditedAmount: creditedChange,
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
            // Change kept on account. Netted against any store credit spent on
            // this same sale so the running "remaining" stays truthful when a
            // customer both spends credit and leaves change in one visit.
            if (customer && creditedChange > 0) {
              const balanceBefore =
                customer.storeCredit.current - storeCreditTotal
              await Customer.updateOne(
                { _id: customer._id },
                {
                  $inc: { "storeCredit.current": creditedChange },
                  $push: {
                    "storeCredit.history": {
                      remaining: balanceBefore + creditedChange,
                      transacted: creditedChange,
                      date: new Date(),
                      description: `Change kept from sale ${newSale.saleNumber}`,
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
    updateSale: validate(checkSchema(saleSchema))(
      async (_: any, { _id, input }: any, ctx: any) => {
        const session = await mongoose.startSession()
        try {
          if (!ctx.session)
            throw new GraphQLError("Unauthorized", {
              extensions: { code: "UNAUTHORIZED" },
            })

          const existing = await Sale.findById(_id)
            .select(
              "saleNumber register customer payments currentSaleStatus createdAt"
            )
            .lean()
          if (!existing) throw new GraphQLError("Sale not found")
          await assertSaleIsEditable(existing)

          const register = await Register.findById(existing.register)
            .select("isOpen")
            .lean()
          if (!register) throw new GraphQLError("Register not found")
          if (!register.isOpen)
            throw new GraphQLError(
              "Register is closed. Open the register before editing sales.",
              { extensions: { code: "REGISTER_CLOSED" } }
            )

          // Payments carry over into an edit so the cashier only collects
          // the difference - but that means trimming a sale down can leave
          // more tendered than the sale is now worth. There's no refund
          // mechanism to hand the excess back, so refuse rather than mark it
          // PAID and silently lose track of money owed to the customer.
          const netTendered = (input.payments || []).reduce(
            (sum: number, payment: any) => sum + netPaymentAmount(payment),
            0
          )
          if (netTendered - input.total > 0.001)
            throw new GraphQLError(
              `This sale now totals ${input.total.toFixed(2)} but ${netTendered.toFixed(2)} has been tendered. Remove or reduce a payment to match the new total, or void the sale instead.`,
              { extensions: { code: "OVERPAYMENT" } }
            )

          const onAccountId = process.env.NEXT_PUBLIC_ON_ACCOUNT_ID
          const storeCreditId = process.env.NEXT_PUBLIC_STORE_CREDIT_ID

          // What the sale currently draws from the customer, so it can be
          // handed back before the new figures are applied.
          const previousOnAccount = totalForMethod(
            existing.payments,
            onAccountId
          )
          const previousStoreCredit = totalForMethod(
            existing.payments,
            storeCreditId
          )
          const previousCustomerId = existing.customer?.toString() || null

          const onAccountTotal = totalForMethod(input.payments, onAccountId)
          const storeCreditTotal = totalForMethod(input.payments, storeCreditId)

          let populatedResult
          await session.withTransaction(async () => {
            // 1. Reverse the balances the original sale consumed. Done
            //    first (and against the sale's *original* customer, which
            //    the edit may have changed) so the availability check below
            //    sees a true picture.
            if (previousCustomerId && previousOnAccount > 0) {
              const previous = await Customer.findById(previousCustomerId)
                .select("accountLimit")
                .session(session)
                .lean()
              if (previous)
                await Customer.updateOne(
                  { _id: previousCustomerId },
                  {
                    $inc: { "accountLimit.current": previousOnAccount },
                    $push: {
                      "accountLimit.history": {
                        remaining:
                          previous.accountLimit.current + previousOnAccount,
                        transacted: previousOnAccount,
                        date: new Date(),
                        description: `Reversed for edit of sale ${existing.saleNumber}`,
                      },
                    },
                  },
                  { session }
                )
            }
            if (previousCustomerId && previousStoreCredit > 0) {
              const previous = await Customer.findById(previousCustomerId)
                .select("storeCredit")
                .session(session)
                .lean()
              if (previous)
                await Customer.updateOne(
                  { _id: previousCustomerId },
                  {
                    $inc: { "storeCredit.current": previousStoreCredit },
                    $push: {
                      "storeCredit.history": {
                        remaining:
                          previous.storeCredit.current + previousStoreCredit,
                        transacted: previousStoreCredit,
                        date: new Date(),
                        description: `Reversed for edit of sale ${existing.saleNumber}`,
                      },
                    },
                  },
                  { session }
                )
            }

            // 2. Validate the new figures against the now-restored balances.
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

            // 3. Replace the payment records outright - the edit may have
            //    added, removed or re-tendered any of them.
            const previousPaymentIds = (existing.payments || [])
              .map((payment: any) => payment.payment)
              .filter(Boolean)
            if (previousPaymentIds.length)
              await Payment.deleteMany(
                { _id: { $in: previousPaymentIds } },
                { session }
              )

            const payments = await Payment.insertMany(
              input.payments.map((payment: any) => ({
                ...payment,
                by: ctx.session._id,
                sale: [_id],
              })),
              { session }
            )

            const paymentStatus = checkSalesPaymentStatus(payments, input.total)
            await Sale.updateOne(
              { _id },
              {
                $set: flatten({
                  ...input,
                  payments: payments.map((payment) => ({
                    method: payment.method,
                    amount: payment.amount,
                    change: payment.change,
                    note: payment.note,
                    date: payment.date,
                    payment: payment._id,
                  })),
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
                }),
                // saleNumber, register, by and createdAt are deliberately
                // left untouched - an edit corrects a sale, it doesn't
                // reissue it under a new number or reassign who rang it up.
              },
              { session }
            )

            // 4. Apply the new draw against the customer.
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
                      description: `Applied to edited sale ${existing.saleNumber}`,
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
                      description: `Applied to edited sale ${existing.saleNumber}`,
                    },
                  },
                },
                { session }
              )
            }

            populatedResult = await Sale.findById(_id)
              .session(session)
              .populate([{ path: "customer" }])
              .lean()
          })

          return {
            ok: true,
            message: `Sale ${existing.saleNumber} updated successfully.`,
            data: generateSaleNode(populatedResult),
          }
        } catch (error) {
          throw error
        } finally {
          await session.endSession()
        }
      }
    ),
    // Repays the On Account debt on one or more sales in a single pass, which
    // is what both the per-sale "Settle" action and the customer's bulk
    // payment drawer call.
    //
    // The money physically arrives at a drawer, so every settlement is stamped
    // with the open register session it was taken in and counted in that
    // shift's closure tally (see registerSession.resolver.ts). That's why an
    // open session is required: without one there'd be no shift to answer for
    // the cash.
    settleSales: validate(checkSchema(settleSalesSchema))(
      async (_: any, { sales, method, register, note }: any, ctx: any) => {
        const session = await mongoose.startSession()
        try {
          let result: any
          await session.withTransaction(async () => {
            const openSession = await RegisterSession.findOne({
              register,
              status: "OPEN",
            })
              .session(session)
              .lean()
            if (!openSession)
              throw new GraphQLError(
                "This register has no open shift. Open the register before taking a settlement, so the payment is counted in a shift.",
                { extensions: { code: "NO_OPEN_SESSION" } }
              )

            const paymentMethod = await PaymentMethod.findById(method)
              .session(session)
              .lean()
            if (!paymentMethod)
              throw new GraphQLError("Payment method not found")
            // Settling with On Account would just move the debt around.
            if (method.toString() === process.env.NEXT_PUBLIC_ON_ACCOUNT_ID)
              throw new GraphQLError(
                "An account balance can't be settled with On Account.",
                { extensions: { code: "INVALID_METHOD" } }
              )

            const now = new Date()
            const settledPerCustomer = new Map<string, number>()
            const settledSales: any[] = []

            for (const entry of sales) {
              const sale = await Sale.findById(entry._id)
                .select(
                  "saleNumber customer payments total settledAmount currentSaleStatus currentSalePaymentStatus"
                )
                .session(session)
                .lean()
              if (!sale)
                throw new GraphQLError(`Sale ${entry._id} was not found.`)
              if (sale.currentSaleStatus === "VOIDED")
                throw new GraphQLError(
                  `Sale ${sale.saleNumber} is voided, so there is nothing to settle.`,
                  { extensions: { code: "SALE_VOIDED" } }
                )

              const alreadySettled = sale.settledAmount || 0
              const outstanding = outstandingAmount(
                sale.payments,
                alreadySettled
              )
              if (outstanding <= 0)
                throw new GraphQLError(
                  `Sale ${sale.saleNumber} has nothing left to settle.`,
                  { extensions: { code: "NOTHING_OUTSTANDING" } }
                )
              const amount = parseFloat(entry.amount.toFixed(2))
              if (amount - outstanding > 0.001)
                throw new GraphQLError(
                  `Sale ${sale.saleNumber} only has ${outstanding.toFixed(2)} outstanding.`,
                  { extensions: { code: "SETTLEMENT_EXCEEDS_OUTSTANDING" } }
                )

              // One Payment document per sale, so settlements show up in the
              // payment reports the same way an original tender does.
              const [payment] = await Payment.create(
                [
                  {
                    amount,
                    change: 0,
                    method,
                    date: now,
                    note: note || `Settlement for ${sale.saleNumber}`,
                    by: ctx.session._id,
                    sale: [sale._id],
                  },
                ],
                { session }
              )

              const nextSettled = parseFloat(
                (alreadySettled + amount).toFixed(2)
              )
              const nextStatus = checkSalesPaymentStatus(
                sale.payments,
                sale.total,
                nextSettled
              )

              // settledAmount goes in the filter so two cashiers settling the
              // same sale at once can't both succeed and overpay it.
              const updated = await Sale.findOneAndUpdate(
                { _id: sale._id, settledAmount: alreadySettled },
                {
                  $set: {
                    settledAmount: nextSettled,
                    currentSalePaymentStatus: nextStatus,
                  },
                  $push: {
                    settlements: {
                      amount,
                      method,
                      payment: payment._id,
                      note: note || "",
                      date: now,
                      by: ctx.session._id,
                      register,
                      registerSession: openSession._id,
                    },
                    salePaymentStatusHistory: {
                      status: nextStatus,
                      paymentRef: payment._id,
                      date: now,
                      by: ctx.session._id,
                    },
                  },
                },
                { returnDocument: "after", session }
              ).lean()
              if (!updated)
                throw new GraphQLError(
                  `Sale ${sale.saleNumber} was settled by someone else just now. Reopen it to see what's left.`,
                  { extensions: { code: "CONFLICT" } }
                )

              const customerId = (
                (sale.customer as any)?._id || sale.customer
              )?.toString()
              if (customerId)
                settledPerCustomer.set(
                  customerId,
                  (settledPerCustomer.get(customerId) || 0) + amount
                )
              settledSales.push({
                _id: updated._id,
                saleNumber: updated.saleNumber,
                settledAmount: updated.settledAmount,
                currentSalePaymentStatus: updated.currentSalePaymentStatus,
              })
            }

            // Repaying frees the credit back up, exactly like
            // settleAccountBalance - and never touches accountLimit.max, since
            // paying a debt doesn't raise the customer's ceiling.
            for (const [customerId, amount] of settledPerCustomer) {
              const customer = await Customer.findById(customerId)
                .select("accountLimit")
                .session(session)
                .lean()
              if (!customer) throw new GraphQLError("Customer not found")
              await Customer.updateOne(
                { _id: customerId },
                {
                  $inc: { "accountLimit.current": amount },
                  $push: {
                    "accountLimit.history": {
                      remaining: customer.accountLimit.current + amount,
                      transacted: amount,
                      date: now,
                      description: `Settlement (${paymentMethod.name})`,
                    },
                  },
                },
                { session }
              )
            }

            const total = [...settledPerCustomer.values()].reduce(
              (sum, amount) => sum + amount,
              0
            )
            result = {
              sales: settledSales,
              total: parseFloat(total.toFixed(2)),
            }
          })

          return {
            ok: true,
            message:
              result.sales.length === 1
                ? `Settled ${result.sales[0].saleNumber}.`
                : `Settled ${result.sales.length} sales.`,
            data: result,
          }
        } catch (error) {
          throw error
        } finally {
          await session.endSession()
        }
      }
    ),
    // Refunds are issued as STORE CREDIT only - no cash ever leaves the
    // drawer and no payment is reversed, so the register tally for the shift
    // that made the sale stays intact. The customer gets the refunded value
    // back as credit they can spend later, which is why a walk-in sale can't
    // be refunded: there is no account to credit.
    //
    // Refunds are per line item and can be taken in several passes, so each
    // item tracks how much of it has already been refunded.
    refundSaleItems: validate(checkSchema(refundSaleItemsSchema))(
      async (_: any, { _id, items, note }: any, ctx: any) => {
        const session = await mongoose.startSession()
        try {
          let result: any
          await session.withTransaction(async () => {
            const sale = await Sale.findById(_id).session(session).lean()
            if (!sale) throw new GraphQLError("Sale not found")
            if (sale.currentSaleStatus === "VOIDED")
              throw new GraphQLError("A voided sale cannot be refunded.", {
                extensions: { code: "FORBIDDEN" },
              })
            if (!sale.customer)
              throw new GraphQLError(
                "A walk-in sale can't be refunded - store credit needs a customer to credit. Add a customer to the sale first, or void it instead.",
                { extensions: { code: "REFUND_NEEDS_CUSTOMER" } }
              )

            // Per-item discounts are already inside item.total; a sale-level
            // discount is not, so spread it across the lines proportionally.
            // Without this, refunding every line would hand back more than
            // the customer actually paid.
            const grossItemTotal = sale.items.reduce(
              (sum: number, item: any) => sum + item.total,
              0
            )
            const discountRatio =
              grossItemTotal > 0 ? sale.total / grossItemTotal : 0

            // Collapse duplicate lines for the same item into one entry.
            const quantityByIndex = new Map<number, number>()
            for (const requested of items)
              quantityByIndex.set(
                requested.itemIndex,
                (quantityByIndex.get(requested.itemIndex) || 0) +
                  requested.quantity
              )

            const refundItems: any[] = []
            let refundAmount = 0
            for (const [itemIndex, quantity] of quantityByIndex) {
              const item = sale.items[itemIndex]
              if (!item)
                throw new GraphQLError(
                  "That item is not part of this sale anymore."
                )
              const remaining = item.quantity - (item.refundedQuantity || 0)
              if (quantity > remaining)
                throw new GraphQLError(
                  "Only " +
                    remaining +
                    ' of "' +
                    item.snapshotName +
                    '" can still be refunded.',
                  { extensions: { code: "REFUND_EXCEEDS_REMAINING" } }
                )
              const amount = parseFloat(
                (
                  (item.total / item.quantity) *
                  quantity *
                  discountRatio
                ).toFixed(2)
              )
              refundAmount += amount
              refundItems.push({
                itemIndex,
                snapshotName: item.snapshotName,
                quantity,
                amount,
              })
            }
            refundAmount = parseFloat(refundAmount.toFixed(2))
            if (refundAmount <= 0)
              throw new GraphQLError("Nothing to refund on this sale.")

            // Belt and braces against rounding drift: a sale can never give
            // back more store credit than it was worth.
            const alreadyRefunded = sale.refundedAmount || 0
            if (alreadyRefunded + refundAmount - sale.total > 0.001)
              throw new GraphQLError(
                "This sale totals " +
                  sale.total.toFixed(2) +
                  " and " +
                  alreadyRefunded.toFixed(2) +
                  " has already been refunded.",
                { extensions: { code: "REFUND_EXCEEDS_TOTAL" } }
              )

            // Claim the refund with the current refunded quantities in the
            // filter, so two cashiers refunding the same line at the same
            // moment can't both succeed and double-credit the customer.
            const setOps: Record<string, any> = {}
            const filter: Record<string, any> = { _id }
            for (const refundItem of refundItems) {
              const already =
                sale.items[refundItem.itemIndex].refundedQuantity || 0
              setOps["items." + refundItem.itemIndex + ".refundedQuantity"] =
                already + refundItem.quantity
              filter["items." + refundItem.itemIndex + ".refundedQuantity"] =
                already
            }

            const fullyRefunded = sale.items.every(
              (item: any, index: number) =>
                (item.refundedQuantity || 0) +
                  (quantityByIndex.get(index) || 0) >=
                item.quantity
            )
            if (fullyRefunded) setOps.currentSaleStatus = "REFUNDED"

            const now = new Date()
            const updated = await Sale.findOneAndUpdate(
              filter,
              {
                $set: setOps,
                $inc: { refundedAmount: refundAmount },
                $push: {
                  refunds: {
                    items: refundItems,
                    amount: refundAmount,
                    note: note || "",
                    date: now,
                    by: ctx.session._id,
                  },
                  ...(fullyRefunded
                    ? {
                        saleStatusHistory: {
                          status: "REFUNDED",
                          date: now,
                          by: ctx.session._id,
                        },
                      }
                    : {}),
                },
              },
              { returnDocument: "after", session }
            ).lean()
            if (!updated)
              throw new GraphQLError(
                "This sale was refunded by someone else just now. Reopen it to see what's left.",
                { extensions: { code: "CONFLICT" } }
              )

            const customerId = (sale.customer as any)?._id || sale.customer
            const customer = await Customer.findById(customerId)
              .select("storeCredit")
              .session(session)
              .lean()
            if (!customer) throw new GraphQLError("Customer not found")

            await Customer.findByIdAndUpdate(
              customerId,
              {
                $inc: { "storeCredit.current": refundAmount },
                $push: {
                  "storeCredit.history": {
                    remaining: customer.storeCredit.current + refundAmount,
                    transacted: refundAmount,
                    date: now,
                    description:
                      "Refund for sale " +
                      sale.saleNumber +
                      (note ? " - " + note : ""),
                  },
                },
              },
              { session }
            )

            result = {
              _id: updated._id,
              saleNumber: updated.saleNumber,
              refundedAmount: updated.refundedAmount,
              currentSaleStatus: updated.currentSaleStatus,
            }
          })

          return {
            ok: true,
            message:
              "Refund issued as store credit for sale " +
              result.saleNumber +
              ".",
            data: result,
          }
        } catch (error) {
          throw error
        } finally {
          await session.endSession()
        }
      }
    ),
    // Notes are the one part of a completed sale that stays editable from the
    // Sale Order dialog - items and payments still go through updateSale and
    // its assertSaleIsEditable rules. A voided sale is a closed record, so its
    // notes are frozen too.
    updateSaleNotes: validate(checkSchema(updateSaleNotesSchema))(
      async (_: any, { _id, notes }: any) => {
        try {
          const sale = await Sale.findById(_id)
            .select("currentSaleStatus")
            .lean()
          if (!sale) throw new GraphQLError("Sale not found")
          if (sale.currentSaleStatus === "VOIDED")
            throw new GraphQLError("A voided sale's notes cannot be changed.", {
              extensions: { code: "FORBIDDEN" },
            })

          const result = await Sale.findByIdAndUpdate(
            _id,
            { $set: { notes: notes ?? "" } },
            { returnDocument: "after" }
          )
            .select("_id saleNumber notes")
            .lean()
          if (!result) throw new GraphQLError("Sale not found")

          return {
            ok: true,
            message: "Sale notes updated successfully.",
            data: {
              _id: result._id,
              saleNumber: result.saleNumber,
              notes: result.notes ?? "",
            },
          }
        } catch (error) {
          throw error
        }
      }
    ),
    voidSale: async (_: any, { _id }: any, ctx: any) => {
      const session = await mongoose.startSession()
      try {
        let result: any
        await session.withTransaction(async () => {
          const existing = await Sale.findById(_id)
            .select("saleNumber customer payments")
            .session(session)
            .lean()
          if (!existing) throw new GraphQLError("Sale not found")

          // Claim the void first so two concurrent requests can't both get
          // past this point and reverse the customer's balance twice.
          result = await Sale.findOneAndUpdate(
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
            { returnDocument: "after", session }
          )
            .select("_id saleNumber currentSaleStatus")
            .lean()
          if (!result) throw new GraphQLError("Sale is already voided.")

          // Cancelling the sale hands back whatever it drew from the
          // customer's account limit / store credit. Cash and other tenders
          // are settled at the drawer, not here - voided sales are already
          // excluded from the register tally and reports.
          const onAccountTotal = totalForMethod(
            existing.payments,
            process.env.NEXT_PUBLIC_ON_ACCOUNT_ID
          )
          const storeCreditTotal = totalForMethod(
            existing.payments,
            process.env.NEXT_PUBLIC_STORE_CREDIT_ID
          )
          if (!existing.customer) return

          if (onAccountTotal > 0) {
            const customer = await Customer.findById(existing.customer)
              .select("accountLimit")
              .session(session)
              .lean()
            if (customer)
              await Customer.updateOne(
                { _id: existing.customer },
                {
                  $inc: { "accountLimit.current": onAccountTotal },
                  $push: {
                    "accountLimit.history": {
                      remaining: customer.accountLimit.current + onAccountTotal,
                      transacted: onAccountTotal,
                      date: new Date(),
                      description: `Reversed - sale ${existing.saleNumber} voided`,
                    },
                  },
                },
                { session }
              )
          }
          if (storeCreditTotal > 0) {
            const customer = await Customer.findById(existing.customer)
              .select("storeCredit")
              .session(session)
              .lean()
            if (customer)
              await Customer.updateOne(
                { _id: existing.customer },
                {
                  $inc: { "storeCredit.current": storeCreditTotal },
                  $push: {
                    "storeCredit.history": {
                      remaining:
                        customer.storeCredit.current + storeCreditTotal,
                      transacted: storeCreditTotal,
                      date: new Date(),
                      description: `Reversed - sale ${existing.saleNumber} voided`,
                    },
                  },
                },
                { session }
              )
          }
        })

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
      } finally {
        await session.endSession()
      }
    },
  },
}
