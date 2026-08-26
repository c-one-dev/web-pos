import { gql } from "graphql-tag"

export const activityLogSchema = gql`
  type ActivityLogNode {
    _id: ID!
    userName: String
    activity: String
    ipAddress: String
    deviceName: String
    browser: String
    date: String
  }

  type ActivityLogEdge {
    node: ActivityLogNode
    cursor: String
  }

  type ActivityLogConnection {
    total: Int
    pages: Int
    edges: [ActivityLogEdge]
    pageInfo: PageInfo
  }

  type Query {
    activityLogTable(
      first: Int
      after: String
      start: String!
      end: String!
      search: String
    ): ActivityLogConnection
  }
`
