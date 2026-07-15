import { GraphQLError } from "graphql"
import PaymentMethod from "../models/paymentMethod.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { paymentMethodSchema } from "../validators/paymentMethod.validator"
import { isISOString } from "../helpers/isoString"

const CURSOR_TYPE = "payment_method"

const generateNode = (paymentMethod: any) => ({
  _id: paymentMethod._id,
  name: paymentMethod.name,
  type: paymentMethod.type,
  isActive: paymentMethod.isActive,
})

export const paymentMethodResolver = {
  Query: {
    paymentMethod: async (_: any, { _id }: any) => {
      try {
        const paymentMethod = await PaymentMethod.findById(_id).lean()
        if (!paymentMethod) throw new GraphQLError("Payment method not found")
        return paymentMethod
      } catch (error) {
        throw error
      }
    },
    paymentMethodTable: async (
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
              case "SELECT":
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
        const total = await PaymentMethod.countDocuments(matchStage)

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
              type: 1,
              isActive: 1,
            },
          },
        ]

        const result = await PaymentMethod.aggregate(pipeline)
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
    paymentMethodOptions: async () => {
      try {
        const paymentMethods = await PaymentMethod.find({ isActive: true })
          .select("_id name")
          .lean()
        if (!paymentMethods || paymentMethods.length === 0)
          throw new GraphQLError("No paymentMethods found.")
        return paymentMethods.map((paymentMethod) => ({
          value: paymentMethod._id,
          label: paymentMethod.name,
        }))
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    createPaymentMethod: validate(checkSchema(paymentMethodSchema))(
      async (_: any, { input }: any) => {
        try {
          const result = await PaymentMethod.create(input)
          return {
            ok: true,
            message: "Payment method created successfully.",
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
    updatePaymentMethod: validate(checkSchema(paymentMethodSchema))(
      async (_: any, { _id, input }: any) => {
        try {
          const result = await PaymentMethod.findByIdAndUpdate(
            _id,
            flatten(input),
            {
              returnDocument: "after",
            }
          ).lean()
          if (!result) throw new GraphQLError("PaymentMethod not found")
          return {
            ok: true,
            message: "Payment method updated successfully.",
            data: generateNode(result),
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changePaymentMethodStatus: async (_: any, { _id }: any) => {
      try {
        const result = await PaymentMethod.findByIdAndUpdate(
          _id,
          [{ $set: { isActive: { $not: "$isActive" } } }],
          {
            returnDocument: "after",
            updatePipeline: true,
          }
        ).lean()
        if (!result) throw new GraphQLError("PaymentMethod not found")

        return {
          ok: true,
          message: "Payment method status updated successfully.",
          data: generateNode(result),
        }
      } catch (error) {
        throw error
      }
    },
  },
}
