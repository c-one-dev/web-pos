import z from "zod"
import { GraphQLError } from "graphql"

export const checkSchema =
  (schema: z.ZodSchema) =>
  (resolver: any) =>
  async (parent: any, args: any, context: any, info: any) => {
    try {
      await schema.parseAsync({
        ...(args?.input ? args.input : args),
        ...(args?._id ? { _id: args?._id } : {}),
      })
      return resolver(parent, args, context, info)
    } catch (error: any) {
      // Format Zod errors for client side
      if (error.name === "ZodError" && Array.isArray(error.issues)) {
        const extensions = {
          fields: error.issues.map((e: any) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        }
        throw new GraphQLError("Form validation error.", {
          extensions,
        })
      }
      throw error
    }
  }

export const validate =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  (...v: Function[]) =>
  (resolver: any) =>
    v.reduceRight((acc, fn) => fn(acc), resolver)
