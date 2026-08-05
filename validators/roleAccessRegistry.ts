// Query/Mutation fields listed here require a non-CASHIER role (ADMIN or
// MANAGER). Enforced centrally in app/graphql/route.ts, right next to the
// existing session/mutation-validation guard, so a CASHIER session gets a
// real FORBIDDEN error even if they call the field directly (curl/devtools),
// not just a hidden sidebar link.
//
// Reports is deliberately NOT restricted here - Cashier has full Reports
// access (including the sensitive account-limit/store-credit/payment-note
// mutations surfaced there), same as Manager. Only Store Setup admin
// management stays Cashier-restricted below.
export const cashierRestrictedFields = new Set<string>([
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
  // Query.register (singular, by _id) is deliberately NOT listed here even
  // though it's under the Store Setup "Registers" admin page - it's also
  // the same field Cash Register and Process Sale use to load basic info
  // (name, outlet, payment methods) for whichever register a cashier is
  // actively operating. Only the admin list view is actually sensitive.
  "Query.registerTable",
  "Mutation.createRegister",
  "Mutation.updateRegister",
  "Mutation.changeRegisterStatus",
  "Mutation.changeRegisterOpenStatus",
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
