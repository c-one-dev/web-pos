import z from "zod"
import { Role } from "../types/user.type"

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

export const changePasswordSchema = z.object({
  oldPassword: z.string().nonempty("Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
})
