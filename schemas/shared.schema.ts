import { gql } from "graphql-tag"

export const sharedSchema = gql`
  scalar JSON

  type Option {
    label: String
    value: String
  }

  type Response {
    ok: Boolean
    message: String
    data: JSON
  }

  type PageInfo {
    hasNextPage: Boolean
    endCursor: String
  }

  enum FilterType {
    TEXT
    NUMBER
    DATE
    BOOLEAN
  }

  input Filter {
    key: String
    value: String
    type: FilterType
  }

  enum SortOrder {
    ASC
    DESC
  }

  input Sort {
    key: String
    order: SortOrder
  }
`
