"use client"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useMemo } from "react"

// The signed-in user's effective permissions: their explicit list when an
// admin has saved one, otherwise their role's default set
// (validators/roleAccessRegistry.ts). Read from the server rather than the
// JWT so a grant/revoke applies without signing out and back in.
const MY_PERMISSIONS = gql`
  query MyPermissions {
    myPermissions
  }
`

export function usePermissions() {
  const { data, loading }: any = useQuery(MY_PERMISSIONS, {
    fetchPolicy: "cache-and-network",
  })

  const granted = useMemo(
    () => new Set<string>(data?.myPermissions ?? []),
    [data]
  )

  return {
    // False until the first response lands - and it stays false if the query
    // errors out, so callers can choose not to blank the whole UI over a
    // transient network blip. The server enforces the same permissions
    // per-field either way (app/graphql/route.ts).
    ready: data !== undefined,
    loading: loading && !data,
    granted,
    // True when the user holds any of the given keys. An empty list means
    // "not permission-gated", so it passes.
    can: (...keys: string[]) =>
      keys.length === 0 || keys.some((key) => granted.has(key)),
  }
}
