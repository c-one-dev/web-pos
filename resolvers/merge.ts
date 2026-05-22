import { mergeResolvers } from "@graphql-tools/merge"

import { userResolver } from "./user.resolver"
import { outletResolver } from "./outlet.resolver"
import { brandResolver } from "./brand.resolver"
import { registerResolver } from "./register.resolver"
import { productTypeResolver } from "./productType.resolver"
import { productResolver } from "./product.resolver"
import { authResolver } from "./auth.resolver"
import { paymentMethodResolver } from "./paymentMethod.resolver"
import { customerResolver } from "./customer.resolver"
import { saleResolver } from "./sale.resolver"
import { paymentResolver } from "./payment.resolver"

export default mergeResolvers([
  userResolver,
  outletResolver,
  registerResolver,
  brandResolver,
  productTypeResolver,
  productResolver,
  authResolver,
  paymentMethodResolver,
  customerResolver,
  saleResolver,
  paymentResolver,
])
