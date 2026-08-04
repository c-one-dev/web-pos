import ActivityLog from "../models/activityLog.model"

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
]

const formatUserAgent = (ua?: string | null): string | undefined => {
  if (!ua) return undefined
  const browserName = BROWSER_PATTERNS.find(([re]) => re.test(ua))?.[1] || "Unknown"
  const versionMatch =
    ua.match(/Edg\/([\d.]+)/) ||
    ua.match(/OPR\/([\d.]+)/) ||
    ua.match(/Chrome\/([\d.]+)/) ||
    ua.match(/Firefox\/([\d.]+)/) ||
    ua.match(/Version\/([\d.]+)/)
  const version = versionMatch?.[1]?.split(".").slice(0, 2).join(".")
  const platform = /Windows/.test(ua)
    ? "WinNT"
    : /Mac OS X/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : undefined
  return [browserName, version, platform].filter(Boolean).join(" / ")
}

const getIp = (req: any): string | undefined =>
  req?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
  req?.headers?.get?.("x-real-ip") ||
  undefined

export const logActivity = async ({
  req,
  user,
  activity,
}: {
  req: any
  user: { _id?: any; name: string } | null
  activity: string
}) => {
  try {
    await ActivityLog.create({
      user: user?._id || null,
      userName: user?.name || "Unknown",
      activity,
      ipAddress: getIp(req),
      browser: formatUserAgent(req?.headers?.get?.("user-agent")),
      date: new Date(),
    })
  } catch {
    // Best-effort logging - a failure here must never break the mutation
    // it's observing.
  }
}

// Human-readable label per mutation field, used by the schema-level logging
// wrapper in app/graphql/route.ts. A mutation missing here still gets logged
// via the humanized-fieldName fallback in describeActivity, so new mutations
// are never silently unlogged - they just get a generic label until someone
// adds a proper one.
const ACTIVITY_LABELS: Record<string, (args: any, result: any) => string> = {
  createUser: () => "Created a user",
  updateUser: () => "Updated a user",
  changeUserStatus: () => "Changed a user's status",
  createProduct: () => "Created a product",
  updateProduct: () => "Updated a product",
  changeProductStatus: () => "Changed a product's status",
  createProductType: () => "Created a product type",
  updateProductType: () => "Updated a product type",
  changeProductTypeStatus: () => "Changed a product type's status",
  createBrand: () => "Created a brand",
  updateBrand: () => "Updated a brand",
  changeBrandStatus: () => "Changed a brand's status",
  createPaymentMethod: () => "Created a payment method",
  updatePaymentMethod: () => "Updated a payment method",
  changePaymentMethodStatus: () => "Changed a payment method's status",
  createOutlet: () => "Created an outlet",
  updateOutlet: () => "Updated an outlet",
  changeOutletStatus: () => "Changed an outlet's status",
  createRegister: () => "Created a register",
  updateRegister: () => "Updated a register",
  changeRegisterStatus: () => "Changed a register's status",
  changeRegisterOpenStatus: () => "Changed a register's open status",
  createCustomer: () => "Created a customer",
  updateCustomer: () => "Updated a customer",
  changeCustomerStatus: () => "Changed a customer's status",
  adjustAccountLimit: () => "Adjusted a customer's account limit",
  settleAccountBalance: () => "Recorded an account settlement",
  adjustStoreCredit: () => "Adjusted a customer's store credit",
  updatePaymentNote: () => "Updated a payment note",
  generateSale: (_args, result) =>
    `Processed a sale${result?.data?.saleNumber ? ` - ${result.data.saleNumber}` : ""}`,
  voidSale: () => "Voided a sale",
  openRegisterSession: (_args, result) =>
    `Opened a register${result?.data?.register?.name ? ` - ${result.data.register.name}` : ""}`,
  addCashMovement: (args) =>
    `Recorded a cash ${args?.input?.type === "OUT" ? "out" : "in"}`,
  closeRegisterSession: (_args, result) =>
    `Closed a register${result?.data?.register?.name ? ` - ${result.data.register.name}` : ""}`,
  changePassword: () => "Changed their password",
  switchUser: (_args, result) => result?.message || "Switched user",
  clockIn: () => "Clocked in",
  clockOut: () => "Clocked out",
  setSalesTarget: () => "Set a sales target",
}

export const describeActivity = (
  fieldName: string,
  args: any,
  result: any
): string => {
  const formatter = ACTIVITY_LABELS[fieldName]
  if (formatter) return formatter(args, result)
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}
