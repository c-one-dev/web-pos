import { gql } from "graphql-tag"

export const userSchema = gql`
  enum Role {
    ADMIN
    MANAGER
    CASHIER
  }

  type User {
    _id: ID
    image: String
    name: String
    surname: String
    displayName: String
    email: String
    username: String
    role: Role
    pin: String
    mustChangePassword: Boolean
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type UserConnection {
    total: Int
    pages: Int
    edges: [UserEdge]
    pageInfo: PageInfo
  }

  type UserNode {
    _id: ID!
    image: String
    fullName: String
    role: Role
    isActive: Boolean
  }

  type UserEdge {
    node: UserNode
    cursor: String
  }

  input UserInput {
    image: String
    name: String
    surname: String
    displayName: String
    email: String
    username: String
    role: Role
    pin: String
  }

  type Query {
    user(_id: ID!): User
    userTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): UserConnection
    userOptions: [Option]
  }

  type Mutation {
    createUser(input: UserInput): Response
    updateUser(_id: ID!, input: UserInput): Response
    changeUserStatus(_id: ID!): Response
    changePassword(oldPassword: String!, newPassword: String!): Response
  }
`
