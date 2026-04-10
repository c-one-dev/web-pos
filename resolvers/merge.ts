import { mergeResolvers } from "@graphql-tools/merge"

import { userResolver } from "./user.resolver"
import { outletResolver } from "./outlet.resolver"
import { brandResolver } from "./brand.resolver"
import { registerResolver } from "./register.resolver"
import { productTypeResolver } from "./productType.resolver"
import { productResolver } from "./product.resolver"
import { authResolver } from "./auth.resolver"

export default mergeResolvers([
  userResolver,
  outletResolver,
  registerResolver,
  brandResolver,
  productTypeResolver,
  productResolver,
  authResolver,
])
