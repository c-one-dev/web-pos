import { gql } from "graphql-tag"

export const productSchema = gql`
  type ProductPriceHistoryItem {
    price: Float
    date: String
  }

  type Product {
    _id: ID
    image: String
    sku: String
    name: String
    barcode: String
    description: String
    currentPrice: Float
    priceHistory: [ProductPriceHistoryItem]
    brand: Brand
    type: ProductType
    registers: [Register]
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type ProductConnection {
    total: Int
    pages: Int
    edges: [ProductEdge]
    pageInfo: PageInfo
  }

  type ProductNode {
    _id: ID!
    name: String
    sku: String
    currentPrice: Float
    isActive: Boolean
  }

  type ProductEdge {
    node: ProductNode
    cursor: String
  }

  input ProductInput {
    name: String
    image: String
    sku: String
    barcode: String
    description: String
    currentPrice: Float
    brand: ID
    type: ID
    registers: [ID]
  }

  type Query {
    product(_id: ID!): Product
    productTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): ProductConnection
    productOptions: [Option]
  }

  type Mutation {
    createProduct(input: ProductInput): Response
    updateProduct(_id: ID!, input: ProductInput): Response
    changeProductStatus(_id: ID!): Response
  }
`
