import { gql } from "graphql-tag"

export const customerSchema = gql`
  type AccountLimitHistoryItem {
    remaining: Float
    transacted: Float
    date: String
    description: String
  }

  type AccountLimit {
    max: Float
    current: Float
    history: [AccountLimitHistoryItem]
  }

  type StoreCreditHistoryItem {
    _id: ID
    remaining: Float
    transacted: Float
    date: String
    description: String
  }

  type StoreCredit {
    current: Float
    history: [StoreCreditHistoryItem]
  }

  enum CustomerType {
    CUSTOMER
    EMPLOYEE
  }

  # Change the customer chose to leave on their account at checkout. A
  # separate wallet from store credit, which comes from refunds and manual
  # issuance instead.
  type CurrentBalanceHistoryItem {
    _id: ID
    remaining: Float
    transacted: Float
    date: String
    description: String
  }

  type CurrentBalance {
    current: Float
    history: [CurrentBalanceHistoryItem]
  }

  type Customer {
    _id: ID
    firstName: String
    middleName: String
    lastName: String
    name: String
    type: CustomerType
    email: String
    accountLimit: AccountLimit
    storeCredit: StoreCredit
    currentBalance: CurrentBalance
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type CustomerReport {
    _id: ID
    name: String
    email: String
    accountLimit: AccountLimit
    storeCredit: StoreCredit
    currentBalance: CurrentBalance
    createdAt: String
  }

  # Customer Table
  type CustomerConnection {
    total: Int
    pages: Int
    edges: [CustomerEdge]
    pageInfo: PageInfo
  }

  type CustomerNode {
    _id: ID!
    name: String
    type: CustomerType
    isActive: Boolean
  }

  type CustomerEdge {
    node: CustomerNode
    cursor: String
  }

  # Customer Report Table
  type CustomerReportConnection {
    total: Int
    pages: Int
    edges: [CustomerReportEdge]
    pageInfo: PageInfo
  }

  type CustomerReportNode {
    _id: ID!
    name: String
    remainingAccountLimit: Float
    remainingStoreCredit: Float
    currentBalance: Float
    isActive: Boolean
  }

  type CustomerReportEdge {
    node: CustomerReportNode
    cursor: String
  }

  # Customer Credit History Table
  type CustomerCreditHistoryConnection {
    total: Int
    pages: Int
    edges: [CustomerCreditHistoryEdge]
    pageInfo: PageInfo
  }

  type CustomerCreditHistoryNode {
    _id: ID!
    remaining: Float
    transacted: Float
    date: String
    description: String
  }

  type CustomerCreditHistoryEdge {
    node: CustomerCreditHistoryNode
    cursor: String
  }

  # Customer Limit History Table
  type CustomerLimitHistoryConnection {
    total: Int
    pages: Int
    edges: [CustomerLimitHistoryEdge]
    pageInfo: PageInfo
  }

  type CustomerLimitHistoryNode {
    _id: ID!
    remaining: Float
    transacted: Float
    date: String
    description: String
  }

  type CustomerLimitHistoryEdge {
    node: CustomerLimitHistoryNode
    cursor: String
  }

  # Inputs
  input CustomerInput {
    firstName: String
    middleName: String
    lastName: String
    type: CustomerType
    email: String
    # Opening balances - honoured by createCustomer only. Later changes go
    # through adjustAccountLimit / adjustStoreCredit so they stay audited.
    accountLimit: Float
    storeCredit: Float
  }

  type Query {
    customer(_id: ID!): Customer
    customerReport(_id: ID!): CustomerReport
    customerCreditHistoryItemById(
      customerId: ID!
      itemId: ID!
    ): StoreCreditHistoryItem
    customerTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): CustomerConnection
    customerReportTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): CustomerReportConnection
    customerCreditHistoryTable(
      first: Int
      after: String
      customerId: ID!
    ): CustomerCreditHistoryConnection
    customerLimitHistoryTable(
      first: Int
      after: String
      customerId: ID!
    ): CustomerLimitHistoryConnection
    customerOptions: [Option]
  }

  type Mutation {
    createCustomer(input: CustomerInput): Response
    adjustAccountLimit(_id: ID!, amount: Float!): Response
    settleAccountBalance(_id: ID!, amount: Float!): Response
    adjustStoreCredit(_id: ID!, amount: Float!, description: String): Response
    updateCustomer(_id: ID!, input: CustomerInput): Response
    changeCustomerStatus(_id: ID!): Response
  }
`
