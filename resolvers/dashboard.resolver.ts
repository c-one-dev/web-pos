import Sale from "../models/sale.model"
import Customer from "../models/customer.model"
import { format } from "date-fns"
import type { PipelineStage } from "mongoose"
import {
  BUSINESS_DAY_START_HOUR,
  BUSINESS_DAY_START_MINUTE,
  BUSINESS_DAY_START_MS,
} from "@/lib/business-day"

// Bucket the Sales tab by day for short ranges, month for multi-month
// ranges, and year once the range spans more than a year - otherwise an
// "All time" range would render as thousands of unreadable daily bars.
// Measured as elapsed time, not calendar days: a range of N business days
// runs 3:01AM to 3:00AM and so touches N+1 calendar dates, which would tip a
// full month over into monthly bars.
const DAY_MS = 24 * 60 * 60 * 1000
const resolveDateGranularity = (start: Date, end: Date) => {
  const spanDays = Math.ceil((end.getTime() - start.getTime()) / DAY_MS)
  if (spanDays <= 31) return "day" as const
  if (spanDays <= 366) return "month" as const
  return "year" as const
}

// A sale's business date: its timestamp pulled back to the day's 3:01AM start,
// so a 2AM or 3:00AM sale groups with the previous day (and weekday).
const BUSINESS_DATE = {
  $subtract: ["$createdAt", BUSINESS_DAY_START_MS],
}

// Clock hours, except the minutes of the start hour that come before the
// day's start (3:00-3:00:59AM). Those close the previous business day, so they
// get their own bucket after 2AM instead of joining the 3AM bar that opens it.
const END_OF_DAY_BUCKET = 24
const HOUR_BUCKET = (tz: string) => ({
  $cond: [
    {
      $and: [
        {
          $eq: [
            { $hour: { date: "$createdAt", timezone: tz } },
            BUSINESS_DAY_START_HOUR,
          ],
        },
        {
          $lt: [
            { $minute: { date: "$createdAt", timezone: tz } },
            BUSINESS_DAY_START_MINUTE,
          ],
        },
      ],
    },
    END_OF_DAY_BUCKET,
    { $hour: { date: "$createdAt", timezone: tz } },
  ],
})

const hourLabel = (hour: number) =>
  hour === 0
    ? "12 am"
    : hour < 12
      ? `${hour} am`
      : hour === 12
        ? "12 pm"
        : `${hour - 12} pm`

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
      {
        start,
        end,
        timezone,
      }: { start: string; end: string; timezone?: string }
    ) => {
      try {
        const tz = timezone || "UTC"
        const rangeStart = new Date(start)
        const rangeEnd = new Date(end)
        const dateGranularity = resolveDateGranularity(rangeStart, rangeEnd)
        const matchStage = {
          currentSaleStatus: { $ne: "VOIDED" },
          // A carried-over receipt was rung up in the previous system, so it
          // is not trade this shop did today - counting one would put money
          // on the dashboard that never crossed this counter, and credit it
          // to whoever ran the import. Sale history and the sales report
          // leave them out for the same reason.
          isImported: { $ne: true },
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
                        date: BUSINESS_DATE,
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
                    _id: HOUR_BUCKET(tz),
                    total: { $sum: "$netAmount" },
                    ...paymentBreakdown(),
                  },
                },
                { $sort: { _id: 1 } },
              ],
              byWeekday: [
                {
                  $group: {
                    _id: {
                      $dayOfWeek: { date: BUSINESS_DATE, timezone: tz },
                    },
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
          // Clock hours in business-day order - 3AM first, the small hours
          // after midnight next, and the closing 3:00AM minute last - so
          // late-night trade reads as the tail of the day it belongs to.
          salesByHour: [
            ...Array.from(
              { length: 24 },
              (_, index) => (index + BUSINESS_DAY_START_HOUR) % 24
            ),
            END_OF_DAY_BUCKET,
          ].map((bucket) => {
            const point = facets.byHour.find((p: any) => p._id === bucket)
            return {
              key: String(bucket),
              label:
                bucket === END_OF_DAY_BUCKET
                  ? `${BUSINESS_DAY_START_HOUR}:00 am`
                  : hourLabel(bucket),
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
