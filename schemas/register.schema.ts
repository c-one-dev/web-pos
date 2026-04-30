import { gql } from "graphql-tag"

export const registerSchema = gql`
  enum Day {
    SUNDAY
    MONDAY
    TUESDAY
    WEDNESDAY
    THURSDAY
    FRIDAY
    SATURDAY
  }

  type ScheduleItem {
    day: Day
    openingTime: String
    closingTime: String
  }

  type Register {
    _id: ID
    name: String
    outlet: Outlet
    prefix: String
    paymentMethods: [PaymentMethod]
    schedule: [ScheduleItem]
    isOpen: Boolean
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type ProcessedRegister {
    _id: ID
    name: String
    outlet: Outlet
    prefix: String
    paymentMethods: [PaymentMethod]
    schedule: [ScheduleItem]
    productTypes: [ProductType]
    products: [Product]
  }

  type RegisterConnection {
    total: Int
    pages: Int
    edges: [RegisterEdge]
    pageInfo: PageInfo
  }

  type RegisterNode {
    _id: ID!
    name: String
    outletName: String
    prefix: String
    isOpen: Boolean
    isActive: Boolean
  }

  type RegisterEdge {
    node: RegisterNode
    cursor: String
  }

  input ScheduleItemInput {
    day: Day
    openingTime: String
    closingTime: String
  }

  input RegisterInput {
    name: String
    outlet: ID
    prefix: String
    paymentMethods: [ID]
    schedule: [ScheduleItemInput]
  }

  type Query {
    register(_id: ID!): Register
    processedRegister(_id: ID!): ProcessedRegister
    registerTable(
      first: Int
      after: String
      search: String
      filter: [Filter]
      sort: Sort
    ): RegisterConnection
    registers: [Register]
    registerOptions: [Option]
  }

  type Mutation {
    createRegister(input: RegisterInput): Response
    updateRegister(_id: ID!, input: RegisterInput): Response
    changeRegisterStatus(_id: ID!): Response
  }
`
