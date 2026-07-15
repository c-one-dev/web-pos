import { GraphQLError } from "graphql"
import User from "../models/user.model"
import { startOfDay, endOfDay } from "date-fns"
import { Types, type PipelineStage } from "mongoose"
import { randomBytes } from "crypto"
import type { IDataTableArgs } from "../types/shared.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import { userSchema, changePasswordSchema } from "../validators/user.validator"
import bcrypt from "bcryptjs"
import { isISOString } from "../helpers/isoString"

const CURSOR_TYPE = "user"

// Excludes visually ambiguous characters (0/O, 1/l/I) since an admin has to
// read this out loud or hand-type it for the employee.
const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

const generateTempPassword = (length = 12) =>
  Array.from(randomBytes(length))
    .map((byte) => TEMP_PASSWORD_CHARS[byte % TEMP_PASSWORD_CHARS.length])
    .join("")

const generateNode = (user: any) => ({
  _id: user._id,
  image: user.image,
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
                return { [key]: { $regex: value, $options: "i" } }
            }
          })

        const sortKey = sort?.key || "_id"
        const sortOrder = sort?.order === "ASC" ? 1 : -1
        const total = await User.countDocuments(matchStage)

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

        const result = await User.aggregate(pipeline)
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
          const temporaryPassword = generateTempPassword()
          const result = await User.create({
            ...input,
            image: "",
            password: await bcrypt.hash(temporaryPassword, 10),
            mustChangePassword: true,
          })

          return {
            ok: true,
            message: "User created successfully.",
            data: {
              cursor: toCursor({
                id: result!._id.toString(),
                type: CURSOR_TYPE,
                value: result!._id.toString(),
              }),
              node: generateNode(result),
              temporaryPassword,
            },
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
            data: generateNode(result),
          }
        } catch (error) {
          throw error
        }
      }
    ),
    changeUserStatus: async (_: any, { _id }: any) => {
      try {
        const result = await User.findByIdAndUpdate(
          _id,
          [{ $set: { isActive: { $not: "$isActive" } } }],
          {
            returnDocument: "after",
            updatePipeline: true,
          }
        ).lean()
        if (!result) throw new GraphQLError("User not found")

        return {
          ok: true,
          message: "User status updated successfully.",
          data: generateNode(result),
        }
      } catch (error) {
        throw error
      }
    },
    changePassword: validate(checkSchema(changePasswordSchema))(
      async (_: any, { oldPassword, newPassword }: any, ctx: any) => {
        try {
          const user = await User.findById(ctx.session._id).select("+password")
          if (!user) throw new GraphQLError("User not found")
          const passwordMatches = await bcrypt.compare(
            oldPassword,
            user.password
          )
          if (!passwordMatches)
            throw new GraphQLError("Current password is incorrect.")
          user.password = await bcrypt.hash(newPassword, 10)
          user.mustChangePassword = false
          await user.save()

          return {
            ok: true,
            message: "Password updated successfully.",
            data: null,
          }
        } catch (error) {
          throw error
        }
      }
    ),
  },
}
