import { GraphQLError } from "graphql"
import Outlet from "../models/outlet.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { outletSchema } from "../validators/outlet.validator"
import { isISOString } from "../helpers/isoString"

const CURSOR_TYPE = "outlet"

const generateNode = (outlet: any) => ({
  _id: outlet._id,
  name: outlet.name,
  isActive: outlet.isActive,
})

export const outletResolver = {
  Query: {
    outlet: async (_: any, { _id }: any) => {
      try {
        const outlet = await Outlet.findById(_id).lean()
        if (!outlet) throw new GraphQLError("Outlet not found")
        return outlet
      } catch (error) {
        throw error
      }
    },
    outletTable: async (
      _: any,
      { first = 10, after, search, filter, sort }: IDataTableArgs
    ) => {
      try {
        const matchStage: Record<string, any> = {}

        if (search)
          matchStage.$or = [{ name: { $regex: search, $options: "i" } }]

        if (filter && filter.length > 0)
          matchStage.$and = filter.map(({ type, key, value }) => {
            switch (type) {
              case "TEXT":
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
          { $match: matchStage },
          {
            $sort: { [sortKey]: sortOrder, _id: sortOrder },
          },
          { $limit: first + 1 },
          {
            $project: {
              name: 1,
              isActive: 1,
            },
          },
        ]

        const [result, total] = await Promise.all([
          Outlet.aggregate(pipeline),
          Outlet.aggregate([
            ...pipeline.filter(
              (stage) =>
                !("$limit" in stage) &&
                !("$sort" in stage) &&
                !("$project" in stage)
            ),
            { $count: "total" },
          ]).then((res) => (res[0] ? res[0].total : 0)),
        ])

        const sliced = result.slice(0, first)

        return {
          total,
          pages: Math.ceil(total / first),
          edges: sliced.map((edge) => ({
            node: edge,
            cursor: toCursor({
              id: edge._id.toString(),
              type: CURSOR_TYPE,
              value: edge[sortKey],
            }),
          })),
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
    outletOptions: async () => {
      try {
        const outlets = await Outlet.find({ isActive: true })
          .select("_id name")
          .lean()
        if (!outlets || outlets.length === 0)
          throw new GraphQLError("No outlets found.")
        return outlets.map((outlet) => ({
          value: outlet._id,
          label: outlet.name,
        }))
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    createOutlet: validate(checkSchema(outletSchema))(
      async (_: any, { input }: any) => {
        try {
          const result = await Outlet.create(input)
          return {
            ok: true,
            message: "Outlet created successfully.",
            data: result,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    updateOutlet: validate(checkSchema(outletSchema))(
      async (_: any, { _id, input }: any) => {
        try {
          const result = await Outlet.findByIdAndUpdate(_id, flatten(input), {
            returnDocument: "after",
          }).lean()
          if (!result) throw new GraphQLError("Outlet not found")
          return {
            ok: true,
            message: "Outlet updated successfully.",
            data: result,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changeOutletStatus: async (_: any, { _id }: any) => {
      try {
        const outlet = await Outlet.findById(_id).select("isActive").lean()
        if (!outlet) throw new GraphQLError("Outlet not found")
        const result = await Outlet.findByIdAndUpdate(
          _id,
          {
            isActive: !outlet.isActive,
          },
          {
            returnDocument: "after",
          }
        ).lean()
        if (!result) throw new GraphQLError("Outlet not found")
        return {
          ok: true,
          message: "Outlet status updated successfully.",
          data: result,
        }
      } catch (error) {
        throw error
      }
    },
  },
}
