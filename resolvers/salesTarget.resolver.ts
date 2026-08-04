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
        period = "MONTHLY",
        date,
        search,
      }: { period?: string; date?: string; search?: string }
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

        return users
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
