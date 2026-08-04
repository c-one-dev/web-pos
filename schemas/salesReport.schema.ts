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
    isOnAccount: Boolean
    paymentTypes: [String]
    total: Float
    byName: String
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
