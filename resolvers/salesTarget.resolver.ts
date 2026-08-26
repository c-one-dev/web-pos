import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns"
import Sale from "../models/sale.model"
import SalesTarget from "../models/salesTarget.model"
import User from "../models/user.model"
import { fromCursor, toCursor } from "../helpers/cursor"

const CURSOR_TYPE = "salesTarget"

const rangeForPeriod = (period: string, date: Date) => {
  switch (period) {
    case "WEEKLY":
      return { start: startOfWeek(date), end: endOfWeek(date) }
    case "MONTHLY":
      return { start: startOfMonth(date), end: endOfMonth(date) }
    default:
      return { start: startOfDay(date), end: endOfDay(date) }
  }
}

export const salesTargetResolver = {
  Query: {
    salesTargetTable: async (
      _: any,
      {
        first = 10,
        after,
        period = "MONTHLY",
        date,
        search,
      }: {
        first?: number
        after?: string
        period?: string
        date?: string
        search?: string
      }
    ) => {
      try {
        const { start, end } = rangeForPeriod(
          period,
          date ? new Date(date) : new Date()
        )

        const [users, salesTotals, targets] = await Promise.all([
          User.find({ isActive: true }).select("_id name surname").lean(),
          Sale.aggregate([
            {
              $match: {
                currentSaleStatus: { $ne: "VOIDED" },
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $group: {
                _id: "$by",
                totalSalesCount: { $sum: 1 },
                totalSales: { $sum: "$netAmount" },
              },
            },
          ]),
          SalesTarget.find({ period }).lean(),
        ])

        const salesByUser = new Map(
          salesTotals.map((s: any) => [s._id.toString(), s])
        )
        const targetByUser = new Map(
          targets.map((t: any) => [t.user.toString(), t.target])
        )

        const rows = users
          .map((u: any) => {
            const sales = salesByUser.get(u._id.toString())
            const target = targetByUser.get(u._id.toString()) || 0
            const totalSales = sales?.totalSales || 0
            return {
              _id: u._id,
              userName: `${u.name} ${u.surname}`.trim(),
              totalSalesCount: sales?.totalSalesCount || 0,
              totalSales,
              target,
              achievedPercent: target > 0 ? (totalSales / target) * 100 : 0,
            }
          })
          .filter(
            (r: any) =>
              !search || r.userName.toLowerCase().includes(search.toLowerCase())
          )
          .sort((a: any, b: any) => a.userName.localeCompare(b.userName))

        // These rows are derived (active users joined to sale aggregates and
        // targets), not a stored collection, so the whole set has to be built
        // before it can be cut. Paging happens over that computed list, which
        // keeps the client contract identical to the DB-backed tables.
        const total = rows.length
        let startIndex = 0
        if (after) {
          const { id, type } = fromCursor(after)
          if (type !== CURSOR_TYPE) throw new Error("Invalid cursor")
          const found = rows.findIndex((r: any) => r._id.toString() === id)
          // A cursor whose row vanished (user deactivated between pages)
          // restarts rather than throwing - the alternative is a dead table.
          startIndex = found === -1 ? 0 : found + 1
        }

        const sliced = rows.slice(startIndex, startIndex + first)
        const edges = sliced.map((row: any) => ({
          node: row,
          cursor: toCursor({
            type: CURSOR_TYPE,
            id: row._id.toString(),
            value: row.userName,
          }),
        }))

        return {
          total,
          pages: Math.ceil(total / first),
          edges,
          pageInfo: {
            endCursor: sliced.length
              ? toCursor({
                  type: CURSOR_TYPE,
                  id: sliced[sliced.length - 1]._id.toString(),
                  value: sliced[sliced.length - 1].userName,
                })
              : null,
            hasNextPage: startIndex + first < total,
          },
        }
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    setSalesTarget: async (_: any, { user, period, target }: any) => {
      try {
        const updated = await SalesTarget.findOneAndUpdate(
          { user, period },
          { $set: { target } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean()

        return { ok: true, message: "Sales target updated.", data: updated }
      } catch (error) {
        throw error
      }
    },
  },
}
