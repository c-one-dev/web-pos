import { GraphQLError } from "graphql"
import Register from "../models/register.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { registerSchema } from "../validators/register.validator"
import { isISOString } from "../helpers/isoString"
import Product from "../models/product.model"

const CURSOR_TYPE = "register"

export const registerResolver = {
  Query: {
    register: async (_: any, { _id }: any) => {
      try {
        const register = await Register.findById(_id)
          .populate("paymentMethods outlet")
          .lean()
        if (!register) throw new GraphQLError("Register not found")
        return register
      } catch (error) {
        throw error
      }
    },
    processedRegister: async (_: any, { _id }: any) => {
      try {
        const register = await Register.findById(_id)
          .populate("outlet paymentMethods")
          .lean()
        if (!register) throw new GraphQLError("Register not found")
        const products = await Product.find({
          registers: register._id,
        })
          .populate([
            {
              path: "type",
              select: "name",
              strictPopulate: false,
            },
          ])
          .lean()

        return {
          ...register,
          products,
          productTypes: new Set(products.map((p) => p.type).filter((t) => t)),
        }
      } catch (error) {
        throw error
      }
    },
    registerTable: async (
      _: any,
      { first = 10, after, search, filter, sort }: IDataTableArgs
    ) => {
      try {
        const matchStage: Record<string, any> = {}

        if (search)
          matchStage.$or = [
            { name: { $regex: search, $options: "i" } },
            { outletName: { $regex: search, $options: "i" } },
            { prefix: { $regex: search, $options: "i" } },
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
        const total = await Register.countDocuments(matchStage)

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
              from: "outlets",
              localField: "outlet",
              foreignField: "_id",
              as: "outlet",
            },
          },
          {
            $unwind: {
              path: "$outlet",
              preserveNullAndEmptyArrays: true,
            },
          },
          { $addFields: { outletName: "$outlet.name" } },
          { $match: matchStage },
          {
            $sort: { [sortKey]: sortOrder, _id: sortOrder },
          },
          { $limit: first + 1 },
          {
            $project: {
              name: 1,
              outletName: 1,
              prefix: 1,
              isActive: 1,
            },
          },
        ]

        const result = await Register.aggregate(pipeline)
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
    registers: async () => {
      try {
        const registers = await Register.find()
          .populate("paymentMethods outlet")
          .lean()
        return registers
      } catch (error) {
        throw error
      }
    },
    registerOptions: async () => {
      try {
        const registers = await Register.find({ isActive: true })
          .select("_id name")
          .lean()
        if (!registers || registers.length === 0)
          throw new GraphQLError("No registers found.")
        return registers.map((register) => ({
          value: register._id,
          label: register.name,
        }))
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    createRegister: validate(checkSchema(registerSchema))(
      async (_: any, { input }: any) => {
        try {
          const result = await Register.create(input)
          const populatedResult = await Register.findById(result._id)
            .populate("outlet")
            .lean()
          return {
            ok: true,
            message: "Register created successfully.",
            data: populatedResult,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    updateRegister: validate(checkSchema(registerSchema))(
      async (_: any, { _id, input }: any) => {
        try {
          const result = await Register.findByIdAndUpdate(_id, flatten(input), {
            returnDocument: "after",
          })
            .populate({ path: "outlet", select: "name" })
            .lean()
          if (!result) throw new GraphQLError("Register not found")

          return {
            ok: true,
            message: "Register updated successfully.",
            data: result,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changeRegisterStatus: async (_: any, { _id }: any) => {
      try {
        const register = await Register.findById(_id).select("isActive").lean()
        if (!register) throw new GraphQLError("Register not found")
        const result = await Register.findByIdAndUpdate(
          _id,
          {
            isActive: !register.isActive,
          },
          {
            returnDocument: "after",
          }
        )
          .populate({ path: "outlet", select: "name" })
          .lean()
        if (!result) throw new GraphQLError("Register not found")

        return {
          ok: true,
          message: "Register status updated successfully.",
          data: result,
        }
      } catch (error) {
        throw error
      }
    },
  },
}
