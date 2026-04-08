import { GraphQLError } from "graphql"
import Brand from "../models/brand.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { brandSchema } from "../validators/brand.validator"
import { isISOString } from "../helpers/isoString"

const CURSOR_TYPE = "brand"

const generateNode = (brand: any) => ({
  _id: brand._id,
  name: brand.name,
  isActive: brand.isActive,
})

export const brandResolver = {
  Query: {
    brand: async (_: any, { _id }: any) => {
      try {
        const brand = await Brand.findById(_id).lean()
        if (!brand) throw new GraphQLError("Brand not found")
        return brand
      } catch (error) {
        throw error
      }
    },
    brandTable: async (
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
          Brand.aggregate(pipeline),
          Brand.aggregate([
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
    brandOptions: async () => {
      try {
        const brands = await Brand.find({ isActive: true })
          .select("_id name")
          .lean()
        if (!brands || brands.length === 0)
          throw new GraphQLError("No brands found.")
        return brands.map((brand) => ({
          value: brand._id,
          label: brand.name,
        }))
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    createBrand: validate(checkSchema(brandSchema))(
      async (_: any, { input }: any) => {
        try {
          const result = await Brand.create(input)
          return {
            ok: true,
            message: "Brand created successfully.",
            data: result,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    updateBrand: validate(checkSchema(brandSchema))(
      async (_: any, { _id, input }: any) => {
        try {
          const result = await Brand.findByIdAndUpdate(_id, flatten(input), {
            returnDocument: "after",
          }).lean()
          if (!result) throw new GraphQLError("Brand not found")

          return {
            ok: true,
            message: "Brand updated successfully.",
            data: result,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changeBrandStatus: async (_: any, { _id }: any) => {
      try {
        const brand = await Brand.findById(_id).select("isActive").lean()
        if (!brand) throw new GraphQLError("Brand not found")
        const result = await Brand.findByIdAndUpdate(
          _id,
          {
            isActive: !brand.isActive,
          },
          {
            returnDocument: "after",
          }
        ).lean()
        if (!result) throw new GraphQLError("Brand not found")

        return {
          ok: true,
          message: "Brand status updated successfully.",
          data: result,
        }
      } catch (error) {
        throw error
      }
    },
  },
}
