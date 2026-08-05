import { GraphQLError } from "graphql"
import { Types, type PipelineStage } from "mongoose"
import Register from "../models/register.model"
import RegisterSession from "../models/registerSession.model"
import PaymentMethod from "../models/paymentMethod.model"
import Sale from "../models/sale.model"
import Customer from "../models/customer.model"
import { fromCursor, toCursor } from "../helpers/cursor"

const REGISTER_SESSION_CURSOR_TYPE = "registerSession"

const resolveSummary = async (registerDoc: any, session: any) => {
  const start = session.openedAt
  const end = session.closedAt || new Date()
  const onAccountId = process.env.NEXT_PUBLIC_ON_ACCOUNT_ID
  const storeCreditId = process.env.NEXT_PUBLIC_STORE_CREDIT_ID

  const tallyMethodIds: string[] = Array.from(
    new Set(
      (registerDoc.paymentMethods || [])
        .map((id: any) => id.toString())
        .concat(storeCreditId ? [storeCreditId] : []) as string[]
    )
  ).filter((id) => id !== onAccountId)

  const matchStage = {
    register: new Types.ObjectId(registerDoc._id),
    currentSaleStatus: { $ne: "VOIDED" },
    createdAt: { $gte: start, $lte: end },
  }

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalSales: { $sum: "$netAmount" },
              numberOfTransactions: { $sum: 1 },
              orderDiscounts: { $sum: "$discount" },
            },
          },
        ],
        itemDiscounts: [
          { $unwind: "$items" },
          { $group: { _id: null, total: { $sum: "$items.discount" } } },
        ],
        byMethod: [
          { $unwind: "$payments" },
          {
            $match: {
              "payments.method": {
                $in: tallyMethodIds.map((id: string) => new Types.ObjectId(id)),
              },
            },
          },
          {
            $group: {
              _id: "$payments.method",
              expected: {
                $sum: { $subtract: ["$payments.amount", "$payments.change"] },
              },
            },
          },
        ],
        onAccount: onAccountId
          ? [
              { $unwind: "$payments" },
              {
                $match: { "payments.method": new Types.ObjectId(onAccountId) },
              },
              {
                $group: {
                  _id: null,
                  total: {
                    $sum: {
                      $subtract: ["$payments.amount", "$payments.change"],
                    },
                  },
                },
              },
            ]
          : [],
      },
    },
  ]

  const [[facets], newCustomers, methodDocs] = await Promise.all([
    Sale.aggregate(pipeline),
    Customer.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    PaymentMethod.find({ _id: { $in: tallyMethodIds } }).lean(),
  ])

  const totals = facets.totals[0] || {
    totalSales: 0,
    numberOfTransactions: 0,
    orderDiscounts: 0,
  }
  const itemDiscounts = facets.itemDiscounts[0]?.total || 0
  const totalOnAccountSales = facets.onAccount?.[0]?.total || 0
  const methodsById = new Map(methodDocs.map((m: any) => [m._id.toString(), m]))
  const expectedById = new Map(
    facets.byMethod.map((m: any) => [m._id.toString(), m.expected])
  )

  const totalCashIn = (session.cashMovements || [])
    .filter((m: any) => m.type === "IN")
    .reduce((sum: number, m: any) => sum + m.amount, 0)
  const totalCashOut = (session.cashMovements || [])
    .filter((m: any) => m.type === "OUT")
    .reduce((sum: number, m: any) => sum + m.amount, 0)

  return {
    totalSales: totals.totalSales,
    totalOnAccountSales,
    itemDiscounts,
    orderDiscounts: totals.orderDiscounts,
    avgSaleValue: totals.numberOfTransactions
      ? totals.totalSales / totals.numberOfTransactions
      : 0,
    numberOfTransactions: totals.numberOfTransactions,
    newCustomers,
    totalCashIn,
    totalCashOut,
    expectedTotals: tallyMethodIds.map((id) => ({
      method: methodsById.get(id),
      expected: expectedById.get(id) || 0,
      counted: null,
      difference: null,
    })),
  }
}

