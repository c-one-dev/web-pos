import {
  permissionKeys,
  permissionKeySet,
  normalizePermissions,
} from "./permissionRegistry"

// What each role can do *by default*, expressed as permission keys from
// validators/permissionRegistry.ts.
//
// These are only defaults. An ADMIN/MANAGER can save an explicit permission
// list for any user through the Permissions dialog, and that list REPLACES the
// role default for them - it can grant access the role default doesn't
// include, or take away access it does. The role itself keeps deciding a small
// number of things permissions can never touch:
//
//   - only an ADMIN may change a user's role (resolvers/user.resolver.ts)
//   - only an ADMIN/MANAGER may manage anyone's permissions
//     (assertCanManagePermissions in resolvers/user.resolver.ts)
//   - only an ADMIN may read another user's profile via Query.user
//     (app/graphql/route.ts)
//
// so a cashier granted "users.user.view" can see the roster, but still can't
// escalate anyone's role or hand themselves more permissions.

// CASHIER's default working set: the register they stand at, the catalogue
// they sell from, and the customers they sell to. Everything else - Reports,
// Store Setup, Users - is hidden and blocked until an admin grants it
// per-user. Note this is CRUD only: the money operations on a customer
// (account limit, settlement, store credit) are deliberately NOT in the
// default and have to be granted.
const CASHIER_DEFAULT_PERMISSIONS = [
  "dashboard",
  "dashboard.view",

  // Point of Sale: Process Sale, Sale History, Cash Register.
  "pos",
  "pos.sale",
  "pos.sale.process",
  "pos.sale.edit",
  "pos.sale.settle",
  "pos.sale.refund",
  "pos.sale.void",
  "pos.sale.history",
  "pos.register",
  "pos.register.view",
  "pos.register.open",
  "pos.register.cash_movement",
  "pos.register.close",

  // Products: Products, Product Types, Brands - full CRUD.
  "products",
  "products.product",
  "products.product.view",
  "products.product.create",
  "products.product.edit",
  "products.product.status",
  "products.type",
  "products.type.view",
  "products.type.create",
  "products.type.edit",
  "products.type.status",
  "products.brand",
  "products.brand.view",
  "products.brand.create",
  "products.brand.edit",
  "products.brand.status",

  // Customers: the customer profiles themselves, full CRUD.
  "customers",
  "customers.customer",
  "customers.customer.view",
  "customers.customer.create",
  "customers.customer.edit",
  "customers.customer.status",
]

// MANAGER keeps everything ADMIN has except the two Users actions that create
// or disable an account. Manager can still open the roster and manage other
// users' permissions - that's what the Permissions dialog is for - while
// Mutation.updateUser's own ADMIN-only check keeps role changes out of reach.
const MANAGER_EXCLUDED_PERMISSIONS = new Set([
  "users.user.create",
  "users.user.status",
])

export const roleDefaultPermissions: Record<string, string[]> = {
  ADMIN: permissionKeys,
  MANAGER: permissionKeys.filter(
    (key) => !MANAGER_EXCLUDED_PERMISSIONS.has(key)
  ),
  CASHIER: normalizePermissions(CASHIER_DEFAULT_PERMISSIONS),
}

// Fail fast on a typo'd key in the defaults above rather than silently
// granting nothing - same spirit as mutationValidationRegistry.
for (const key of CASHIER_DEFAULT_PERMISSIONS) {
  if (!permissionKeySet.has(key))
    throw new Error(
      `"${key}" in CASHIER_DEFAULT_PERMISSIONS is not a key in permissionTree.`
    )
}

// The permission set actually in force for a user: their explicit list when
// one has been saved, otherwise their role's default. An empty array is a real
// value (an admin saved the dialog with nothing ticked) - only null/undefined
// means "never saved, use the role default".
export const effectivePermissions = (
  role: string | undefined,
  explicit: readonly string[] | null | undefined
): Set<string> =>
  new Set(
    explicit
      ? normalizePermissions(explicit)
      : (roleDefaultPermissions[role ?? ""] ?? [])
  )
