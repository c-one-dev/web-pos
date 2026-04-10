import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client"
import { setContext } from "@apollo/client/link/context"

export const createApolloClient = (accessToken?: string) => {
  const httpLink = new HttpLink({
    uri: process.env.GRAPHQL_URI,
  })

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        Authorization: accessToken ? `Bearer ${accessToken}` : "",
      },
    }
  })

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  })
}
