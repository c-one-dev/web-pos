import { gql } from "graphql-tag"

export const paymentSchema = gql`
  type Payment {
    _id: ID
    amount: Float
    method: PaymentMethod
    change: Float
    date: String
    note: String
    by: User
    sale: [Sale]
    createdAt: String
    updatedAt: String
  }

  type PaymentConnection {
    total: Int
    pages: Int
    edges: [PaymentEdge]
    pageInfo: PageInfo
  }

  type PaymentNode {
    _id: ID!
    amount: String
    note: String
    byName: String
    saleList: [String]
    methodName: String
    paymentDate: String
  }

  type PaymentEdge {
    node: PaymentNode
    cursor: String
  }

  type PaymentSummary {
    salesInc: Float
    salesEx: Float
    refunds: Float
    discounts: Float
    netSales: Float
  }

  type PaymentTypeSummaryNode {
    _id: ID!
    name: String
    totalCollected: Float
    refunds: Float
    net: Float
  }

  type Query {
    payment(_id: ID!): Payment
    paymentTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): PaymentConnection
    paymentSummary(start: String!, end: String!): PaymentSummary
    paymentTypeSummary(start: String!, end: String!): [PaymentTypeSummaryNode]
  }

  type Mutation {
    updatePaymentNote(_id: ID!, note: String): Response
  }
`