export const registerSessionResolver = {
  Query: {
    activeRegisterSession: async (_: any, { register }: any) => {
      try {
        const registerDoc = await Register.findById(register).lean()
        if (!registerDoc) throw new GraphQLError("Register not found")
        const session = await RegisterSession.findOne({
          register,
          status: "OPEN",
        })
          .populate(["openedBy", "closedBy", "cashMovements.by"])
          .lean()
        if (!session) return null
        const summary = await resolveSummary(registerDoc, session)
        return { ...session, register: registerDoc, summary }
      } catch (error) {
        throw error
      }
    },
    registerSession: async (_: any, { _id }: any) => {
      try {
        const session = await RegisterSession.findById(_id)
          .populate([
            "register",
            "openedBy",
            "closedBy",
            "tally.method",
            "cashMovements.by",
          ])
          .lean()
        if (!session) throw new GraphQLError("Register session not found")
        const registerId =
          (session.register as any)?._id?.toString() || session.register
        const registerDoc = await Register.findById(registerId).lean()
        const summary = registerDoc
          ? await resolveSummary(registerDoc, session)
          : null
        return { ...session, summary }
      } catch (error) {
        throw error
      }
    },
    registerSessionTable: async (
      _: any,
      {
        first = 8,
        after,
        search,
        start,
        end,
        includeDeleted = false,
        sort,
      }: {
        first?: number
        after?: string
        search?: string
        start?: string
        end?: string
        includeDeleted?: boolean
        sort?: { key: string; order: "ASC" | "DESC" }
      }
    ) => {
      try {
        // Default sort by openedAt, not closedAt - every session has an
        // openedAt (including still-OPEN ones, which have no closedAt at
        // all), so this is the only key that sorts/filters both statuses
        // consistently.
        const sortKey = sort?.key || "openedAt"
        const sortOrder = sort?.order === "ASC" ? 1 : -1

        const baseStages: PipelineStage[] = [
          {
            $lookup: {
              from: "registers",
              localField: "register",
              foreignField: "_id",
              as: "register",
            },
          },
          { $unwind: { path: "$register", preserveNullAndEmptyArrays: true } },
          ...(includeDeleted
            ? []
            : [{ $match: { "register.isActive": true } }]),
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
            $lookup: {
              from: "users",
              localField: "openedBy",
              foreignField: "_id",
              as: "openedByUser",
            },
          },
          {
            $unwind: {
              path: "$openedByUser",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $addFields: {
              registerName: "$register.name",
              outletName: { $ifNull: ["$outlet.name", "-"] },
              openedByName: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$openedByUser.name", ""] },
                      " ",
                      { $ifNull: ["$openedByUser.surname", ""] },
                    ],
                  },
                },
              },
              // Still-OPEN sessions have never had a tally written, so this
              // naturally sums to 0 rather than something misleading - the
              // client shows "-" instead of ₱0.00 whenever status is OPEN.
              expected: { $sum: "$tally.expected" },
              actual: { $sum: "$tally.counted" },
              difference: { $sum: "$tally.difference" },
            },
          },
          ...(search
            ? [
                {
                  $match: {
                    $or: [
                      { registerName: { $regex: search, $options: "i" } },
                      { outletName: { $regex: search, $options: "i" } },
                    ],
                  },
                },
              ]
            : []),
          ...(start && end
            ? [
                {
                  $match: {
                    openedAt: {
                      $gte: new Date(start),
                      $lte: new Date(end),
                    },
                  },
                },
              ]
            : []),
        ]

        const [countResult] = await RegisterSession.aggregate([
          ...baseStages,
          { $count: "total" },
        ])
        const total = countResult?.total || 0

        const paginationStages: PipelineStage[] = []
        if (after) {
          const { id, type, value } = fromCursor(after)
          if (type !== REGISTER_SESSION_CURSOR_TYPE)
            throw new Error("Invalid cursor")
          const cursorId = new Types.ObjectId(id)
          const cursorValue =
            sortKey === "openedAt" || sortKey === "closedAt"
              ? new Date(value)
              : value
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

        const result = await RegisterSession.aggregate([
          ...baseStages,
          ...paginationStages,
          { $sort: { [sortKey]: sortOrder, _id: sortOrder } },
          { $limit: first + 1 },
          {
            $project: {
              registerName: 1,
              outletName: 1,
              openedAt: 1,
              openedByName: 1,
              closedAt: 1,
              status: 1,
              expected: 1,
              actual: 1,
              difference: 1,
            },
          },
        ])

        const sliced = result.slice(0, first)
        const edges = sliced.map((edge: any) => ({
          node: edge,
          cursor: toCursor({
            type: REGISTER_SESSION_CURSOR_TYPE,
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
                  type: REGISTER_SESSION_CURSOR_TYPE,
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
  },
  Mutation: {
    openRegisterSession: async (
      _: any,
      { register, openingFloat }: any,
      ctx: any
    ) => {
      try {
        const existing = await RegisterSession.findOne({
          register,
          status: "OPEN",
        }).lean()
        if (existing)
          throw new GraphQLError("This register already has an open session.")

        const now = new Date()
        const created = await RegisterSession.create({
          register,
          openedBy: ctx.session._id,
          openedAt: now,
          openingFloat,
          cashMovements: [
            {
              type: "IN",
              amount: openingFloat,
              note: "Opening float",
              date: now,
              by: ctx.session._id,
            },
          ],
          status: "OPEN",
        })
        await Register.findByIdAndUpdate(register, { isOpen: true })

        const populated = await RegisterSession.findById(created._id)
          .populate(["register", "openedBy", "cashMovements.by"])
          .lean()

        return {
          ok: true,
          message: "Register opened successfully.",
          data: populated,
        }
      } catch (error) {
        throw error
      }
    },
    addCashMovement: async (_: any, { _id, input }: any, ctx: any) => {
      try {
        const session = await RegisterSession.findById(_id)
        if (!session) throw new GraphQLError("Register session not found")
        if (session.status !== "OPEN")
          throw new GraphQLError("This register session is already closed.")

        session.cashMovements.push({
          type: input.type,
          amount: input.amount,
          note: input.note,
          date: new Date(),
          by: ctx.session._id,
        })
        await session.save()

        const populated = await RegisterSession.findById(_id)
          .populate(["register", "openedBy", "cashMovements.by"])
          .lean()

        return {
          ok: true,
          message: "Cash movement recorded successfully.",
          data: populated,
        }
      } catch (error) {
        throw error
      }
    },
    closeRegisterSession: async (_: any, { _id, input }: any, ctx: any) => {
      try {
        const session = await RegisterSession.findById(_id).lean()
        if (!session) throw new GraphQLError("Register session not found")
        if (session.status !== "OPEN")
          throw new GraphQLError("This register session is already closed.")
        const registerDoc = await Register.findById(session.register).lean()
        if (!registerDoc) throw new GraphQLError("Register not found")

        const closedAt = new Date()
        const summary = await resolveSummary(registerDoc, {
          ...session,
          closedAt,
        })
        const countedByMethod = new Map<string, number>(
          input.tally.map((t: any) => [t.method, t.counted])
        )
        const tally = summary.expectedTotals.map((item: any) => {
          const methodId = item.method._id.toString()
          const counted = countedByMethod.get(methodId) ?? 0
          return {
            method: item.method._id,
            expected: item.expected,
            counted,
            difference: counted - item.expected,
          }
        })

        const updated = await RegisterSession.findByIdAndUpdate(
          _id,
          {
            $set: {
              status: "CLOSED",
              closedBy: ctx.session._id,
              closedAt,
              notes: input.notes,
              tally,
            },
          },
          { returnDocument: "after" }
        )
          .populate([
            "register",
            "openedBy",
            "closedBy",
            "tally.method",
            "cashMovements.by",
          ])
          .lean()

        await Register.findByIdAndUpdate(session.register, { isOpen: false })

        return {
          ok: true,
          message: "Register closed successfully.",
          data: updated,
        }
      } catch (error) {
        throw error
      }
    },
  },
}
