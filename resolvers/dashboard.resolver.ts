import Sale from "../models/sale.model"
import Customer from "../models/customer.model"
import { startOfDay, endOfDay, format, differenceInCalendarDays } from "date-fns"
import type { PipelineStage } from "mongoose"

// Bucket the Sales tab by day for short ranges, month for multi-month
// ranges, and year once the range spans more than a year - otherwise an
// "All time" range would render as thousands of unreadable daily bars.
const resolveDateGranularity = (start: Date, end: Date) => {
  const spanDays = differenceInCalendarDays(end, start) + 1
  if (spanDays <= 31) return "day" as const
  if (spanDays <= 366) return "month" as const
  return "year" as const
}

const DATE_FORMAT_BY_GRANULARITY = {
  day: "%Y-%m-%d",
  month: "%Y-%m",
  year: "%Y",
} as const

const formatDateBucketLabel = (
  granularity: "day" | "month" | "year",
  key: string
) => {
  switch (granularity) {
    case "day":
      return format(new Date(`${key}T00:00:00`), "MMM d")
    case "month":
      return format(new Date(`${key}-01T00:00:00`), "MMM yyyy")
    case "year":
      return key
  }
}

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

const paymentBreakdown = () => ({
  count: { $sum: 1 },
  paid: {
    $sum: {
      $cond: [{ $eq: ["$currentSalePaymentStatus", "PAID"] }, "$netAmount", 0],
    },
  },
  unpaid: {
    $sum: {
      $cond: [
        { $eq: ["$currentSalePaymentStatus", "UNPAID"] },
        "$netAmount",
        0,
      ],
    },
  },
  partiallyPaid: {
    $sum: {
      $cond: [
        { $eq: ["$currentSalePaymentStatus", "PARTIALLY_PAID"] },
        "$netAmount",
        0,
      ],
    },
  },
})

export const dashboardResolver = {
  Query: {
    dashboardSummary: async (
      _: any,
      { start, end, timezone }: { start: string; end: string; timezone?: string }
    ) => {
      try {
        const tz = timezone || "UTC"
        const rangeStart = startOfDay(new Date(start))
        const rangeEnd = endOfDay(new Date(end))
        const dateGranularity = resolveDateGranularity(rangeStart, rangeEnd)
        const matchStage = {
          currentSaleStatus: { $ne: "VOIDED" },
          createdAt: {
            $gte: rangeStart,
            $lte: rangeEnd,
          },
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
                    totalTransactions: { $sum: 1 },
                  },
                },
              ],
              byDate: [
                {
                  $group: {
                    _id: {
                      $dateToString: {
                        format: DATE_FORMAT_BY_GRANULARITY[dateGranularity],
                        date: "$createdAt",
                        timezone: tz,
                      },
                    },
                    total: { $sum: "$netAmount" },
                    ...paymentBreakdown(),
                  },
                },
                { $sort: { _id: 1 } },
              ],
              byHour: [
                {
                  $group: {
                    _id: { $hour: { date: "$createdAt", timezone: tz } },
                    total: { $sum: "$netAmount" },
                    ...paymentBreakdown(),
                  },
                },
                { $sort: { _id: 1 } },
              ],
              byWeekday: [
                {
                  $group: {
                    _id: { $dayOfWeek: { date: "$createdAt", timezone: tz } },
                    total: { $sum: "$netAmount" },
                  },
                },
                { $sort: { _id: 1 } },
              ],
              byTeam: [
                {
                  $group: {
                    _id: "$by",
                    total: { $sum: "$netAmount" },
                  },
                },
                {
                  $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user",
                  },
                },
                {
                  $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                { $sort: { total: -1 } },
              ],
              byProductType: [
                { $unwind: "$items" },
                {
                  $lookup: {
                    from: "products",
                    localField: "items.product",
                    foreignField: "_id",
                    as: "product",
                  },
                },
                {
                  $unwind: {
                    path: "$product",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                {
                  $lookup: {
                    from: "product_types",
                    localField: "product.type",
                    foreignField: "_id",
                    as: "productType",
                  },
                },
                {
                  $unwind: {
                    path: "$productType",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                {
                  $group: {
                    _id: { $ifNull: ["$productType.name", "Uncategorized"] },
                    total: { $sum: "$items.total" },
                  },
                },
                { $sort: { total: -1 } },
              ],
            },
          },
        ]

        const [[facets], newCustomers] = await Promise.all([
          Sale.aggregate(pipeline),
          Customer.countDocuments({
            createdAt: {
              $gte: rangeStart,
              $lte: rangeEnd,
            },
          }),
        ])

        const totals = facets.totals[0] || {
          totalSales: 0,
          totalTransactions: 0,
        }

        return {
          totalSales: totals.totalSales,
          totalTransactions: totals.totalTransactions,
          avgSaleValue: totals.totalTransactions
            ? totals.totalSales / totals.totalTransactions
            : 0,
          newCustomers,
          salesByDateGranularity: dateGranularity,
          salesByDate: facets.byDate.map((point: any) => ({
            key: point._id,
            label: formatDateBucketLabel(dateGranularity, point._id),
            total: point.total,
            count: point.count,
            paid: point.paid,
            unpaid: point.unpaid,
            partiallyPaid: point.partiallyPaid,
          })),
          salesByHour: Array.from({ length: 24 }, (_, hour) => {
            const point = facets.byHour.find((p: any) => p._id === hour)
            return {
              key: String(hour),
              label:
                hour === 0
                  ? "12 am"
                  : hour < 12
                    ? `${hour} am`
                    : hour === 12
                      ? "12 pm"
                      : `${hour - 12} pm`,
              total: point?.total || 0,
              count: point?.count || 0,
              paid: point?.paid || 0,
              unpaid: point?.unpaid || 0,
              partiallyPaid: point?.partiallyPaid || 0,
            }
          }),
          salesByWeekday: WEEKDAY_LABELS.map((label, index) => {
            const point = facets.byWeekday.find((p: any) => p._id === index + 1)
            return {
              key: String(index + 1),
              label,
              total: point?.total || 0,
            }
          }),
          salesByProductType: facets.byProductType.map((point: any) => ({
            key: point._id,
            label: point._id,
            total: point.total,
          })),
          salesByTeam: facets.byTeam.map((point: any) => ({
            key: point._id?.toString() || "unknown",
            label: point.user?.displayName || "Unknown",
            image: point.user?.image || null,
            total: point.total,
          })),
        }
      } catch (error) {
        throw error
      }
    },
  },
}
