import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client"

export const client = new ApolloClient({
  link: new HttpLink({ uri: process.env.GRAPHQL_URI }),
  cache: new InMemoryCache({
    typePolicies: {
      Brand: {
        keyFields: ["_id"],
      },
      User: {
        keyFields: ["_id"],
      },
      Outlet: {
        keyFields: ["_id"],
      },
      Register: {
        keyFields: ["_id"],
      },
      ProductType: {
        keyFields: ["_id"],
      },
      Product: {
        keyFields: ["_id"],
      },
      Customer: {
        keyFields: ["_id"],
      },
      // Closure report rows are not entities. Each one is a sale *line item*
      // or a *payment*, and they all carry their parent sale's _id, so a sale
      // with two lines (or a split payment) emits several rows sharing one id.
      // Apollo's default normalization falls back to _id, which collapses the
      // whole group onto a single cache key - the rows then render as copies
      // of one another and the other rows' values are lost. Verified against
      // FPR-00015: server returned Gcash 50 + Cash 50, the table rendered
      // Gcash twice. keyFields: false keeps these embedded in the parent
      // result. The _id field is still returned, so row-click still resolves
      // to the right sale.
      ClosureSkuItem: {
        keyFields: false,
      },
      ClosurePaymentDetailItem: {
        keyFields: false,
      },
    },
  }),
})
