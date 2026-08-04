import { gql } from "graphql-tag"

export const timecardSchema = gql`
  type TimeCard {
    _id: ID!
    user: User
    clockIn: String
    clockOut: String
  }

  type TimeCardByUserNode {
    _id: ID!
    userName: String
    hoursLogged: Float
  }

  type TimeCardByDateNode {
    _id: ID!
    date: String
    clockIn: String
    clockOut: String
    userName: String
    hoursLogged: Float
  }

  type Query {
    activeTimeCard: TimeCard
    timeCardByUserTable(
      start: String!
      end: String!
      search: String
    ): [TimeCardByUserNode]
    timeCardByDateTable(
      start: String!
      end: String!
      search: String
    ): [TimeCardByDateNode]
  }

  type Mutation {
    clockIn: Response
    clockOut: Response
  }
`
