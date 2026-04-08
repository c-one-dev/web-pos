import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { gql } from "@apollo/client"
import { createApolloClient } from "@/lib/apollo"

const client = createApolloClient()

interface Credentials {
  username: string
  password: string
}

const SIGN_IN = gql`
  mutation SignIn($username: String, $password: String) {
    signIn(username: $username, password: $password) {
      ok
      message
      token
      user {
        _id
        name
        role
      }
    }
  }
`

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (cred: Credentials | undefined) => {
        try {
          console.log(cred)
          const result = await client.mutate({
            mutation: SIGN_IN,
            variables: {
              username: cred?.username,
              password: cred?.password,
            },
          })
          if (!result) throw new Error("Invalid sign in.")
          const user = (result as any).data?.signIn.user
          return {
            ...user,
            accessToken: (result as any).data?.signIn.token,
          }
        } catch (error) {
          console.error(error)
          throw new Error(
            "Failed to sign in. Please check credentials and try again."
          )
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }: any) => {
      if (user) {
        token._id = user._id
        token.name = user.name
        token.role = user.role
        token.accessToken = user.accessToken
      }
      if (trigger === "update" && session) token.user = session.user
      return token
    },
    session: async ({ session, token }: any) => {
      session.user = {
        ...session.user,
        _id: token._id,
        name: token.name,
        role: token.role,
      }
      session.accessToken = token.accessToken
      return session
    },
  },
  pages: {
    signIn: "/",
    signOut: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
} as NextAuthOptions)

export { handler as GET, handler as POST }
