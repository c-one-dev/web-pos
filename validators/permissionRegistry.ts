// Per-user access permissions.
//
// A user's effective access is their explicit permission list when an
// ADMIN/MANAGER has saved one through the Permissions dialog, and otherwise
// their role's default set (validators/roleAccessRegistry.ts). An explicit
// list REPLACES the default - it can grant access the role default doesn't
// include, or take away access it does.
//
// A few things stay role-decided no matter what is ticked here: only an ADMIN
// can change a user's role, only an ADMIN/MANAGER can manage anyone's
// permissions, and only an ADMIN can read another user's profile. So granting
// a cashier "users.user.view" lets them see the roster without ever letting
// them escalate themselves.
//
// IMPORTANT: only features that actually exist in this app belong here. Every
// leaf below maps to at least one real GraphQL field, so ticking/unticking a
// box has a real server-side effect. Do not add aspirational entries (stock,
// gift cards, loyalty, online store, ...) - an unenforceable checkbox is worse
// than no checkbox.

export type PermissionNode = {
  key: string
  label: string
  // Query/Mutation fields (`Type.field`) this permission gates.
  fields?: string[]
  children?: PermissionNode[]
}

export const permissionTree: PermissionNode[] = [
  {
    key: "dashboard",
    label: "DASHBOARD",
    children: [
      {
        key: "dashboard.view",
        label: "Access the dashboard",
        fields: ["Query.dashboardSummary"],
      },
    ],
  },
  {
    key: "pos",
    label: "POINT OF SALE",
    children: [
      {
        key: "pos.sale",
        label: "Process sale",
        children: [
          {
            key: "pos.sale.process",
            label: "Process a sale",
            fields: ["Mutation.generateSale", "Query.processedRegister"],
          },
          {
            key: "pos.sale.edit",
            label: "Edit an existing sale",
            fields: ["Mutation.updateSale", "Mutation.updateSaleNotes"],
          },
          {
            key: "pos.sale.refund",
            label: "Refund sale items as store credit",
            fields: ["Mutation.refundSaleItems"],
          },
          {
            key: "pos.sale.void",
            label: "Void a sale transaction",
            fields: ["Mutation.voidSale"],
          },
          {
            key: "pos.sale.history",
            label: "View sales history",
            fields: [
              "Query.saleHistoryTable",
              "Query.sale",
              "Query.customerSalesTable",
            ],
          },
        ],
      },
      {
        key: "pos.register",
        label: "Cash register",
        children: [
          {
            key: "pos.register.view",
            label: "View register sessions and closure details",
            fields: [
              "Query.registerSession",
              "Query.activeRegisterSession",
              "Query.registerSessionClosureDetail",
            ],
          },
          {
            key: "pos.register.open",
            label: "Allow to open the cash register",
            fields: [
              "Mutation.openRegisterSession",
              "Mutation.changeRegisterOpenStatus",
            ],
          },
          {
            key: "pos.register.cash_movement",
            label: "Add or remove cash with cash-in/cash-out feature",
            fields: ["Mutation.addCashMovement"],
          },
          {
            key: "pos.register.close",
            label: "Perform register closure transaction",
            fields: ["Mutation.closeRegisterSession"],
          },
        ],
      },
    ],
  },
  {
    key: "products",
    label: "PRODUCTS",
    children: [
      {
        key: "products.product",
        label: "Products",
        children: [
          {
            key: "products.product.view",
            label: "View products",
            fields: ["Query.productTable", "Query.product"],
          },
          {
            key: "products.product.create",
            label: "Create a new product",
            fields: ["Mutation.createProduct"],
          },
          {
            key: "products.product.edit",
            label: "Edit an existing product",
            fields: ["Mutation.updateProduct"],
          },
          {
            key: "products.product.status",
            label: "Activate/deactivate a product",
            fields: ["Mutation.changeProductStatus"],
          },
        ],
      },
      {
        key: "products.type",
        label: "Product types",
        children: [
          {
            key: "products.type.view",
            label: "View product types",
            fields: [
              "Query.productTypeTable",
              "Query.productType",
              "Query.productTypeAssignedProducts",
            ],
          },
          {
            key: "products.type.create",
            label: "Create a new product type",
            fields: ["Mutation.createProductType"],
          },
          {
            key: "products.type.edit",
            label: "Edit an existing product type",
            fields: ["Mutation.updateProductType"],
          },
          {
            key: "products.type.status",
            label: "Activate/deactivate a product type",
            fields: ["Mutation.changeProductTypeStatus"],
          },
        ],
      },
      {
        key: "products.brand",
        label: "Brands",
        children: [
          {
            key: "products.brand.view",
            label: "View brands",
            fields: ["Query.brandTable", "Query.brand"],
          },
          {
            key: "products.brand.create",
            label: "Create a new product brand",
            fields: ["Mutation.createBrand"],
          },
          {
            key: "products.brand.edit",
            label: "Edit an existing brand",
            fields: ["Mutation.updateBrand"],
          },
          {
            key: "products.brand.status",
            label: "Activate/deactivate a brand",
            fields: ["Mutation.changeBrandStatus"],
          },
        ],
      },
    ],
  },
  {
    key: "customers",
    label: "CUSTOMERS",
    children: [
      {
        key: "customers.customer",
        label: "Customers",
        children: [
          {
            key: "customers.customer.view",
            label: "View customer detail",
            // customerReport is also the balance lookup the Process Sale pay
            // dialog does before an on-account/store-credit tender, so seeing
            // a customer is enough for it - the Customers *report* page needs
            // reports.customers on top.
            fields: [
              "Query.customerTable",
              "Query.customer",
              "Query.customerReport",
            ],
          },
          {
            key: "customers.customer.create",
            label: "Create a new customer profile",
            fields: ["Mutation.createCustomer"],
          },
          {
            key: "customers.customer.edit",
            label: "Edit an existing customer profile",
            fields: ["Mutation.updateCustomer"],
          },
          {
            key: "customers.customer.status",
            label: "Activate/deactivate a customer",
            fields: ["Mutation.changeCustomerStatus"],
          },
        ],
      },
      {
        key: "customers.account_limit",
        label: "Adjust a customer's account limit",
        fields: ["Mutation.adjustAccountLimit"],
      },
      {
        key: "customers.settle",
        label: "Settle a customer's account balance",
        fields: ["Mutation.settleAccountBalance"],
      },
      {
        key: "customers.store_credit",
        label: "Manually issue store credits",
        fields: ["Mutation.adjustStoreCredit"],
      },
    ],
  },
  {
    key: "reports",
    label: "REPORTING",
    children: [
      {
        key: "reports.sales",
        label: "Access sales reports",
        // dashboardSummary/paymentSummary are shared with the Dashboard and
        // the Payments report - a field reachable from several permissions is
        // allowed if the user holds ANY of them (see fieldPermissionMap).
        fields: [
          "Query.salesTransactionTable",
          "Query.salesByItemTable",
          "Query.dashboardSummary",
          "Query.paymentSummary",
        ],
      },
      {
        key: "reports.customers",
        label: "Access customer reports",
        fields: [
          "Query.customerReportTable",
          "Query.customerReport",
          "Query.customerCreditHistoryTable",
          "Query.customerLimitHistoryTable",
          "Query.customerCreditHistoryItemById",
        ],
      },
      {
        key: "reports.payments",
        label: "Access payment reports",
        fields: [
          "Query.paymentTable",
          "Query.payment",
          "Query.paymentSummary",
          "Query.paymentTypeSummary",
        ],
        children: [
          {
            key: "reports.payments.note",
            label: "Update a payment note",
            fields: ["Mutation.updatePaymentNote"],
          },
        ],
      },
      {
        key: "reports.register",
        label: "Access register reports",
        fields: ["Query.registerSessionTable", "Query.voidedSaleTable"],
      },
      {
        key: "reports.users",
        label: "Access user reports",
        fields: ["Query.activityLogTable", "Query.salesTargetTable"],
        children: [
          {
            key: "reports.users.target",
            label: "Set a user's sales target",
            fields: ["Mutation.setSalesTarget"],
          },
        ],
      },
    ],
  },
  {
    key: "users",
    label: "USERS",
    children: [
      {
        key: "users.user",
        label: "Users",
        children: [
          {
            key: "users.user.view",
            label: "Access and edit staff roster",
            fields: ["Query.userTable"],
          },
          {
            key: "users.user.create",
            label: "Create a new user",
            fields: ["Mutation.createUser"],
          },
          {
            key: "users.user.edit",
            label: "Edit an existing user",
            fields: ["Mutation.updateUser"],
          },
          {
            key: "users.user.status",
            label: "Activate/deactivate a user",
            fields: ["Mutation.changeUserStatus"],
          },
          {
            key: "users.user.permissions",
            label: "Grant/remove user access permissions for any user",
            fields: ["Query.userPermissions", "Mutation.updateUserPermissions"],
          },
        ],
      },
    ],
  },
  {
    key: "store",
    label: "STORE SETUP",
    children: [
      {
        key: "store.outlet",
        label: "Outlets",
        children: [
          {
            key: "store.outlet.view",
            label: "View outlets",
            fields: ["Query.outletTable", "Query.outlet"],
          },
          {
            key: "store.outlet.create",
            label: "Create a new outlet",
            fields: ["Mutation.createOutlet"],
          },
          {
            key: "store.outlet.edit",
            label: "Edit an existing outlet",
            fields: ["Mutation.updateOutlet"],
          },
          {
            key: "store.outlet.status",
            label: "Activate/deactivate an outlet",
            fields: ["Mutation.changeOutletStatus"],
          },
        ],
      },
      {
        key: "store.register",
        label: "Cash registers",
        children: [
          {
            key: "store.register.view",
            label: "View cash registers",
            fields: ["Query.registerTable"],
          },
          {
            key: "store.register.create",
            label: "Create a new cash register",
            fields: ["Mutation.createRegister"],
          },
          {
            key: "store.register.edit",
            label: "Edit an existing cash register",
            fields: ["Mutation.updateRegister"],
          },
          {
            key: "store.register.status",
            label: "Activate/deactivate a register",
            fields: ["Mutation.changeRegisterStatus"],
          },
        ],
      },
      {
        key: "store.payment_method",
        label: "Payment types",
        children: [
          {
            key: "store.payment_method.view",
            label: "View payment types",
            fields: ["Query.paymentMethodTable", "Query.paymentMethod"],
          },
          {
            key: "store.payment_method.create",
            label: "Create a new payment type",
            fields: ["Mutation.createPaymentMethod"],
          },
          {
            key: "store.payment_method.edit",
            label: "Edit an existing payment type",
            fields: ["Mutation.updatePaymentMethod"],
          },
          {
            key: "store.payment_method.status",
            label: "Activate/deactivate a payment type",
            fields: ["Mutation.changePaymentMethodStatus"],
          },
        ],
      },
    ],
  },
]

