import { mergeTypeDefs } from "@graphql-tools/merge"

import { sharedSchema } from "./shared.schema"
import { userSchema } from "./user.schema"
import { outletSchema } from "./outlet.schema"
import { registerSchema } from "./register.schema"
import { registerSessionSchema } from "./registerSession.schema"
import { brandSchema } from "./brand.schema"
import { productTypeSchema } from "./productType.schema"
import { productSchema } from "./product.schema"
import { authSchema } from "./auth.schema"
import { paymentMethodSchema } from "./paymentMethod.schema"
import { customerSchema } from "./customer.schema"
import { saleSchema } from "./sale.schema"
import { paymentSchema } from "./payment.schema"
import { dashboardSchema } from "./dashboard.schema"
import { salesReportSchema } from "./salesReport.schema"
import { timecardSchema } from "./timecard.schema"
import { activityLogSchema } from "./activityLog.schema"
import { salesTargetSchema } from "./salesTarget.schema"

export default mergeTypeDefs([
  authSchema,
  sharedSchema,
  userSchema,
  outletSchema,
  registerSchema,
  registerSessionSchema,
  brandSchema,
  productTypeSchema,
  productSchema,
  paymentMethodSchema,
  customerSchema,
  saleSchema,
  paymentSchema,
  dashboardSchema,
  salesReportSchema,
  timecardSchema,
  activityLogSchema,
  salesTargetSchema,
])
