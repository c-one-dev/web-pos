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

  type UserPermissions {
    _id: ID!
    fullName: String
    role: Role
    # null when no explicit permissions have ever been saved for this user,
    # i.e. they still run on their role's default set below.
    permissions: [String]
    # The role default, so the dialog can show what this user gets today and
    # what "reset to role default" would mean.
    defaultPermissions: [String]
  }

  type Query {
    user(_id: ID!): User
    userPermissions(_id: ID!): UserPermissions
    # The effective permission set of the *signed-in* user, for the sidebar
    # and the client-side route guard. Never gated - every session needs it.
    myPermissions: [String]
    userTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): UserConnection
    userOptions: [Option]
    activeUsers: [UserNode]
  }

  type Mutation {
    createUser(input: UserInput): Response
    updateUser(_id: ID!, input: UserInput): Response
    changeUserStatus(_id: ID!): Response
    updateUserPermissions(_id: ID!, permissions: [String!]!): Response
    changePassword(oldPassword: String!, newPassword: String!): Response
  }
`
