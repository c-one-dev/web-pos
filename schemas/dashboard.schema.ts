import { gql } from "graphql-tag"

export const dashboardSchema = gql`
  type DashboardSalesPoint {
    key: String
    label: String
    total: Float
    count: Int
    paid: Float
    unpaid: Float
    partiallyPaid: Float
  }

  type DashboardCategoryPoint {
    key: String
    label: String
    total: Float
  }

  type DashboardTeamPoint {
    key: String
    label: String
    image: String
    total: Float
  }

  type DashboardSummary {
    totalSales: Float
    totalTransactions: Int
    avgSaleValue: Float
    newCustomers: Int
    salesByDateGranularity: String
    salesByDate: [DashboardSalesPoint]
    salesByHour: [DashboardSalesPoint]
    salesByWeekday: [DashboardCategoryPoint]
    salesByProductType: [DashboardCategoryPoint]
    salesByTeam: [DashboardTeamPoint]
  }

  type Query {
    dashboardSummary(start: String!, end: String!, timezone: String): DashboardSummary
  }
`
