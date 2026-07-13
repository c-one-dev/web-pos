import { GraphQLError } from "graphql"
import Product from "../models/product.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { productSchema } from "../validators/product.validator"
import { isISOString } from "../helpers/isoString"

const CURSOR_TYPE = "product"

const generateNode = (product: any) => ({
  _id: product._id,
  name: product.name,
  image: product.image,
  sku: product.sku,
  currentPrice: product.currentPrice,
  isActive: product.isActive,
})

export const productResolver = {
  Query: {
    product: async (_: any, { _id }: any) => {
      try {
        const product = await Product.findById(_id)
          .populate("type brand registers")
          .lean()
        if (!product) throw new GraphQLError("Product not found")
        return product
      } catch (error) {
        throw error
      }
    },
    productTable: async (
      _: any,
      { first = 10, after, search, filter, sort }: IDataTableArgs
    ) => {
      try {
        const matchStage: Record<string, any> = {}

        if (search)
          matchStage.$or = [
            { name: { $regex: search, $options: "i" } },
            { sku: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { barcode: { $regex: search, $options: "i" } },
            {
              currentPrice: isNaN(Number(search)) ? undefined : Number(search),
            },
            { "type.name": { $regex: search, $options: "i" } },
            { "brand.name": { $regex: search, $options: "i" } },
            { "registers.name": { $regex: search, $options: "i" } },
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
        const total = await Product.countDocuments(matchStage)

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
              image: 1,
              sku: 1,
              currentPrice: 1,
              isActive: 1,
            },
          },
        ]

        const result = await Product.aggregate(pipeline)
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
    productOptions: async () => {
      try {
        const products = await Product.find({ isActive: true })
          .select("_id name")
          .lean()
        if (!products || products.length === 0)
          throw new GraphQLError("No products found.")
        return products.map((product) => ({
          value: product._id,
          label: product.name,
        }))
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    createProduct: validate(checkSchema(productSchema))(
      async (_: any, { input }: any) => {
        try {
          const result = await Product.create({
            ...input,
            priceHistory: [{ price: input.currentPrice, date: new Date() }],
          })

          return {
            ok: true,
            message: "Product created successfully.",
            data: {
              cursor: toCursor({
                id: result!._id.toString(),
                type: CURSOR_TYPE,
                value: result!._id.toString(),
              }),
              node: generateNode(result),
            },
          }
        } catch (error) {
          throw error
        }
      }
    ),
    updateProduct: validate(checkSchema(productSchema))(
      async (_: any, { _id, input }: any) => {
        try {
          const oldData = await Product.findById(_id).lean()
          if (!oldData) throw new GraphQLError("Product not found")
          const result = await Product.findByIdAndUpdate(
            _id,
            flatten({
              ...input,
              // If price is updated, add a new entry to price history
              priceHistory:
                input.currentPrice &&
                input.currentPrice !== oldData.currentPrice
                  ? [
                      ...(oldData.priceHistory || []),
                      { price: input.currentPrice, date: new Date() },
                    ]
                  : oldData.priceHistory,
            }),
            {
              returnDocument: "after",
            }
          ).lean()
          if (!result) throw new GraphQLError("Product not found")

          return {
            ok: true,
            message: "Product updated successfully.",
            data: generateNode(result),
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changeProductStatus: async (_: any, { _id }: any) => {
      try {
        const result = await Product.findByIdAndUpdate(
          _id,
          [{ $set: { isActive: { $not: "$isActive" } } }],
          {
            returnDocument: "after",
            updatePipeline: true,
          }
        ).lean()
        if (!result) throw new GraphQLError("Product not found")

        return {
          ok: true,
          message: "Product status updated successfully.",
          data: generateNode(result),
        }
      } catch (error) {
        throw error
      }
    },
  },
}
