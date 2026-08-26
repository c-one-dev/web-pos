import { gql } from "graphql-tag"

export const salesTargetSchema = gql`
  enum SalesTargetPeriod {
    DAILY
    WEEKLY
    MONTHLY
  }

  type SalesTargetNode {
    _id: ID!
    userName: String
    totalSalesCount: Int
    totalSales: Float
    target: Float
    achievedPercent: Float
  }

  type SalesTargetEdge {
    node: SalesTargetNode
    cursor: String
  }

  type SalesTargetConnection {
    total: Int
    pages: Int
    edges: [SalesTargetEdge]
    pageInfo: PageInfo
  }

  type Query {
    salesTargetTable(
      first: Int
      after: String
      period: SalesTargetPeriod
      date: String
      search: String
    ): SalesTargetConnection
  }

  type Mutation {
    setSalesTarget(
      user: ID!
      period: SalesTargetPeriod!
      target: Float!
    ): Response
  }
`
