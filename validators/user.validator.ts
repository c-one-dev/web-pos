import z from "zod"
import { Role } from "../types/user.type"

// A profile picture is stored inline on the user record as a data URL. The
// uploader shrinks it to a 256px JPEG (roughly 20-40KB), so this ceiling only
// ever stops a request that bypassed the uploader - an oversized picture here
// would be re-sent in every avatar query across the app.
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/
const MAX_IMAGE_LENGTH = 200_000

export const userSchema = z
  .object({
    _id: z.string().optional().nullable(),
    image: z
      .string()
      .optional()
      .nullable()
      .refine(
        (val) =>
          !val ||
          (val.length <= MAX_IMAGE_LENGTH &&
            (IMAGE_DATA_URL.test(val) || /^https?:\/\//.test(val))),
        { message: "Profile picture must be a PNG, JPEG or WebP image." }
      ),
    name: z.string().nonempty("Name is required"),
    surname: z.string().nonempty("Surname is required"),
    displayName: z.string().nonempty("Display name is required"),
    email: z.string().email("Invalid email format").optional().nullable(),
    username: z.string().nonempty("Username is required"),
    role: z.enum(Object.values(Role)).nonoptional("Role is required"),
    pin: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || /^\d{4}$/.test(val), {
        message: "PIN must be exactly 4 digits",
      }),
  })
  .refine((data) => data._id || (data.pin && data.pin.length > 0), {
    message: "PIN is required for new users",
    path: ["pin"],
  })

export const updateUserPermissionsSchema = z.object({
  _id: z.string().nonempty("User is required"),
  // Unknown keys are stripped (not rejected) by normalizePermissions in the
  // resolver — this only guards the shape.
  // null clears the explicit list and restores the role default; an empty
  // array is a real value meaning "nothing granted".
  permissions: z.array(z.string()).nullable(),
})

export const changePasswordSchema = z.object({
  oldPassword: z.string().nonempty("Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
})

// Resetting someone else's password. Only the target matters - the new
// password is generated server-side, never supplied by the caller.
export const resetUserPasswordSchema = z.object({
  _id: z.string().nonempty("User is required"),
})

// Permanently deleting a user. The safety rules (who may do it, and whether
// the account still has records attached) live in the resolver.
export const deleteUserSchema = z.object({
  _id: z.string().nonempty("User is required"),
})
