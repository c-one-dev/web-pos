import ActivityLog from "../models/activityLog.model"

// Logs accumulate faster than the other two report tables since every
// successful mutation writes one - capped defensively on top of the
// caller's own date-range narrowing, matching how voidedSaleTable etc.
// bound their result sets.
const MAX_ROWS = 2000

export const activityLogResolver = {
  Query: {
    activityLogTable: async (
      _: any,
      { start, end, search }: { start: string; end: string; search?: string }
    ) => {
      try {
        const rangeStart = new Date(start)
        const rangeEnd = new Date(end)
        const matchStage: Record<string, any> = {
          date: { $gte: rangeStart, $lte: rangeEnd },
        }
        if (search)
          matchStage.$or = [
            { userName: { $regex: search, $options: "i" } },
            { activity: { $regex: search, $options: "i" } },
          ]

        return await ActivityLog.find(matchStage)
          .sort({ date: -1 })
          .limit(MAX_ROWS)
          .lean()
      } catch (error) {
        throw error
      }
    },
  },
}
