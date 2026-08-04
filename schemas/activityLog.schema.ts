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

  type Query {
    activityLogTable(
      start: String!
      end: String!
      search: String
    ): [ActivityLogNode]
  }
`
