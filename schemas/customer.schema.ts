import { gql } from "graphql-tag"

export const customerSchema = gql`
  type Customer {
    _id: ID
    name: String
    email: String
    accountLimit: Float
    storeCredit: Float
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type CustomerConnection {
    total: Int
    pages: Int
    edges: [CustomerEdge]
    pageInfo: PageInfo
  }

  type CustomerNode {
    _id: ID!
    name: String
    email: String
    accountLimit: Float
    isActive: Boolean
  }

  type CustomerEdge {
    node: CustomerNode
    cursor: String
  }

  input CustomerInput {
    name: String
    email: String
    accountLimit: Float
    storeCredit: Float
  }

  type Query {
    customer(_id: ID!): Customer
    customerTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): CustomerConnection
    customerOptions: [Option]
  }

  type Mutation {
    createCustomer(input: CustomerInput): Response
    updateCustomer(_id: ID!, input: CustomerInput): Response
    changeCustomerStatus(_id: ID!): Response
  }
`
