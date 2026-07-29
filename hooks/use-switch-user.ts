import { useMutation, useApolloClient } from "@apollo/client/react"
import gql from "graphql-tag"
import { useSession } from "next-auth/react"
import { useState } from "react"

const SWITCH_USER = gql`
  mutation SwitchUser($_id: ID!, $pin: String!) {
    switchUser(_id: $_id, pin: $pin) {
      ok
      message
      token
      user {
        _id
        name
        role
        mustChangePassword
      }
    }
  }
`

export function useSwitchUser() {
  const { update }: any = useSession()
  const client = useApolloClient()
  const [switchUserMutation, { loading }] = useMutation(SWITCH_USER)
  const [error, setError] = useState<string | null>(null)

  const switchToUser = async (_id: string, pin: string) => {
    setError(null)
    try {
      const result: any = await switchUserMutation({ variables: { _id, pin } })
      if (result.data.switchUser.ok) {
        const switched = result.data.switchUser.user
        await update({
          switchUser: {
            _id: switched._id,
            name: switched.name,
            role: switched.role,
            accessToken: result.data.switchUser.token,
            mustChangePassword: switched.mustChangePassword,
          },
        })
        // The switch itself (mutation + session update) has already
        // succeeded at this point — a resetStore() failure (e.g. an
        // aborted in-flight refetch) must not turn this into a reported
        // failure, since the account switch is genuinely done.
        try {
          await client.resetStore()
        } catch (resetError) {
          console.warn("Post-switch cache reset failed:", resetError)
        }
        return { ok: true, message: result.data.switchUser.message }
      }
      return { ok: false, message: "Unable to switch user." }
    } catch (err: any) {
      const message = err.graphQLErrors?.[0]?.message ?? err.message
      setError(message)
      return { ok: false, message }
    }
  }

  return { switchToUser, loading, error, setError }
}
