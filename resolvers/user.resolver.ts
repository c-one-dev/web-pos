import { GraphQLError } from "graphql"
import User from "../models/user.model"
import Sale from "../models/sale.model"
import Payment from "../models/payment.model"
import RegisterSession from "../models/registerSession.model"
import SalesTarget from "../models/salesTarget.model"
import ActivityLog from "../models/activityLog.model"
import { Types, type PipelineStage } from "mongoose"
import { randomBytes } from "crypto"
import type { IDataTableArgs } from "../types/shared.type"
import { Role } from "../types/user.type"
import { fromCursor, toCursor } from "../helpers/cursor"
import { flatten } from "../helpers/flatten"
import { checkSchema, validate } from "../helpers/validate"
import {
  userSchema,
  changePasswordSchema,
  resetUserPasswordSchema,
  deleteUserSchema,
  updateUserPermissionsSchema,
} from "../validators/user.validator"
import { normalizePermissions } from "../validators/permissionRegistry"
import {
  effectivePermissions,
  roleDefaultPermissions,
} from "../validators/roleAccessRegistry"
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

// Managing another user's permissions is an ADMIN/MANAGER-only action, on top
// of the `users.user.permissions` permission enforced in app/graphql/route.ts.
// Two extra rules beyond the role check:
//   - nobody edits their own permissions (no self-lockout, no self-grant)
//   - a MANAGER may not touch an ADMIN's permissions
const assertCanManagePermissions = (ctx: any, target: any) => {
  const actorRole = ctx?.session?.role
  const actorId = ctx?.session?._id?.toString()

  if (actorRole !== Role.ADMIN && actorRole !== Role.MANAGER)
    throw new GraphQLError("You are not allowed to manage user permissions.", {
      extensions: { code: "FORBIDDEN" },
    })
  if (actorId && actorId === target._id?.toString())
    throw new GraphQLError("You cannot manage your own permissions.", {
      extensions: { code: "FORBIDDEN" },
    })
  if (actorRole === Role.MANAGER && target.role === Role.ADMIN)
    throw new GraphQLError(
      "A manager cannot manage an administrator's permissions.",
      { extensions: { code: "FORBIDDEN" } }
    )
}

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
                    $gte: start,
                    $lte: end,
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
    userPermissions: async (_: any, { _id }: any, ctx: any) => {
      try {
        const target = await User.findById(_id)
          .select("name surname role permissions")
          .lean()
        if (!target) throw new GraphQLError("User not found")
        assertCanManagePermissions(ctx, target)

        return {
          _id: target._id,
          fullName: `${target.name} ${target.surname}`,
          role: target.role,
          // Left as null when never saved, so the dialog can tell
          // "no explicit permissions yet" apart from "everything unticked".
          permissions: target.permissions ?? null,
          defaultPermissions: roleDefaultPermissions[target.role] ?? [],
        }
      } catch (error) {
        throw error
      }
    },
    // The signed-in user's own effective permissions - what the sidebar shows
    // and what the route guard allows. Open to every session by design: it
    // only ever describes the caller.
    myPermissions: async (_: any, __: any, ctx: any) => {
      try {
        const me = await User.findById(ctx?.session?._id)
          .select("role permissions")
          .lean()
        if (!me) throw new GraphQLError("User not found")
        return [...effectivePermissions(me.role, me.permissions)]
      } catch (error) {
        throw error
      }
    },
    activeUsers: async () => {
      try {
        const users = await User.find({ isActive: true }).lean()
        return users.map(generateNode)
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
            pin: await bcrypt.hash(input.pin, 10),
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
      async (_: any, { _id, input }: any, ctx: any) => {
        try {
          const isSelf = ctx?.session?._id?.toString() === _id?.toString()
          const isAdmin = ctx?.session?.role === Role.ADMIN
          if (!isAdmin && !isSelf)
            throw new GraphQLError("You are not allowed to update this user.", {
              extensions: { code: "FORBIDDEN" },
            })

          const updateInput = { ...input }
          // Only an admin may change a user's role — a self-service update
          // (e.g. "My Profile") must never be able to escalate its own role,
          // regardless of what the client sends.
          if (!isAdmin) delete updateInput.role
          if (updateInput.pin) {
            updateInput.pin = await bcrypt.hash(updateInput.pin, 10)
          } else {
            delete updateInput.pin
          }
          const result = await User.findByIdAndUpdate(
            _id,
            flatten(updateInput),
            {
              returnDocument: "after",
            }
          ).lean()
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
    updateUserPermissions: validate(checkSchema(updateUserPermissionsSchema))(
      async (_: any, { _id, permissions }: any, ctx: any) => {
        try {
          const target = await User.findById(_id).select("role").lean()
          if (!target) throw new GraphQLError("User not found")
          assertCanManagePermissions(ctx, target)

          // Re-normalized server-side: unknown keys dropped, ancestors of any
          // granted key pulled back in - the client's tree state is a
          // convenience, not the source of truth.
          //
          // A null list is the reset: the field is removed entirely so the
          // user falls back to their role's default. Without this an explicit
          // list, once saved, outlives every later role change - a user moved
          // to NO_ROLE would keep the permissions they had as a CASHIER.
          const update =
            permissions === null || permissions === undefined
              ? { $unset: { permissions: "" } }
              : { $set: { permissions: normalizePermissions(permissions) } }
          const result = await User.findByIdAndUpdate(_id, update, {
            returnDocument: "after",
          })
            .select("name surname role permissions")
            .lean()
          if (!result) throw new GraphQLError("User not found")

          return {
            ok: true,
            message: "User permissions updated successfully.",
            data: {
              _id: result._id,
              fullName: `${result.name} ${result.surname}`,
              role: result.role,
              permissions: result.permissions ?? [],
              defaultPermissions: roleDefaultPermissions[result.role] ?? [],
            },
          }
        } catch (error) {
          throw error
        }
      }
    ),
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
    // Permanently removes an account.
    //
    // Refused when the user has operational history. Sales, payments, shifts
    // and targets all populate the user for display, so deleting one behind
    // them turns a cashier's name into a blank in sale history and every
    // shift report they closed. Deactivating keeps the name and stops the
    // login, which is what "remove this person" usually means; hard delete is
    // for accounts created by mistake.
    deleteUser: validate(checkSchema(deleteUserSchema))(
      async (_: any, { _id }: any, ctx: any) => {
        try {
          const actorRole = ctx?.session?.role
          if (actorRole !== Role.ADMIN && actorRole !== Role.MANAGER)
            throw new GraphQLError("You are not allowed to delete a user.")

          if (ctx?.session?._id?.toString() === _id?.toString())
            throw new GraphQLError("You cannot delete your own account.")

          const target = await User.findById(_id).select("role name surname")
          if (!target) throw new GraphQLError("User not found")

          // Same containment rule as resetUserPassword: a manager must not be
          // able to remove an administrator.
          if (actorRole === Role.MANAGER && target.role === Role.ADMIN)
            throw new GraphQLError("A manager cannot delete an administrator.")

          const userId = new Types.ObjectId(_id)
          const [sales, payments, sessions, targets] = await Promise.all([
            Sale.countDocuments({ by: userId }),
            Payment.countDocuments({ by: userId }),
            RegisterSession.countDocuments({
              $or: [{ openedBy: userId }, { closedBy: userId }],
            }),
            SalesTarget.countDocuments({ user: userId }),
          ])

          const blockers = [
            sales && `${sales} sale${sales === 1 ? "" : "s"}`,
            payments && `${payments} payment${payments === 1 ? "" : "s"}`,
            sessions &&
              `${sessions} register session${sessions === 1 ? "" : "s"}`,
            targets && `${targets} sales target${targets === 1 ? "" : "s"}`,
          ].filter(Boolean)

          if (blockers.length)
            throw new GraphQLError(
              `${target.name} has ${blockers.join(", ")} on record and cannot be deleted. Deactivate the account instead.`
            )

          // The activity log keeps `userName` as plain text, so the audit
          // trail survives the account. Only the dangling reference is cleared.
          await ActivityLog.updateMany({ user: userId }, { $set: { user: null } })
          await User.findByIdAndDelete(_id)

          return {
            ok: true,
            message: "User deleted permanently.",
            data: { _id },
          }
        } catch (error) {
          throw error
        }
      }
    ),
    // Hands a locked-out user a fresh temporary password. Mirrors createUser:
    // the password is generated here, returned once so it can be read out, and
    // `mustChangePassword` forces them to replace it at the next sign-in.
    resetUserPassword: validate(checkSchema(resetUserPasswordSchema))(
      async (_: any, { _id }: any, ctx: any) => {
        try {
          const actorRole = ctx?.session?.role
          if (actorRole !== Role.ADMIN && actorRole !== Role.MANAGER)
            throw new GraphQLError(
              "You are not allowed to reset a user's password."
            )

          const user = await User.findById(_id).select("role")
          if (!user) throw new GraphQLError("User not found")

          // Same shape as the permissions rule: a MANAGER must not be able to
          // take over an ADMIN's account by resetting its password.
          if (actorRole === Role.MANAGER && user.role === Role.ADMIN)
            throw new GraphQLError(
              "A manager cannot reset an administrator's password."
            )

          const temporaryPassword = generateTempPassword()
          user.password = await bcrypt.hash(temporaryPassword, 10)
          user.mustChangePassword = true
          await user.save()

          return {
            ok: true,
            message: "Password reset successfully.",
            // Shown once in the dialog - it is never retrievable afterwards.
            data: temporaryPassword,
          }
        } catch (error) {
          throw error
        }
      }
    ),
  },
}
