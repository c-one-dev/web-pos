import { gql } from "graphql-tag"

export const saleSchema = gql`
  enum SaleStatus {
    PENDING
    COMPLETED
    REFUNDED
    VOIDED
  }

  enum SalePaymentStatus {
    PAID
    UNPAID
    # An On Account sale whose debt hasn't been settled yet.
    PENDING
    PARTIALLY_PAID
    REFUNDED
  }

  type SaleItem {
    product: Product
    snapshotName: String
    snapshotPrice: Float
    quantity: Int
    discount: Float
    price: Float
    subTotal: Float
    total: Float
    refundedQuantity: Int
  }

  type SaleSettlement {
    amount: Float
    method: PaymentMethod
    note: String
    date: String
    by: User
    register: Register
  }

  input SettleSaleInput {
    _id: ID!
    amount: Float!
  }

  type SaleRefundItem {
    itemIndex: Int
    snapshotName: String
    quantity: Int
    amount: Float
  }

  type SaleRefund {
    items: [SaleRefundItem]
    amount: Float
    note: String
    date: String
    by: User
  }

  input RefundItemInput {
    itemIndex: Int!
    quantity: Int!
  }

  type SalePayment {
    method: PaymentMethod
    amount: Float
    change: Float
    note: String
    # Provider reference / card approval code. Separate from note - see the
    # model for why.
    reference: String
    date: String
    payment: Payment
  }

  type SaleStatusHistoryItem {
    status: SaleStatus
    date: String
    by: User
  }

  type SalePaymentStatusHistoryItem {
    status: SalePaymentStatus
    date: String
    by: User
    paymentRef: Payment
  }

  type OutstandingSaleNode {
    _id: ID!
    saleNumber: String
    date: String
    total: Float
    settledAmount: Float
    outstandingAmount: Float
    currentSalePaymentStatus: SalePaymentStatus
  }

  type Sale {
    _id: ID
    saleNumber: String
    customer: Customer
    items: [SaleItem]
    payments: [SalePayment]
    subTotal: Float
    discount: Float
    total: Float
    settledAmount: Float
    settlements: [SaleSettlement]
    # The On Account portion still owed on this sale.
    outstandingAmount: Float
    refundedAmount: Float
    refunds: [SaleRefund]
    receivedAmount: Float
    changeAmount: Float
    netAmount: Float
    # Change the customer kept as store credit instead of taking in cash.
    # changeAmount is 0 on such a sale - the cash stayed in the drawer.
    changeCreditedAmount: Float
    notes: String
    currentSalePaymentStatus: SalePaymentStatus
    salePaymentStatusHistory: [SalePaymentStatusHistoryItem]
    currentSaleStatus: SaleStatus
    saleStatusHistory: [SaleStatusHistoryItem]
    register: Register
    by: User
    isOnAccount: Boolean
    isEditable: Boolean
    createdAt: String
    updatedAt: String
  }

  type SaleConnection {
    total: Int
    pages: Int
    edges: [SaleEdge]
    pageInfo: PageInfo
  }

  type SaleNode {
    _id: ID!
    saleNumber: String
    createdAt: String
    updatedAt: String
  }

  type SaleEdge {
    node: SaleNode
    cursor: String
  }

  input SaleItemInput {
    product: ID
    snapshotName: String
    snapshotPrice: Float
    quantity: Int
    discount: Float
    price: Float
    subTotal: Float
    total: Float
  }

  input SalePaymentInput {
    method: ID
    amount: Float
    change: Float
    note: String
    reference: String
    date: String
  }

  input SaleInput {
    customer: ID
    items: [SaleItemInput]
    payments: [SalePaymentInput]
    subTotal: Float
    discount: Float
    total: Float
    receivedAmount: Float
    changeAmount: Float
    netAmount: Float
    notes: String
    register: ID
    # When true and the sale has change due, the change is retained as store
    # credit for the customer instead of being handed back in cash.
    changeToStoreCredit: Boolean
  }

  # Sale History Table
  type SaleHistoryConnection {
    total: Int
    pages: Int
    edges: [SaleHistoryEdge]
    pageInfo: PageInfo
  }

  type SaleHistoryNode {
    _id: ID!
    date: String
    saleNumber: String
    customerName: String
    saleTotal: Float
    currentSaleStatus: SaleStatus
    currentSalePaymentStatus: SalePaymentStatus
    notes: String
    paymentNotes: String
  }

  type SaleHistoryEdge {
    node: SaleHistoryNode
    cursor: String
  }

  # Customer Sales Table
  type CustomerSaleConnection {
    total: Int
    pages: Int
    edges: [CustomerSaleEdge]
    pageInfo: PageInfo
  }

  type CustomerSaleNode {
    _id: ID!
    saleNumber: String
    date: String
    outletName: String
    total: Float
    paid: Float
    outstanding: Float
    currentSaleStatus: SaleStatus
    currentSalePaymentStatus: SalePaymentStatus
  }

  type CustomerSaleEdge {
    node: CustomerSaleNode
    cursor: String
  }

  # Voided Sale Table (Register report -> Voided Transactions)
  type VoidedSaleConnection {
    total: Int
    pages: Int
    edges: [VoidedSaleEdge]
    pageInfo: PageInfo
  }

  type VoidedSaleNode {
    _id: ID!
    saleNumber: String
    registerName: String
    outletName: String
    amount: Float
    voidedAt: String
    voidedByName: String
  }

  type VoidedSaleEdge {
    node: VoidedSaleNode
    cursor: String
  }

  type Query {
    sale(_id: ID!): Sale
    saleHistoryTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): SaleHistoryConnection
    customerSalesTable(
      customer: ID!
      first: Int
      after: String
    ): CustomerSaleConnection
    # Every sale of this customer that still owes money, for the bulk
    # payment drawer. Not paginated - a customer's unsettled list is short by
    # nature, and the drawer needs the full total to be meaningful.
    customerOutstandingSales(customer: ID!): [OutstandingSaleNode]
    voidedSaleTable(
      first: Int
      after: String
      search: String
      start: String
      end: String
      sort: Sort
    ): VoidedSaleConnection
    saleOptions: [Option]
  }

  type Mutation {
    generateSale(input: SaleInput): Response
    updateSale(_id: ID!, input: SaleInput): Response
    voidSale(_id: ID!): Response
    updateSaleNotes(_id: ID!, notes: String): Response
    settleSales(
      sales: [SettleSaleInput!]!
      method: ID!
      register: ID!
      note: String
    ): Response
    refundSaleItems(
      _id: ID!
      items: [RefundItemInput!]!
      note: String
    ): Response
  }
`
