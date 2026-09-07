import { CombinedGraphQLErrors } from "@apollo/client"
import type { GraphQLFormattedError } from "graphql"

/**
 * The GraphQL errors behind a thrown Apollo error.
 *
 * Apollo Client 4 no longer throws an ApolloError carrying `graphQLErrors`;
 * server-side errors arrive as a CombinedGraphQLErrors whose `errors` array
 * holds them. Code still reading `error.graphQLErrors` gets undefined, and
 * quietly loses the `extensions` - which is how an import came to report
 * every unrecognised receipt as a failure instead of skipping it.
 *
 * Handles both shapes, so it stays correct wherever the older one still turns
 * up (a hand-built error object in a test, say).
 */
export const graphQLErrorsOf = (error: any): GraphQLFormattedError[] => {
  if (CombinedGraphQLErrors.is(error)) return error.errors as any
  if (Array.isArray(error?.graphQLErrors)) return error.graphQLErrors
  if (Array.isArray(error?.errors)) return error.errors
  return []
}

/** The `extensions.code` the server sent, if it sent one. */
export const errorCodeOf = (error: any): string | undefined =>
  graphQLErrorsOf(error)[0]?.extensions?.code as string | undefined

/** The server's own message, falling back to whatever the error carries. */
export const errorMessageOf = (error: any): string =>
  graphQLErrorsOf(error)[0]?.message ?? error?.message ?? "Unknown error"

/**
 * Per-field validation messages. The schema-level middleware puts them in
 * `extensions.fields` and leaves only "Form validation error." on top, so
 * without these an import says nothing about which column is wrong.
 */
export const errorFieldsOf = (error: any) =>
  graphQLErrorsOf(error)[0]?.extensions?.fields as
    | { path: string; message: string }[]
    | undefined
