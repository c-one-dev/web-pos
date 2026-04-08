import { mergeTypeDefs } from "@graphql-tools/merge"

import { sharedSchema } from "./shared.schema"
import { userSchema } from "./user.schema"
import { outletSchema } from "./outlet.schema"
import { registerSchema } from "./register.schema"
import { brandSchema } from "./brand.schema"
import { productTypeSchema } from "./productType.schema"
import { productSchema } from "./product.schema"
import { authSchema } from "./auth.schema"

export default mergeTypeDefs([
  authSchema,
  sharedSchema,
  userSchema,
  outletSchema,
  registerSchema,
  brandSchema,
  productTypeSchema,
  productSchema,
])
