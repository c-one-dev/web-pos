import { GraphQLError } from "graphql"
import User from "../models/user.model"
import { validate, checkSchema } from "../helpers/validate"
import { signInSchema, switchUserSchema } from "../validators/auth.validator"
import { logActivity } from "../helpers/activityLog"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

export const authResolver = {
  Mutation: {
    signIn: validate(checkSchema(signInSchema))(
      async (
        _: any,
        args: { username: string; password: string },
        ctx: any
      ) => {
        try {
          const result = await User.findOne({
            username: args.username,
          }).select("+password")
          if (!result) throw new GraphQLError("User does not exist.")
          const token = jwt.sign(
            {
              _id: result._id,
              username: result.username,
              role: result.role,
            },
            JWT_SECRET,
            { expiresIn: "7d" }
          )
          // signIn is a public field (no session yet), so it never reaches
          // the generic Mutation-logging wrapper in app/graphql/route.ts -
          // logged directly here instead.
          logActivity({
            req: ctx?.req,
            user: { _id: result._id, name: `${result.name} ${result.surname}` },
            activity: "Login",
          })
          return {
            ok: true,
            message: `Sign in successful! Welcome back, ${result.name}!`,
            user: result,
            token,
          }
        } catch (error) {
          throw error
        }
      }
    ),
    switchUser: validate(checkSchema(switchUserSchema))(
      async (_: any, { _id }: any, ctx: any) => {
        try {
          if (!ctx.session)
            throw new GraphQLError("Unauthorized", {
              extensions: { code: "UNAUTHORIZED" },
            })
          const result = await User.findById(_id)
          if (!result) throw new GraphQLError("User not found")
          const token = jwt.sign(
            {
              _id: result._id,
              username: result.username,
              role: result.role,
            },
            JWT_SECRET,
            { expiresIn: "7d" }
          )
          return {
            ok: true,
            message: `Switched to ${result.name}.`,
            user: result,
            token,
          }
        } catch (error) {
          throw error
        }
      }
    ),
  },
}
