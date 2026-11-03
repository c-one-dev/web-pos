import { GraphQLError } from "graphql"
import Outlet from "../models/outlet.model"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { outletSchema } from "../validators/outlet.validator"
import Register from "../models/register.model"

const CURSOR_TYPE = "outlet"

const generateNode = (outlet: any) => ({
  _id: outlet._id,
  name: outlet.name,
  isActive: outlet.isActive,
  registers: outlet.registers.map((reg: any) => ({
    _id: reg._id,
    name: reg.name,
  })),
})

export const outletResolver = {
  Query: {
    outlet: async (_: any, { _id }: any) => {
      try {
        const outlet = await Outlet.findById(_id).lean()
        if (!outlet) throw new GraphQLError("Outlet not found")
        const registers = await Register.find({ outlet: _id })
          .select("_id name")
          .lean()
        return { ...outlet, registers }
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
              case "SELECT":
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

        // An outlet holds many registers, so `registers` is an array - and a
        // keyset cursor cannot be built from one. Comparing an array against
        // an array in the cursor clause below matches nothing, which hands
        // back an empty second page. Sorting and paging run on the first
        // register's name instead, which is the one the column leads with.
        const requestedSortKey = sort?.key || "_id"
        const sortKey =
          requestedSortKey === "registers" ? "registerSort" : requestedSortKey
        const sortOrder = sort?.order === "ASC" ? 1 : -1
        const total = await Outlet.countDocuments(matchStage)

        if (after) {
          const { id, type, value } = fromCursor(after)
          if (type !== CURSOR_TYPE) throw new Error("Invalid cursor")
          const cursorId = new Types.ObjectId(id)
          // The cursor carries the value's own type, so nothing is guessed
          // from the text here - see toCursor in helpers/cursor.ts.
          const cursorValue = value

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
          {
            $lookup: {
              from: "registers",
              localField: "_id",
              foreignField: "outlet",
              as: "registers",
            },
          },
          {
            $addFields: {
              registers: {
                $map: {
                  input: "$registers",
                  as: "reg",
                  in: {
                    _id: "$$reg._id",
                    name: "$$reg.name",
                  },
                },
              },
            },
          },
          // Its own stage because `registers` is not readable from inside the
          // $addFields that builds it. Empty string rather than null so an
          // outlet with no register still sorts somewhere definite.
          {
            $addFields: {
              registerSort: {
                $ifNull: [{ $arrayElemAt: ["$registers.name", 0] }, ""],
              },
            },
          },
          { $match: matchStage },
          {
            $sort: { [sortKey]: sortOrder, _id: sortOrder },
          },
          { $limit: first + 1 },
          {
            $project: {
              name: 1,
              registers: 1,
              // Kept past the projection only so the cursor below can read
              // it; GraphQL ignores the extra field.
              registerSort: 1,
              isActive: 1,
            },
          },
        ]

        const result = await Outlet.aggregate(pipeline)
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
            data: {
              cursor: toCursor({
                id: result!._id.toString(),
                type: CURSOR_TYPE,
                value: result!._id.toString(),
              }),
              node: generateNode({ ...result, registers: [] }),
            },
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
          const registers = await Register.find({ outlet: _id })
            .select("_id name")
            .lean()
          if (!result) throw new GraphQLError("Outlet not found")
          return {
            ok: true,
            message: "Outlet updated successfully.",
            data: generateNode({ ...result, registers }),
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changeOutletStatus: async (_: any, { _id }: any) => {
      try {
        const result = await Outlet.findByIdAndUpdate(
          _id,
          [{ $set: { isActive: { $not: "$isActive" } } }],
          {
            returnDocument: "after",
            updatePipeline: true,
          }
        ).lean()
        const registers = await Register.find({ outlet: _id })
          .select("_id name")
          .lean()
        if (!result) throw new GraphQLError("Outlet not found")
        return {
          ok: true,
          message: "Outlet status updated successfully.",
          data: generateNode({ ...result, registers }),
        }
      } catch (error) {
        throw error
      }
    },
  },
}
