import type { z } from "zod"
import { signInSchema } from "./auth.validator"
import { userSchema, changePasswordSchema } from "./user.validator"
import { productTypeSchema } from "./productType.validator"
import { updatePaymentNoteSchema } from "./payment.validator"
import { productSchema } from "./product.validator"
import { paymentMethodSchema } from "./paymentMethod.validator"
import { brandSchema } from "./brand.validator"
import { registerSchema } from "./register.validator"
import {
  customerSchema,
  adjustAccountLimitSchema,
  adjustStoreCreditSchema,
} from "./customer.validator"
import { outletSchema } from "./outlet.validator"
import { saleSchema } from "./sale.validator"

// Sentinel for mutations that take no input worth validating beyond what
// GraphQL's own type system already enforces (e.g. a bare `_id: ID!`).
// Using an explicit marker - rather than just omitting the entry - means a
// missing entry is always a mistake, never an intentional omission.
export const NO_VALIDATION = Symbol("NO_VALIDATION")

type MutationValidationEntry = z.ZodSchema | typeof NO_VALIDATION

// Every `Mutation` field in schemas/*.schema.ts must have an entry here.
// app/graphql/route.ts enforces this at schema-build time: a mutation
// missing from this map fails the server on startup rather than shipping
// to production unvalidated.
export const mutationValidationRegistry: Record<
  string,
  MutationValidationEntry
> = {
  signIn: signInSchema,
  signOut: NO_VALIDATION,

  createUser: userSchema,
  updateUser: userSchema,
  changeUserStatus: NO_VALIDATION,
  changePassword: changePasswordSchema,

  createProductType: productTypeSchema,
  updateProductType: productTypeSchema,
  changeProductTypeStatus: NO_VALIDATION,

  updatePaymentNote: updatePaymentNoteSchema,

  createProduct: productSchema,
  updateProduct: productSchema,
  changeProductStatus: NO_VALIDATION,

  createPaymentMethod: paymentMethodSchema,
  updatePaymentMethod: paymentMethodSchema,
  changePaymentMethodStatus: NO_VALIDATION,

  createBrand: brandSchema,
  updateBrand: brandSchema,
  changeBrandStatus: NO_VALIDATION,

  createRegister: registerSchema,
  updateRegister: registerSchema,
  changeRegisterStatus: NO_VALIDATION,

  createCustomer: customerSchema,
  adjustAccountLimit: adjustAccountLimitSchema,
  adjustStoreCredit: adjustStoreCreditSchema,
  updateCustomer: customerSchema,
  changeCustomerStatus: NO_VALIDATION,

  createOutlet: outletSchema,
  updateOutlet: outletSchema,
  changeOutletStatus: NO_VALIDATION,

  generateSale: saleSchema,
  voidSale: NO_VALIDATION,
}
