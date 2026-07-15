# TASKS.md — Pending Work

This file tracks known pending work, incomplete features, and deferred decisions. Update it as items are completed or new work is identified.

---

## Priority: High

### 1. Void sale — wire up the UI button

**What's done:** `voidSale` mutation exists in the schema and resolver. It atomically sets `currentSaleStatus: "VOIDED"` and appends to `saleStatusHistory`.

**What's missing:** No button exists yet in the sale history row view. The file to edit is:

`app/(auth)/sale-history/_dialogs/row-view.tsx`

The mutation to call:
```graphql
mutation VoidSale($_id: ID!) {
  voidSale(_id: $_id) {
    ok
    message
    data { _id saleNumber currentSaleStatus }
  }
}
```

Guard the button: only show it when `currentSaleStatus !== "VOIDED"`. Confirm with a dialog before firing (a voided sale cannot be un-voided). Refetch the sale history table after success.

---

### 2. Account limit & store credit checkout logic

**Context from the owner:** `PARTIALLY_PAID` is only applicable for `ON_ACCOUNT` and `STORE_CREDIT` payment types. Full checkout logic for these two payment methods has not yet been specified by the owner. Do not implement anything here until the owner elaborates on:

- When a sale becomes `PARTIALLY_PAID` vs `UNPAID`
- How partial payments reduce the customer's account limit or store credit balance
- Whether multiple payment methods can be mixed (e.g., part cash + part account)
- How the remaining balance is tracked and later settled

Current env vars for payment method IDs:
- `NEXT_PUBLIC_ON_ACCOUNT_ID`
- `NEXT_PUBLIC_STORE_CREDIT_ID`

---

## Priority: Medium

### 3. Dashboard — implement actual content

`app/(auth)/dashboard/page.tsx` is currently a stub. Suggested content: today's sales total, transaction count, top products, recent sales. All data is available via existing resolvers.

### 4. Register open/close flow

The register model (`models/register.model.ts`) and resolver (`resolvers/register.resolver.ts`) exist but the open/close flow has not been validated end-to-end. The register must be open for a cashier to process sales. Verify that:
- A cashier cannot generate a sale against a closed register
- The open/close mutations update state correctly
- The process page (`app/(auth)/process/page.tsx`) shows an appropriate state when the register is closed

### 5. Payment removal formula

When a payment is removed from a sale during checkout, verify the subtotal/total recalculation formula is correct. This was flagged during the business logic audit but not yet investigated.

---

## Priority: Low / Backlog

### 6. Test coverage

There are zero automated tests in this project. If you add tests, prefer integration tests hitting a real MongoDB instance (not mocks) — the owner's past experience showed mock/prod divergence masked a real migration failure.

### 7. Database indexes

Frequently-queried fields (e.g., `saleNumber`, `customerName`, `currentSaleStatus`, `date` on the Sale collection) should have MongoDB indexes. Add them in the model files using Mongoose's `schema.index()`.

### 8. Pagination edge case — `filteredEdges` deduplication bug

In `app/(auth)/sale-history/page.tsx` (and likely other table pages), the `fetchMore` `updateQuery` builds a `cursorSet` from both old and new edges, then filters against that set. This logic always keeps all edges — the filter is a no-op since every cursor in both arrays is in the union set. The intent was deduplication; fix by filtering edges whose cursor appears more than once.

### 9. `eslint-disable` comments audit

Several files have `// eslint-disable-next-line react-hooks/set-state-in-render` and similar suppression comments left from when the linter rules were first applied. Review whether those usages are actually safe or should be refactored.

---

## Deferred / On hold

### Account limit & store credit payment handling

See item #2 above. Do not implement until the owner provides full specification.

---

## Completed (for reference)

- [x] Schema-level auth guard (`app/graphql/route.ts`)
- [x] Mutation validation registry with fail-fast startup check (`validators/mutationRegistry.ts`)
- [x] Unbounded pagination clamp to 500 (`app/graphql/route.ts`)
- [x] Sign-in crash on non-existent username (`validators/auth.validator.ts`)
- [x] Per-item percent discount stored as string, not number (`app/(auth)/process/[id]/_dialogs/per-item.tsx`)
- [x] Negative discounts and totals — Zod `.nonnegative()` guards (`validators/sale.validator.ts`)
- [x] Quantity bounds — min 1, integer only (`validators/sale.validator.ts` + per-item dialog)
- [x] Discount > price guard — Zod `.refine()` cross-field check
- [x] Status toggle race condition — atomic MongoDB pipeline update with `updatePipeline: true`
- [x] `generateSale` wrapped in MongoDB transaction (`resolvers/sale.resolver.ts`)
- [x] `voidSale` mutation — schema + resolver
- [x] Forced password change on first login (`mustChangePassword` flag)
- [x] `PasswordInput` component with show/hide toggle
- [x] `StatusBadge` reusable component with semantic color variants
- [x] `CustomerBadge` with Walk-in special treatment
- [x] Date range presets in `ColumnFilter` (Today / This Week / Last 7 Days / This Month / Last 30 Days)
- [x] Payment status filter with `SELECT` type in sale history table
- [x] `.env.example` updated with generation instructions
