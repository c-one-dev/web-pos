import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client"

export const client = new ApolloClient({
  link: new HttpLink({ uri: process.env.GRAPHQL_URI }),
  cache: new InMemoryCache({
    typePolicies: {
      Brand: {
        keyFields: ["_id"],
      }
    }
  }),
})
