import { gql } from "graphql-tag"

export const productTypeSchema = gql`
  type ProductType {
    _id: ID
    name: String
    parent: ProductType
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type ProductTypeConnection {
    total: Int
    pages: Int
    edges: [ProductTypeEdge]
    pageInfo: PageInfo
  }

  type ProductTypeNode {
    _id: ID!
    name: String
    parentName: String
    isActive: Boolean
  }

  type ProductTypeEdge {
    node: ProductTypeNode
    cursor: String
  }

  input ProductTypeInput {
    name: String
    parent: ID
  }

  type Query {
    productType(_id: ID!): ProductType
    productTypeTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): ProductTypeConnection
    productTypeOptions: [Option]
  }

  type Mutation {
    createProductType(input: ProductTypeInput): Response
    updateProductType(_id: ID!, input: ProductTypeInput): Response
    changeProductTypeStatus(_id: ID!): Response
  }
`
