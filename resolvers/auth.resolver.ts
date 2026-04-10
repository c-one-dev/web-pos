import { GraphQLError } from "graphql"
import User from "../models/user.model"
import { validate, checkSchema } from "../helpers/validate"
import { signInSchema } from "../validators/auth.validator"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

export const authResolver = {
  Mutation: {
    signIn: validate(checkSchema(signInSchema))(
      async (_: any, args: { username: string; password: string }) => {
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
  },
}
