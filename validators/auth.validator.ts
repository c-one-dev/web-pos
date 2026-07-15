import z from "zod"
import User from "../models/user.model"
import bcrypt from "bcryptjs"

export const signInSchema = z
  .object({
    username: z.string().nonempty("Username must not be empty."),
    password: z.string().nonempty("Password must not be empty."),
  })
  .superRefine(async (args, ctx) => {
    const userExists = await User.findOne({
      username: args.username,
    }).select("password")

    if (!userExists) {
      ctx.addIssue({
        code: "custom",
        path: ["username"],
        message: "User does not exist.",
      })
      return
    }

    const passwordMatches = await bcrypt.compare(
      args.password,
      userExists.password,
    )

    if (!passwordMatches)
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Incorrect password.",
      })
  })