const walk = (
  nodes: PermissionNode[],
  visit: (node: PermissionNode) => void
) => {
  for (const node of nodes) {
    visit(node)
    if (node.children) walk(node.children, visit)
  }
}

// Every valid permission key, used to reject unknown keys on save so the
// stored list can never drift away from the tree above.
export const permissionKeys: string[] = (() => {
  const keys: string[] = []
  walk(permissionTree, (node) => keys.push(node.key))
  return keys
})()

export const permissionKeySet = new Set(permissionKeys)

// `Query.x` / `Mutation.x` -> the permission keys that can unlock it. A field
// listed under several permissions (a summary query two reports both call) is
// allowed if the user holds ANY of them. Fields absent from this map are never
// permission-gated - that's deliberate for shared lookups (`*Options`,
// `Query.register`, `Query.user`), which pages depend on regardless of which
// features the user is allowed to use.
export const fieldPermissionMap: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  walk(permissionTree, (node) => {
    for (const field of node.fields ?? []) {
      map[field] = [...(map[field] ?? []), node.key]
    }
  })
  return map
})()

// Parent key for each key, so granting a child can pull its ancestors in and
// revoking a parent can drop its whole subtree (both directions are applied in
// the Permissions dialog and re-applied server-side on save).
export const permissionParent: Record<string, string | null> = (() => {
  const parents: Record<string, string | null> = {}
  const assign = (nodes: PermissionNode[], parent: string | null) => {
    for (const node of nodes) {
      parents[node.key] = parent
      if (node.children) assign(node.children, node.key)
    }
  }
  assign(permissionTree, null)
  return parents
})()

