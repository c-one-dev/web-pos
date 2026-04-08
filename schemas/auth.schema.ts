import { gql } from "graphql-tag"

export const authSchema = gql`
  type AuthResponse {
    ok: Boolean
    message: String
    token: String
    user: User
  }

  type Mutation {
    signIn(username: String, password: String): AuthResponse
    signOut: Response
  }
`
