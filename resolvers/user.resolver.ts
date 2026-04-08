import { GraphQLError } from "graphql"
import User from "../models/user.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { userSchema } from "../validators/user.validator"
import bcrypt from "bcryptjs"
import { isISOString } from "../helpers/isoString"

const CURSOR_TYPE = "user"

const generateNode = (user: any) => ({
  _id: user._id,
  fullName: `${user.name} ${user.surname}`,
  role: user.role,
  isActive: user.isActive,
})

export const userResolver = {
  Query: {
    user: async (_: any, { _id }: any) => {
      try {
        const user = await User.findById(_id).lean()
        if (!user) throw new GraphQLError("User not found")
        return user
      } catch (error) {
        throw error
      }
    },
    userTable: async (
      _: any,
      { first = 10, after, search, filter, sort }: IDataTableArgs
    ) => {
      try {
        const matchStage: Record<string, any> = {}

        if (search)
          matchStage.$or = [
            { name: { $regex: search, $options: "i" } },
            { surname: { $regex: search, $options: "i" } },
            { displayName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { username: { $regex: search, $options: "i" } },
            { fullName: { $regex: search, $options: "i" } },
          ]

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
          {
            $addFields: {
              fullName: { $concat: ["$name", " ", "$surname"] },
            },
          },
          { $match: matchStage },
          {
            $sort: { [sortKey]: sortOrder, _id: sortOrder },
          },
          { $limit: first + 1 },
          {
            $project: {
              image: 1,
              fullName: 1,
              role: 1,
              isActive: 1,
            },
          },
        ]

        const [result, total] = await Promise.all([
          User.aggregate(pipeline),
          User.aggregate([
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
    userOptions: async () => {
      try {
        const users = await User.find({ isActive: true })
          .select("_id name surname")
          .lean()
        if (!users || users.length === 0)
          throw new GraphQLError("No users found.")
        return users.map((user) => ({
          value: user._id,
          label: `${user.name} ${user.surname}`,
        }))
      } catch (error) {
        throw error
      }
    },
  },
  Mutation: {
    createUser: validate(checkSchema(userSchema))(
      async (_: any, { input }: any) => {
        try {
          const result = await User.create({
            ...input,
            password: await bcrypt.hash(input.username, 10),
          })

          return {
            ok: true,
            message: "User created successfully.",
            data: result,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    updateUser: validate(checkSchema(userSchema))(
      async (_: any, { _id, input }: any) => {
        try {
          const result = await User.findByIdAndUpdate(_id, flatten(input), {
            returnDocument: "after",
          }).lean()
          if (!result) throw new GraphQLError("User not found")

          return {
            ok: true,
            message: "User updated successfully.",
            data: result,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changeUserStatus: async (_: any, { _id }: any) => {
      try {
        const user = await User.findById(_id).select("isActive").lean()
        if (!user) throw new GraphQLError("User not found")
        const result = await User.findByIdAndUpdate(
          _id,
          {
            isActive: !user.isActive,
          },
          {
            returnDocument: "after",
          }
        ).lean()
        if (!result) throw new GraphQLError("User not found")

        return {
          ok: true,
          message: "User status updated successfully.",
          data: result,
        }
      } catch (error) {
        throw error
      }
    },
  },
}
