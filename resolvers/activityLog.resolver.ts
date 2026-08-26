import ActivityLog from "../models/activityLog.model"
import { Types } from "mongoose"
import { fromCursor, toCursor } from "../helpers/cursor"
import { isISOString } from "../helpers/isoString"

const CURSOR_TYPE = "activityLog"

// Always sorted newest-first. Fixed rather than caller-supplied because the
// cursor is built from this key - letting it vary would invalidate cursors
// mid-scroll.
const SORT_KEY = "date"
const SORT_ORDER = -1

export const activityLogResolver = {
  Query: {
    activityLogTable: async (
      _: any,
      {
        first = 10,
        after,
        start,
        end,
        search,
      }: {
        first?: number
        after?: string
        start: string
        end: string
        search?: string
      }
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

        // Counted before the cursor narrows matchStage, so the total covers
        // the whole filtered range rather than just the remaining page.
        const total = await ActivityLog.countDocuments(matchStage)

        if (after) {
          const { id, type, value } = fromCursor(after)
          if (type !== CURSOR_TYPE) throw new Error("Invalid cursor")
          const cursorId = new Types.ObjectId(id)
          const cursorValue = isISOString(value) ? new Date(value) : value

          // Descending only (newest first), so the next page is strictly
          // older than the cursor - ties on identical timestamps broken by
          // _id so no row is skipped or repeated.
          matchStage.$and = [
            ...(matchStage.$and || []),
            {
              $or: [
                { [SORT_KEY]: { $lt: cursorValue } },
                { [SORT_KEY]: cursorValue, _id: { $lt: cursorId } },
              ],
            },
          ]
        }

        // One extra row tells us whether another page exists without a
        // second round trip.
        const result = await ActivityLog.find(matchStage)
          .sort({ [SORT_KEY]: SORT_ORDER, _id: SORT_ORDER })
          .limit(first + 1)
          .lean()

        const sliced = result.slice(0, first)
        const edges = sliced.map((edge: any) => ({
          node: edge,
          cursor: toCursor({
            type: CURSOR_TYPE,
            id: edge._id.toString(),
            value: edge[SORT_KEY],
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
                  value: sliced[sliced.length - 1][SORT_KEY],
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
}
