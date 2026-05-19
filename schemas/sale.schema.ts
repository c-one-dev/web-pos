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
  }

  type SalePayment {
    method: PaymentMethod
    amount: Float
    change: Float
    note: String
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

  type Sale {
    _id: ID
    saleNumber: String
    customer: Customer
    items: [SaleItem]
    payments: [SalePayment]
    subTotal: Float
    discount: Float
    total: Float
    receivedAmount: Float
    changeAmount: Float
    netAmount: Float
    notes: String
    currentSalePaymentStatus: SalePaymentStatus
    salePaymentStatusHistory: [SalePaymentStatusHistoryItem]
    currentSaleStatus: SaleStatus
    saleStatusHistory: [SaleStatusHistoryItem]
    register: Register
    by: User
    isOnAccount: Boolean
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

  type Query {
    sale(_id: ID!): Sale
    saleHistoryTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): SaleHistoryConnection
    saleOptions: [Option]
  }

  type Mutation {
    generateSale(input: SaleInput): Response
  }
`
