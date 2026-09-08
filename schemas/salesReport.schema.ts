import { gql } from "graphql-tag"

export const salesReportSchema = gql`
  type SalesTransactionItem {
    name: String
    sku: String
    quantitySold: Float
    sales: Float
    discounts: Float
  }

  type SalesTransactionNode {
    _id: ID!
    saleNumber: String
    date: String
    customerName: String
    itemsSummary: String
    items: [SalesTransactionItem]
    outletName: String
    currentSaleStatus: SaleStatus
    # What is shown in the Status column for a carried-over receipt: the old
    # system reported those by whether they had been paid, not by whether the
    # sale completed.
    currentSalePaymentStatus: SalePaymentStatus
    isOnAccount: Boolean
    isImported: Boolean
    paymentTypes: [String]
    total: Float
    byName: String
    # When the sale became fully PAID. Null while anything is still owed -
    # an on-account sale has no completed date until it is settled.
    completedDate: String
    # Sale notes plus every payment reference / note, which is where a GCash
    # or card reference ends up.
    notes: String
    itemDiscount: Float
    saleDiscount: Float
    quantitySold: Float
  }

  type SalesTransactionEdge {
    node: SalesTransactionNode
    cursor: String
  }

  type SalesTransactionConnection {
    total: Int
    pages: Int
    edges: [SalesTransactionEdge]
    pageInfo: PageInfo
  }

  type SalesByItemNode {
    _id: ID!
    name: String
    sku: String
    quantitySold: Float
    salesExTax: Float
    discounts: Float
  }

  type Query {
    salesTransactionTable(
      first: Int
      after: String
      search: String
      start: String
      end: String
      sort: Sort
    ): SalesTransactionConnection
    salesByItemTable(start: String!, end: String!): [SalesByItemNode]
    salesOutlets(start: String!, end: String!): [String]
  }
`
