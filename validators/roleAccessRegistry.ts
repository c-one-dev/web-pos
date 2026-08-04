// Query/Mutation fields listed here require a non-CASHIER role (ADMIN or
// MANAGER). Enforced centrally in app/graphql/route.ts, right next to the
// existing session/mutation-validation guard, so a CASHIER session gets a
// real FORBIDDEN error even if they call the field directly (curl/devtools),
// not just a hidden sidebar link.
//
// Only the "management" surface for each domain is listed here — read-only
// `*Options` lookups used by cashier-facing forms (e.g. brandOptions,
// paymentMethodOptions) are deliberately left out, along with anything the
// Point of Sale / Dashboard / Customers pages need (generateSale, voidSale,
// activeRegisterSession, openRegisterSession, dashboardSummary, customer
// CRUD, etc.).
export const cashierRestrictedFields = new Set<string>([
  // Reports (entire section hidden from Cashier)
  "Query.salesTransactionTable",
  "Query.salesByItemTable",
  "Query.salesOutlets",
  "Query.voidedSaleTable",
  "Query.paymentSummary",
  "Query.paymentTypeSummary",
  "Query.paymentTable",
  "Query.payment",
  "Query.registerSessionTable",
  "Query.registerSession",
  "Query.customerReport",
  "Query.customerReportTable",
  "Query.customerCreditHistoryTable",
  "Query.customerLimitHistoryTable",
  "Query.customerCreditHistoryItemById",
  "Query.customerSalesTable",
  "Mutation.adjustAccountLimit",
  "Mutation.settleAccountBalance",
  "Mutation.adjustStoreCredit",
  "Mutation.updatePaymentNote",

  // Store Setup admin management (Users / Outlets / Payment Methods /
  // Brands / Registers) — Customers is deliberately NOT listed here, since
  // Cashier keeps access to that one.
  "Query.userTable",
  "Mutation.createUser",
  "Mutation.changeUserStatus",
  "Query.outletTable",
  "Query.outlet",
  "Mutation.createOutlet",
  "Mutation.updateOutlet",
  "Mutation.changeOutletStatus",
  "Query.paymentMethodTable",
  "Query.paymentMethod",
  "Mutation.createPaymentMethod",
  "Mutation.updatePaymentMethod",
  "Mutation.changePaymentMethodStatus",
  "Query.brandTable",
  "Query.brand",
  "Mutation.createBrand",
  "Mutation.updateBrand",
  "Mutation.changeBrandStatus",
  "Query.registerTable",
  "Query.register",
  "Mutation.createRegister",
  "Mutation.updateRegister",
  "Mutation.changeRegisterStatus",
  "Mutation.changeRegisterOpenStatus",

  // "Users" report (timecards / activity log / sales targets) - Admin and
  // Manager only, same as the rest of Reports. Note: Query.activeTimeCard
  // and Mutation.clockIn/clockOut are deliberately NOT listed here - every
  // role clocks in/out for themselves, it isn't a Reports-domain action.
  "Query.timeCardByUserTable",
  "Query.timeCardByDateTable",
  "Query.activityLogTable",
  "Query.salesTargetTable",
  "Mutation.setSalesTarget",
])

// MANAGER keeps everything ADMIN has except the Users domain — Manager must
// not see the Users list/management page or be able to create users, change
// their active status, or (via Mutation.updateUser's own ADMIN-only check)
// edit another user's fields or role at all.
export const managerRestrictedFields = new Set<string>([
  "Query.userTable",
  "Mutation.createUser",
  "Mutation.changeUserStatus",
])
