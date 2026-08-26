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

  # Register Closure Summary (full-page shift detail)
  type ClosurePaymentDetailItem {
    date: String
    _id: ID
    saleNumber: String
    saleTotal: Float
    paymentAmount: Float
    type: String
    isOnAccount: Boolean
    userName: String
  }

  type ClosureTransactionItem {
    date: String
    _id: ID
    saleNumber: String
    status: SaleStatus
    customerName: String
    discount: Float
    saleTotal: Float
    userName: String
  }

  type ClosureSkuItem {
    sku: String
    _id: ID
    date: String
    saleNumber: String
    quantity: Float
    salesExTax: Float
    totalTax: Float
    salesInc: Float
    discountOffers: Float
    orderDiscounts: Float
    saleTotal: Float
    payments: String
  }

  type ClosureCogsItem {
    itemName: String
    sku: String
    quantitySold: Float
    salesInc: Float
    salesExTax: Float
    purchaseCost: Float
    retailPrice: Float
  }

  type RegisterSessionClosureDetail {
    _id: ID
    registerName: String
    outletName: String
    openedAt: String
    openedByName: String
    closedAt: String
    closedByName: String
    paymentReceived: Float
    refunds: Float
    netReceipts: Float
    totalSalesInc: Float
    totalSalesEx: Float
    salesTaxCollected: Float
    itemDiscounts: Float
    discounts: Float
    surcharge: Float
    # Figures the closing report prints beneath the payment tally.
    openingFloat: Float
    totalCashIn: Float
    totalCashOut: Float
    newCustomers: Int
    numberOfTransactions: Int
    avgSaleValue: Float
    paymentSummary: [TallyItem]
    paymentDetails: [ClosurePaymentDetailItem]
    onAccountSales: [ClosurePaymentDetailItem]
    addsPayouts: [CashMovement]
    transactions: [ClosureTransactionItem]
    transactionsBySku: [ClosureSkuItem]
    cogs: [ClosureCogsItem]
  }

  # Paginated views of the closure tabs. The summary cards stay on
  # registerSessionClosureDetail, which still computes them over the whole
  # shift - only the row lists are paged, so the totals can not drift.
  type ClosureTransactionEdge {
    node: ClosureTransactionItem
    cursor: String
  }
  type ClosureTransactionConnection {
    total: Int
    pages: Int
    edges: [ClosureTransactionEdge]
    pageInfo: PageInfo
  }

  type ClosureSkuEdge {
    node: ClosureSkuItem
    cursor: String
  }
  type ClosureSkuConnection {
    total: Int
    pages: Int
    edges: [ClosureSkuEdge]
    pageInfo: PageInfo
  }

  type ClosurePaymentDetailEdge {
    node: ClosurePaymentDetailItem
    cursor: String
  }
  type ClosurePaymentDetailConnection {
    total: Int
    pages: Int
    edges: [ClosurePaymentDetailEdge]
    pageInfo: PageInfo
  }

  type ClosureCogsEdge {
    node: ClosureCogsItem
    cursor: String
  }
  type ClosureCogsConnection {
    total: Int
    pages: Int
    edges: [ClosureCogsEdge]
    pageInfo: PageInfo
  }

  type Query {
    activeRegisterSession(register: ID!): RegisterSession
    # Shifts the signed-in user opened and has not closed. Used to warn them
    # on logout - a user who opened nothing gets no warning.
    myOpenRegisterSessions: [RegisterSession]
    registerSession(_id: ID!): RegisterSession
    registerSessionClosureDetail(_id: ID!): RegisterSessionClosureDetail
    closureTransactions(
      _id: ID!
      first: Int
      after: String
    ): ClosureTransactionConnection
    closureTransactionsBySku(
      _id: ID!
      first: Int
      after: String
    ): ClosureSkuConnection
    closurePaymentDetails(
      _id: ID!
      first: Int
      after: String
      onAccountOnly: Boolean
      type: String
    ): ClosurePaymentDetailConnection
    closureCogs(_id: ID!, first: Int, after: String): ClosureCogsConnection
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
