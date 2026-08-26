import { GraphQLError } from "graphql"
import { Types, type PipelineStage } from "mongoose"
import Register from "../models/register.model"
import RegisterSession from "../models/registerSession.model"
import PaymentMethod from "../models/paymentMethod.model"
import Sale from "../models/sale.model"
import Customer from "../models/customer.model"
import Outlet from "../models/outlet.model"
import { fromCursor, toCursor } from "../helpers/cursor"

const REGISTER_SESSION_CURSOR_TYPE = "registerSession"

const fullName = (u: any) =>
  `${u?.name || ""} ${u?.surname || ""}`.trim() || "-"

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

  // Settlements are repayments of older sales, so they don't appear in the
  // shift's own sales - but the cash was handed over at this drawer, so the
  // closure tally has to expect it. Matched on the session, not a date range,
  // so a settlement always belongs to exactly one shift.
  const settlementPipeline: PipelineStage[] = [
    { $match: { "settlements.register": new Types.ObjectId(registerDoc._id) } },
    { $unwind: "$settlements" },
    {
      $match: {
        "settlements.date": { $gte: start, $lte: end },
        "settlements.method": {
          $in: tallyMethodIds.map((id: string) => new Types.ObjectId(id)),
        },
      },
    },
    {
      $group: {
        _id: "$settlements.method",
        expected: { $sum: "$settlements.amount" },
      },
    },
  ]

  const [[facets], settlementTotals, newCustomers, methodDocs] =
    await Promise.all([
      Sale.aggregate(pipeline),
      Sale.aggregate(settlementPipeline),
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
  const expectedById = new Map<string, number>(
    facets.byMethod.map((m: any) => [m._id.toString(), m.expected])
  )
  // Fold this shift's settlements into the same per-method expectations, so a
  // cash repayment shows up in the drawer count instead of reading as an
  // overage at closing time.
  for (const settlement of settlementTotals) {
    const key = settlement._id.toString()
    expectedById.set(key, (expectedById.get(key) || 0) + settlement.expected)
  }

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

// Row builders for the closure tabs. Shared by registerSessionClosureDetail
// and the paged closure* queries so a tab can never disagree with the summary
// printed above it.
const buildPaymentRows = (sales: any[], onAccountId?: string) =>
  sales.flatMap((s: any) =>
    (s.payments || []).map((p: any) => ({
      date: p.date,
      _id: s._id,
      saleNumber: s.saleNumber,
      saleTotal: s.total,
      paymentAmount: p.amount - p.change,
      type: p.method?.name || "-",
      isOnAccount: p.method?._id?.toString() === onAccountId,
      userName: fullName(s.by),
    }))
  )

const buildPaymentDetails = (sales: any[], onAccountId?: string) =>
  sales
    .filter((s: any) => (s.payments || []).length > 0)
    .map((s: any) => {
      const payments = s.payments || []
      return {
        date: payments[0]?.date,
        _id: s._id,
        saleNumber: s.saleNumber,
        saleTotal: s.total,
        paymentAmount: payments.reduce(
          (sum: number, p: any) => sum + (p.amount - p.change),
          0
        ),
        type: [
          ...new Set(payments.map((p: any) => p.method?.name || "-")),
        ].join(", "),
        isOnAccount: payments.some(
          (p: any) => p.method?._id?.toString() === onAccountId
        ),
        userName: fullName(s.by),
      }
    })

const buildTransactions = (sales: any[]) =>
  sales.map((s: any) => ({
    date: s.createdAt,
    _id: s._id,
    saleNumber: s.saleNumber,
    status: s.currentSaleStatus,
    customerName: s.customer?.name || "Walk-in",
    discount: s.discount,
    saleTotal: s.total,
    userName: fullName(s.by),
  }))

const buildTransactionsBySku = (sales: any[]) =>
  sales.flatMap((s: any) =>
    (s.items || []).map((item: any) => ({
      sku: item.product?.sku || "-",
      _id: s._id,
      date: s.createdAt,
      saleNumber: s.saleNumber,
      quantity: item.quantity,
      salesExTax: item.total,
      totalTax: 0,
      salesInc: item.total,
      discountOffers: item.discount * item.quantity,
      orderDiscounts: s.discount,
      saleTotal: s.total,
      payments: [
        ...new Set((s.payments || []).map((p: any) => p.method?.name)),
      ].join(", "),
    }))
  )

const buildCogs = (sales: any[]) => {
  const cogsMap = new Map<string, any>()
  sales.forEach((s: any) => {
    ;(s.items || []).forEach((item: any) => {
      const key = item.product?._id?.toString() || item.snapshotName
      const existing = cogsMap.get(key) || {
        itemName: item.snapshotName,
        sku: item.product?.sku || "-",
        quantitySold: 0,
        salesInc: 0,
        salesExTax: 0,
        purchaseCost: 0,
        retailPrice: item.product?.currentPrice ?? item.snapshotPrice,
      }
      existing.quantitySold += item.quantity
      existing.salesInc += item.total
      existing.salesExTax += item.total
      existing.purchaseCost += (item.product?.cost || 0) * item.quantity
      cogsMap.set(key, existing)
    })
  })
  return Array.from(cogsMap.values())
}

// Same scoping as resolveSummary and registerSessionClosureDetail: sales on
// this register inside the shift window, voided excluded.
const loadShiftSales = async (_id: string) => {
  const session = await RegisterSession.findById(_id).lean()
  if (!session) throw new GraphQLError("Register session not found")
  const registerDoc = await Register.findById(session.register).lean()
  if (!registerDoc) throw new GraphQLError("Register not found")

  const sales = await Sale.find({
    register: registerDoc._id,
    currentSaleStatus: { $ne: "VOIDED" },
    createdAt: {
      $gte: session.openedAt,
      $lte: session.closedAt || new Date(),
    },
  })
    .populate(["customer", "by", "payments.method", "items.product"])
    .sort({ createdAt: 1 })
    .lean()

  return sales
}

// These rows are derived from the shift's sales rather than stored, so the
// whole list is built before it can be cut. Index-based cursor, same client
// contract as the DB-backed tables.
const paginateRows = (rows: any[], first: number, after?: string) => {
  let startIndex = 0
  if (after) {
    const decoded = Number(Buffer.from(after, "base64").toString("utf8"))
    startIndex = Number.isFinite(decoded) && decoded > 0 ? decoded : 0
  }
  const sliced = rows.slice(startIndex, startIndex + first)
  const cursorAt = (index: number) =>
    Buffer.from(String(index), "utf8").toString("base64")
  return {
    total: rows.length,
    pages: Math.ceil(rows.length / first) || 1,
    edges: sliced.map((row: any, index: number) => ({
      node: row,
      cursor: cursorAt(startIndex + index + 1),
    })),
    pageInfo: {
      endCursor: sliced.length ? cursorAt(startIndex + sliced.length) : null,
      hasNextPage: startIndex + first < rows.length,
    },
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
    // Scoped to the caller on purpose: the logout warning is only for the
    // person who left a shift open, not for anyone else signed in.
    myOpenRegisterSessions: async (_: any, __: any, ctx: any) => {
      try {
        if (!ctx.session) return []
        return await RegisterSession.find({
          openedBy: ctx.session._id,
          status: "OPEN",
        })
          .populate(["register", "openedBy"])
          .sort({ openedAt: 1 })
          .lean()
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
    registerSessionClosureDetail: async (_: any, { _id }: any) => {
      try {
        const session = await RegisterSession.findById(_id)
          .populate([
            "openedBy",
            "closedBy",
            "tally.method",
            "cashMovements.by",
          ])
          .lean()
        if (!session) throw new GraphQLError("Register session not found")

        const registerDoc = await Register.findById(session.register).lean()
        if (!registerDoc) throw new GraphQLError("Register not found")
        const outletDoc = registerDoc.outlet
          ? await Outlet.findById(registerDoc.outlet).lean()
          : null

        const start = session.openedAt
        const end = session.closedAt || new Date()
        const onAccountId = process.env.NEXT_PUBLIC_ON_ACCOUNT_ID

        // Same scoping convention as resolveSummary above: sales on this
        // register within the shift's time window, voided sales excluded.
        const sales = await Sale.find({
          register: registerDoc._id,
          currentSaleStatus: { $ne: "VOIDED" },
          createdAt: { $gte: start, $lte: end },
        })
          .populate(["customer", "by", "payments.method", "items.product"])
          .sort({ createdAt: 1 })
          .lean()

        const paymentReceived = sales.reduce(
          (sum, s: any) => sum + s.netAmount,
          0
        )
        const totalSalesInc = sales.reduce((sum, s: any) => sum + s.total, 0)
        const itemDiscounts = sales.reduce(
          (sum, s: any) =>
            sum +
            (s.items || []).reduce(
              (a: number, i: any) => a + i.discount * i.quantity,
              0
            ),
          0
        )
        const orderDiscounts = sales.reduce(
          (sum, s: any) => sum + s.discount,
          0
        )

        // One row per individual payment. The On Account tab is built from
        // this rather than from the grouped rows below, because a split
        // payment only puts *part* of the sale on account - grouping first
        // would report the whole sale total as owed.
        const onAccountSales = buildPaymentRows(sales, onAccountId).filter(
          (p) => p.isOnAccount
        )

        // Payment Details is one row per SALE: a sale settled with more than
        // one tender shows a single line with the methods joined, matching
        // the convention Transaction by SKU already uses for its payments
        // column. paymentAmount is the sale's total net tender, not one
        // method's share - use the Payment Summary tab for per-method totals.
        const paymentDetails = buildPaymentDetails(sales, onAccountId)
        const transactions = buildTransactions(sales)
        const transactionsBySku = buildTransactionsBySku(sales)
        const cogs = buildCogs(sales)

        return {
          _id: session._id,
          registerName: registerDoc.name,
          outletName: outletDoc?.name || "-",
          openedAt: session.openedAt,
          openedByName: fullName(session.openedBy),
          closedAt: session.closedAt,
          closedByName: fullName(session.closedBy),
          paymentReceived,
          refunds: 0,
          netReceipts: paymentReceived,
          totalSalesInc,
          totalSalesEx: totalSalesInc,
          salesTaxCollected: 0,
          itemDiscounts,
          discounts: orderDiscounts,
          surcharge: 0,
          openingFloat: session.openingFloat || 0,
          totalCashIn: (session.cashMovements || [])
            .filter((movement: any) => movement.type === "IN")
            .reduce((sum: number, movement: any) => sum + movement.amount, 0),
          totalCashOut: (session.cashMovements || [])
            .filter((movement: any) => movement.type === "OUT")
            .reduce((sum: number, movement: any) => sum + movement.amount, 0),
          newCustomers: await Customer.countDocuments({
            createdAt: { $gte: start, $lte: end },
          }),
          numberOfTransactions: sales.length,
          avgSaleValue: sales.length ? paymentReceived / sales.length : 0,
          paymentSummary: session.tally || [],
          paymentDetails,
          onAccountSales,
          addsPayouts: session.cashMovements || [],
          transactions,
          transactionsBySku,
          cogs,
        }
      } catch (error) {
        throw error
      }
    },
    closureTransactions: async (_: any, { _id, first = 10, after }: any) => {
      try {
        const sales = await loadShiftSales(_id)
        return paginateRows(buildTransactions(sales), first, after)
      } catch (error) {
        throw error
      }
    },
    closureTransactionsBySku: async (
      _: any,
      { _id, first = 10, after }: any
    ) => {
      try {
        const sales = await loadShiftSales(_id)
        return paginateRows(buildTransactionsBySku(sales), first, after)
      } catch (error) {
        throw error
      }
    },
    closurePaymentDetails: async (
      _: any,
      { _id, first = 10, after, onAccountOnly = false, type }: any
    ) => {
      try {
        const sales = await loadShiftSales(_id)
        const onAccountId = process.env.NEXT_PUBLIC_ON_ACCOUNT_ID
        // On Account is per-payment, Payment Details is per-sale - see the
        // builders for why those two grains differ.
        let rows = onAccountOnly
          ? buildPaymentRows(sales, onAccountId).filter((p) => p.isOnAccount)
          : buildPaymentDetails(sales, onAccountId)
        // A split payment joins its methods ("Gcash, Cash"), so match on
        // membership - an equality test would drop every multi-tender sale.
        if (type)
          rows = rows.filter((r: any) =>
            (r.type || "").split(", ").includes(type)
          )
        return paginateRows(rows, first, after)
      } catch (error) {
        throw error
      }
    },
    closureCogs: async (_: any, { _id, first = 10, after }: any) => {
      try {
        const sales = await loadShiftSales(_id)
        return paginateRows(buildCogs(sales), first, after)
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
