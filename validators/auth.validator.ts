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
      userExists.password
    )

    if (!passwordMatches)
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Incorrect password.",
      })
  })

export const switchUserSchema = z
  .object({
    _id: z.string().nonempty("User must be selected."),
    pin: z.string().nonempty("PIN must not be empty."),
  })
  .superRefine(async (args, ctx) => {
    const targetUser = await User.findById(args._id).select("+pin isActive")

    if (!targetUser) {
      ctx.addIssue({
        code: "custom",
        path: ["_id"],
        message: "User does not exist.",
      })
      return
    }

    if (!targetUser.isActive) {
      ctx.addIssue({
        code: "custom",
        path: ["_id"],
        message: "This user is inactive.",
      })
      return
    }

    const pinMatches = await bcrypt.compare(args.pin, targetUser.pin)

    if (!pinMatches)
      ctx.addIssue({
        code: "custom",
        path: ["pin"],
        message: "Incorrect PIN.",
      })
  })
