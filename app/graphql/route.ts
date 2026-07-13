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

// Query/Mutation fields that must remain reachable without a session.
const PUBLIC_FIELDS = new Set(["Mutation.signIn"])

const baseSchema = makeExecutableSchema({ resolvers, typeDefs })

// Require an authenticated session for every Query/Mutation field by default,
// so a newly added resolver is protected automatically instead of relying on
// each resolver remembering to check `context.session` itself. Mutation
// fields additionally get their input run through a Zod schema looked up in
// mutationValidationRegistry - a mutation missing from that registry fails
// the server at startup instead of silently shipping unvalidated.
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

    if (PUBLIC_FIELDS.has(`${typeName}.${fieldName}`))
      return { ...fieldConfig, resolve }

    return {
      ...fieldConfig,
      resolve: (source, args, context, info) => {
        if (!context?.session)
          throw new GraphQLError("Unauthorized", {
            extensions: { code: "UNAUTHORIZED" },
          })
        return resolve(source, args, context, info)
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
    return {
      req,
      session,
    }
  },
})

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}
