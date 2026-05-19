import { gql } from "graphql-tag"

export const paymentSchema = gql`
  type Payment {
    _id: ID
    amount: Float
    method: PaymentMethod
    change: Float
    date: String
    note: String
    by: User
    sale: [Sale]
    createdAt: String
    updatedAt: String
  }
`
