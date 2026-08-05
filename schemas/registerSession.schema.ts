import { gql } from "graphql-tag"

export const registerSessionSchema = gql`
  enum CashMovementType {
    IN
    OUT
  }

  enum RegisterSessionStatus {
    OPEN
    CLOSED
  }

  type CashMovement {
    type: CashMovementType
    amount: Float
    note: String
    date: String
    by: User
  }

  type TallyItem {
    method: PaymentMethod
    expected: Float
    counted: Float
    difference: Float
  }

  type RegisterSessionSummary {
    totalSales: Float
    totalOnAccountSales: Float
    itemDiscounts: Float
    orderDiscounts: Float
    avgSaleValue: Float
    numberOfTransactions: Int
    newCustomers: Int
    totalCashIn: Float
    totalCashOut: Float
    expectedTotals: [TallyItem]
  }

  type RegisterSession {
    _id: ID
    register: Register
    openedBy: User
    openedAt: String
    openingFloat: Float
    cashMovements: [CashMovement]
    tally: [TallyItem]
    notes: String
    closedBy: User
    closedAt: String
    status: RegisterSessionStatus
    summary: RegisterSessionSummary
  }

  input CashMovementInput {
    type: CashMovementType!
    amount: Float!
    note: String
  }

  input TallyCountInput {
    method: ID!
    counted: Float!
  }

  input CloseRegisterSessionInput {
    tally: [TallyCountInput!]!
    notes: String
  }

  # Register Session (Shift Report) Table
  type RegisterSessionTableConnection {
    total: Int
    pages: Int
    edges: [RegisterSessionTableEdge]
    pageInfo: PageInfo
  }

  type RegisterSessionTableNode {
    _id: ID!
    registerName: String
    outletName: String
    openedAt: String
    openedByName: String
    closedAt: String
    status: RegisterSessionStatus
    expected: Float
    actual: Float
    difference: Float
  }

  type RegisterSessionTableEdge {
    node: RegisterSessionTableNode
    cursor: String
  }

  type Query {
    activeRegisterSession(register: ID!): RegisterSession
    registerSession(_id: ID!): RegisterSession
    registerSessionTable(
      first: Int
      after: String
      search: String
      start: String
      end: String
      includeDeleted: Boolean
      sort: Sort
    ): RegisterSessionTableConnection
  }

  type Mutation {
    openRegisterSession(register: ID!, openingFloat: Float!): Response
    addCashMovement(_id: ID!, input: CashMovementInput!): Response
    closeRegisterSession(_id: ID!, input: CloseRegisterSessionInput!): Response
  }
`