// Normalizes a raw selection: drops unknown keys, then adds back every
// ancestor of a granted key so a leaf grant is never orphaned under an
// unchecked group.
export const normalizePermissions = (keys: readonly string[]): string[] => {
  const granted = new Set<string>()
  for (const key of keys) {
    if (!permissionKeySet.has(key)) continue
    let current: string | null = key
    while (current && !granted.has(current)) {
      granted.add(current)
      current = permissionParent[current] ?? null
    }
  }
  return permissionKeys.filter((key) => granted.has(key))
}

// Page route -> the permission keys that let a user open it (ANY of them is
// enough). Drives both the sidebar and the client-side route guard, so a
// hidden menu item can't just be typed into the address bar instead. Longest
// prefix wins, so /product-type is matched before /product.
export const routePermissions: { prefix: string; keys: string[] }[] = [
  { prefix: "/dashboard", keys: ["dashboard.view"] },
  { prefix: "/process", keys: ["pos.sale.process"] },
  { prefix: "/sale-history", keys: ["pos.sale.history"] },
  { prefix: "/cash-register", keys: ["pos.register.view"] },
  { prefix: "/product-type", keys: ["products.type.view"] },
  { prefix: "/product", keys: ["products.product.view"] },
  { prefix: "/brand", keys: ["products.brand.view"] },
  { prefix: "/customer", keys: ["customers.customer.view"] },
  { prefix: "/reports/sales", keys: ["reports.sales"] },
  { prefix: "/reports/customers", keys: ["reports.customers"] },
  { prefix: "/reports/payments", keys: ["reports.payments"] },
  { prefix: "/reports/register", keys: ["reports.register"] },
  { prefix: "/reports/users", keys: ["reports.users"] },
  { prefix: "/user", keys: ["users.user.view"] },
  { prefix: "/outlet", keys: ["store.outlet.view"] },
  { prefix: "/payment-method", keys: ["store.payment_method.view"] },
]

// The permission keys required by `pathname`, or null when the route isn't
// permission-gated at all (e.g. the change-password screen).
export const permissionsForRoute = (pathname: string): string[] | null => {
  const match = [...routePermissions]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find(
      (route) =>
        pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
    )
  return match ? match.keys : null
}
