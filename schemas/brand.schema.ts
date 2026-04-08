import { gql } from "graphql-tag"

export const brandSchema = gql`
  type Brand {
    _id: ID
    name: String
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type BrandConnection {
    total: Int
    pages: Int
    edges: [BrandEdge]
    pageInfo: PageInfo
  }

  type BrandNode {
    _id: ID!
    name: String
    isActive: Boolean
  }

  type BrandEdge {
    node: BrandNode
    cursor: String
  }

  input BrandInput {
    name: String
  }

  type Query {
    brand(_id: ID!): Brand
    brandTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): BrandConnection
    brandOptions: [Option]
  }

  type Mutation {
    createBrand(input: BrandInput): Response
    updateBrand(_id: ID!, input: BrandInput): Response
    changeBrandStatus(_id: ID!): Response
  }
`
