import { gql } from "graphql-tag"

export const outletSchema = gql`
  type Outlet {
    _id: ID
    name: String
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type OutletConnection {
    total: Int
    pages: Int
    edges: [OutletEdge]
    pageInfo: PageInfo
  }

  type OutletNode {
    _id: ID!
    name: String
    isActive: Boolean
  }

  type OutletEdge {
    node: OutletNode
    cursor: String
  }

  input OutletInput {
    name: String
  }

  type Query {
    outlet(_id: ID!): Outlet
    outletTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): OutletConnection
    outletOptions: [Option]
  }

  type Mutation {
    createOutlet(input: OutletInput): Response
    updateOutlet(_id: ID!, input: OutletInput): Response
    changeOutletStatus(_id: ID!): Response
  }
`
