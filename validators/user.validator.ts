import z from "zod"
import { Role } from "../types/user.type"
import User from "../models/user.model"
import { Types } from "mongoose"

export const userSchema = z.object({
  _id: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  name: z.string().nonempty("Name is required"),
  surname: z.string().nonempty("Surname is required"),
  displayName: z.string().nonempty("Display name is required"),
  email: z.string().email("Invalid email format").optional().nullable(),
  username: z.string().nonempty("Username is required"),
  role: z.enum(Object.values(Role)).nonoptional("Role is required"),
  pin: z.string().optional().nullable(),
})
// .superRefine(async (data, ctx) => {
//   const isUpdate = !!data._id
//   const [usernameAlreadyExists, emailAlreadyExists] = await Promise.all([
//     await User.exists({
//       username: data.username,
//       ...(isUpdate ? { _id: { $ne: new Types.ObjectId(data?._id) } } : {}),
//     }),
//     data.email
//       ? await User.exists({
//           email: data.email,
//           ...(isUpdate
//             ? { _id: { $ne: new Types.ObjectId(data?._id) } }
//             : {}),
//         })
//       : false,
//   ])

//   if (usernameAlreadyExists) {
//     ctx.addIssue({
//       code: "custom",
//       message: "Username already exists.",
//       path: ["username"],
//     })
//   }

//   if (emailAlreadyExists) {
//     ctx.addIssue({
//       code: "custom",
//       message: "Email already exists.",
//       path: ["email"],
//     })
//   }
// })
