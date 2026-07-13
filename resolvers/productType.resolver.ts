import { GraphQLError } from "graphql"
import ProductType from "../models/productType.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { productTypeSchema } from "../validators/productType.validator"
import { isISOString } from "../helpers/isoString"

const CURSOR_TYPE = "product_type"

const generateNode = (productType: any) => ({
  _id: productType._id,
  name: productType.name,
  parentName: productType.parent.name,
  isActive: productType.isActive,
})

export const productTypeResolver = {
  Query: {
    productType: async (_: any, { _id }: any) => {
      try {
        const type = await ProductType.findById(_id).populate("parent").lean()
        if (!type) throw new GraphQLError("Product type not found")
        return type
      } catch (error) {
        throw error
      }
    },
    productTypeTable: async (
      _: any,
      { first = 10, after, search, filter, sort }: IDataTableArgs
    ) => {
      try {
        const matchStage: Record<string, any> = {}

        if (search)
          matchStage.$or = [
            { name: { $regex: search, $options: "i" } },
            { "parent.name": { $regex: search, $options: "i" } },
          ]

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
          {
            $lookup: {
              from: "product_types",
              localField: "parent",
              foreignField: "_id",
              as: "parent",
            },
          },
          {
            $unwind: {
              path: "$parent",
              preserveNullAndEmptyArrays: true,
            },
          },
          { $addFields: { parentName: "$parent.name" } },
          { $match: matchStage },
          {
            $sort: { [sortKey]: sortOrder, _id: sortOrder },
          },
          { $limit: first + 1 },
          {
            $project: {
              name: 1,
              parentName: 1,
              isActive: 1,
            },
          },
        ]

        const [result, total] = await Promise.all([
          ProductType.aggregate(pipeline),
          ProductType.aggregate([
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
    productTypeOptions: async () => {
      try {
        const types = await ProductType.find({ isActive: true })
          .select("_id name")
          .lean()
        if (!types || types.length === 0)
          throw new GraphQLError("No product types found.")
        return types.map((productType) => ({
          value: productType._id,
          label: productType.name,
        }))
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    createProductType: validate(checkSchema(productTypeSchema))(
      async (_: any, { input }: any) => {
        try {
          const result = await ProductType.create(input)
          const populatedResult = await ProductType.findById(result._id)
            .populate("parent")
            .lean()

          return {
            ok: true,
            message: "Product type created successfully.",
            data: {
              cursor: toCursor({
                id: populatedResult!._id.toString(),
                type: CURSOR_TYPE,
                value: populatedResult!._id.toString(),
              }),
              node: generateNode(populatedResult),
            },
          }
        } catch (error) {
          throw error
        }
      }
    ),
    updateProductType: validate(checkSchema(productTypeSchema))(
      async (_: any, { _id, input }: any) => {
        try {
          const result = await ProductType.findByIdAndUpdate(
            _id,
            flatten(input),
            {
              returnDocument: "after",
            }
          )
            .populate({ path: "parent", select: "name" })
            .lean()
          if (!result) throw new GraphQLError("Product type not found")

          return {
            ok: true,
            message: "Product type updated successfully.",
            data: generateNode(result),
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changeProductTypeStatus: async (_: any, { _id }: any) => {
      try {
        const result = await ProductType.findByIdAndUpdate(
          _id,
          [{ $set: { isActive: { $not: "$isActive" } } }],
          {
            new: true,
            updatePipeline: true,
          }
        )
          .populate({ path: "parent", select: "name" })
          .lean()
        if (!result) throw new GraphQLError("Product type not found")

        return {
          ok: true,
          message: "Product type status updated successfully.",
          data: generateNode(result),
        }
      } catch (error) {
        throw error
      }
    },
  },
}
