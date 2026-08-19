import { startServerAndCreateNextHandler } from "@as-integrations/next"
import { ApolloServer } from "@apollo/server"
import { NextRequest } from "next/server"
import { makeExecutableSchema } from "@graphql-tools/schema"
import { mapSchema, MapperKind } from "@graphql-tools/utils"
import { GraphQLError, defaultFieldResolver } from "graphql"
import { getToken } from "next-auth/jwt"
import { connectDB } from "@/lib/db"
import resolvers from "@/resolvers/merge"
import typeDefs from "@/schemas/merge"
import { checkSchema } from "@/helpers/validate"
import {
  mutationValidationRegistry,
  NO_VALIDATION,
} from "@/validators/mutationRegistry"
import { effectivePermissions } from "@/validators/roleAccessRegistry"
import { fieldPermissionMap } from "@/validators/permissionRegistry"
import { logActivity, describeActivity } from "@/helpers/activityLog"
import User from "@/models/user.model"

// Query/Mutation fields that must remain reachable without a session.
const PUBLIC_FIELDS = new Set(["Mutation.signIn"])

// Matches the largest row-size option offered anywhere in the UI (every
// *Table page's rows-per-page dropdown tops out at 500) - clamping here
// closes off `first: 999999999` without affecting any legitimate request.
const MAX_PAGE_SIZE = 500

const baseSchema = makeExecutableSchema({ resolvers, typeDefs })

// Require an authenticated session for every Query/Mutation field by default,
// so a newly added resolver is protected automatically instead of relying on
// each resolver remembering to check `context.session` itself. Mutation
// fields additionally get their input run through a Zod schema looked up in
// mutationValidationRegistry - a mutation missing from that registry fails
// the server at startup instead of silently shipping unvalidated. Any field
// with a `first` argument (every *Table pagination query) gets it clamped to
// MAX_PAGE_SIZE, since none of the resolvers cap it themselves.
export const schema = mapSchema(baseSchema, {
  [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
    if (typeName !== "Query" && typeName !== "Mutation") return fieldConfig

    const originalResolve = fieldConfig.resolve ?? defaultFieldResolver
    let resolve = originalResolve

    if (typeName === "Mutation") {
      const validationEntry = mutationValidationRegistry[fieldName]
      if (validationEntry === undefined)
        throw new Error(
          `Mutation.${fieldName} has no entry in mutationValidationRegistry. ` +
            `Add a Zod schema, or NO_VALIDATION if it genuinely needs none.`
        )
      if (validationEntry !== NO_VALIDATION)
        resolve = checkSchema(validationEntry)(resolve)
    }

    const previousResolve = resolve
    resolve = (source, args, context, info) => {
      const clampedArgs =
        typeof args?.first === "number" && args.first > MAX_PAGE_SIZE
          ? { ...args, first: MAX_PAGE_SIZE }
          : args
      return previousResolve(source, clampedArgs, context, info)
    }

    if (PUBLIC_FIELDS.has(`${typeName}.${fieldName}`))
      return { ...fieldConfig, resolve }

    const fieldKey = `${typeName}.${fieldName}`

    return {
      ...fieldConfig,
      resolve: async (source, args, context, info) => {
        if (!context?.session)
          throw new GraphQLError("Unauthorized", {
            extensions: { code: "UNAUTHORIZED" },
          })
        const role = context.session.role
        // Per-user permissions (validators/permissionRegistry.ts) are the
        // access check: context.permissions is the user's explicit list when
        // one has been saved, otherwise their role's default set. A field
        // reachable from several permissions passes if the user holds any of
        // them. Fields with no entry at all are shared lookups and stay open.
        const requiredPermissions = fieldPermissionMap[fieldKey]
        if (
          requiredPermissions &&
          !requiredPermissions.some((key) => context.permissions?.has(key))
        ) {
          // Mutation.updateUser doubles as the self-service "My Profile"
          // save, so editing your own record stays allowed without the
          // users.user.edit permission - mirrors the isSelf carve-out in
          // resolvers/user.resolver.ts.
          const isSelfProfileUpdate =
            fieldKey === "Mutation.updateUser" &&
            args?._id?.toString() === context.session._id?.toString()
          if (!isSelfProfileUpdate)
            throw new GraphQLError("Forbidden", {
              extensions: { code: "FORBIDDEN" },
            })
        }
        // Query.user is otherwise open (every role needs it for "My
        // Profile"), but for anyone below ADMIN it must not become a way to
        // read a coworker's profile by guessing their _id.
        if (
          role !== "ADMIN" &&
          fieldKey === "Query.user" &&
          args?._id &&
          args._id.toString() !== context.session._id?.toString()
        )
          throw new GraphQLError("Forbidden", {
            extensions: { code: "FORBIDDEN" },
          })
        const result = await resolve(source, args, context, info)
        // Major Activity Log: every successful mutation (not queries) gets a
        // row, independent of which domain it's in - so the log stays
        // complete as new mutations are added, instead of needing each one
        // remembered here individually. Mutation.signIn logs itself
        // separately (resolvers/auth.resolver.ts) since it runs before a
        // session exists and never reaches this wrapper.
        if (typeName === "Mutation")
          logActivity({
            req: context.req,
            user: { _id: context.session._id, name: context.session.name },
            activity: describeActivity(fieldName, args, result),
          })
        return result
      },
    }
  },
})

const server = new ApolloServer({
  schema,
})

const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req: NextRequest) => {
    await connectDB()
    const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    // Read permissions straight from the user document rather than the JWT:
    // an admin granting or revoking a permission has to take effect on the
    // very next request, not whenever the token happens to be refreshed.
    // Falls back to the role default when the user has no explicit list.
    let permissions: Set<string> | null = null
    if (session?._id) {
      const user = await User.findById(session._id)
        .select("permissions")
        .lean<{ permissions?: string[] }>()
      permissions = effectivePermissions(
        session.role as string | undefined,
        user?.permissions
      )
    }
    return {
      req,
      session,
      permissions,
    }
  },
})

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}
