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

  type Query {
    salesTargetTable(
      period: SalesTargetPeriod
      date: String
      search: String
    ): [SalesTargetNode]
  }

  type Mutation {
    setSalesTarget(user: ID!, period: SalesTargetPeriod!, target: Float!): Response
  }
`
