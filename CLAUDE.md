# CLAUDE.md — POS System (HIKE Clone)

This file gives Claude Code the context it needs to work effectively in this codebase. Read it before touching anything.

---

## What this project is

A simplified Point-of-Sale system modeled loosely after HIKE POS. Core focus:

- **Register / checkout** — functional sales flow with per-item and total discounts
- **Account limit & store credit** — the primary differentiator; customers can pay on account
- **Simple inventory** — items sold only; no stock tracking, no reorder points
- **Sale history & reports** — paginated tables with filters, sorting, and status badges
- **User management** — role-based with forced password change on first login

Refunds are **store credit only**: `refundSaleItems` credits the customer's store credit and never reverses a payment or takes cash out of the drawer. Void (cancel a sale entirely) is the other post-sale mutation. No cash-back refund exists and none should be added.

---

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 App Router                               |
| API        | GraphQL via Apollo Server (`@as-integrations/next`) |
| ORM        | Mongoose (MongoDB)                                  |
| Auth       | NextAuth v4 — JWT sessions                          |
| UI         | shadcn/ui + Radix UI + Tailwind CSS                 |
| Icons      | Phosphor Icons (`@phosphor-icons/react`)            |
| Tables     | TanStack Table v8                                   |
| Forms      | TanStack Form                                       |
| Validation | Zod (server-side, schema-level middleware)          |
| Date utils | date-fns + little-date                              |
| State      | React local state only — no Zustand/Redux           |

---

## Project layout

```
app/
  (auth)/           — all authenticated pages (layout enforces session + mustChangePassword)
    process/[id]/   — the register/checkout flow
    sale-history/   — sale history table
    reports/        — customer account & payment reports
    dashboard/      — stub, not yet implemented
  api/
    auth/[...nextauth]/  — NextAuth route
    graphql/route.ts     — THE central enforcement point (auth guard + validation middleware + pagination clamp)

components/
  custom/           — app-specific components (DataTable, ColumnFilter, StatusBadge, CustomerBadge, etc.)
  ui/               — shadcn/ui primitives

resolvers/          — GraphQL resolvers (one file per domain)
schemas/            — GraphQL SDL type definitions
models/             — Mongoose models
validators/         — Zod schemas + mutationRegistry.ts (CRITICAL)
types/              — TypeScript types mirroring GraphQL types
```

---

## Critical architecture — read this carefully

### `app/graphql/route.ts` — the schema-level middleware

Every query and mutation is wrapped here via `mapSchema` / `MapperKind.OBJECT_FIELD`. It handles three things in a single pass:

1. **Auth guard** — throws `UNAUTHORIZED` if `context.session` is missing, except for fields listed in `PUBLIC_FIELDS` (currently only `Mutation.signIn`).
2. **Mutation validation** — looks up each mutation name in `mutationValidationRegistry`. If the entry is missing the server **refuses to start** — this is intentional fail-fast behavior so new mutations can never be silently unvalidated.
3. **Pagination clamp** — any field receiving `args.first > 500` is silently clamped to `MAX_PAGE_SIZE = 500`.

### `validators/mutationRegistry.ts` — mutation validation registry

Maps every mutation to either a Zod schema or the `NO_VALIDATION` sentinel symbol. Adding a new mutation without an entry here **breaks the server on startup** — that's the point. Always add your new mutation here before the server will accept requests.

```ts
export const NO_VALIDATION = Symbol("NO_VALIDATION")
export const mutationValidationRegistry = {
  myNewMutation: myNewMutationSchema, // or NO_VALIDATION if truly no input
  // ...
}
```

### Status toggle resolvers — `updatePipeline: true` required

All `change*Status` mutations use MongoDB aggregation pipeline updates to atomically toggle `isActive`:

```ts
Model.findByIdAndUpdate(
  _id,
  [{ $set: { isActive: { $not: "$isActive" } } }],
  { returnDocument: "after", updatePipeline: true } // ← required or Mongoose throws
)
```

Never remove `updatePipeline: true`.

### `generateSale` — uses MongoDB transaction

The sale creation resolver wraps everything in `session.withTransaction()`. Key gotcha: `Model.create()` with a session requires the **array form**:

```ts
const [result] = await Sale.create([newSale], { session }) // array form — required
```

### `mustChangePassword` flow

- New users are created with `mustChangePassword: true` and a random 12-char temp password (printed once in the `createUser` response).
- NextAuth JWT and session callbacks propagate the flag through to `session.user.mustChangePassword`.
- `components/custom/layouts/require-password-change.tsx` gates the entire `(auth)` layout — if the flag is true, the change-password form renders instead of the page.
- After a successful `changePassword` mutation, the client calls `session.update({ mustChangePassword: false })` to lift the gate without a full sign-out.

---

## Reusable UI components

### `StatusBadge` (`components/custom/status-badge.tsx`)

Central status → color mapping. Use this everywhere a status string needs to be displayed as a badge. Do not color statuses inline on individual pages.

```tsx
<StatusBadge status={row.original.currentSaleStatus} />
```

Statuses mapped: `PENDING`, `COMPLETED`, `REFUNDED`, `VOIDED`, `PAID`, `UNPAID`, `PARTIALLY_PAID`, `ACTIVE`, `INACTIVE`.

To add a new status, add it to `STATUS_VARIANTS` in that file only.

### `CustomerBadge` (`components/custom/customer-badge.tsx`)

Renders `"Walk-in"` as a special outlined badge with a walking-person icon; all other customer names render as plain `<span>`.

### `ColumnFilter` (`components/custom/column-filter.tsx`)

Supports `FilterType.TEXT`, `NUMBER`, `SELECT`, `BOOLEAN`, `DATE`. The `DATE` type renders a two-column popover: preset sidebar (Today / This Week / Last 7 Days / This Month / Last 30 Days) on the left, a two-month calendar on the right. Selecting a preset applies immediately; custom ranges require the "Apply" button.

### `PasswordInput` (`components/ui/password-input.tsx`)

Eye/eye-closed toggle built on `InputGroup`. Use for all password fields — never use a plain `<Input type="password">`.

---

## Conventions

- **Pagination**: cursor-based everywhere. All `*Table` queries accept `first`, `after`, `search`, `filter`, `sort`. Max page size is 500 (server-clamped).
- **Responses**: all mutations return `{ ok: Boolean!, message: String!, data: ... }`.
- **Discounts**: always stored as numbers (`Float`), never strings. `.toFixed(2)` returns a string — always wrap in `parseFloat()`.
- **Void**: `voidSale` sets `currentSaleStatus: "VOIDED"` and appends to `saleStatusHistory`.
- **Refunds are store credit only**: `refundSaleItems` refunds chosen line items (partial or full) by crediting `storeCredit.current` on the customer, inside a transaction. It never reverses a payment, so a closed register's tally stays intact. Rules it enforces: a walk-in sale can't be refunded (no account to credit), a voided sale can't be refunded, a line can't be refunded past its remaining quantity (`items[].refundedQuantity`), and total refunds can't exceed `sale.total`. A sale-level discount is prorated across lines so a full refund returns exactly what was paid. Refunding every unit sets `currentSaleStatus: "REFUNDED"`; a partial refund leaves the status alone and only raises `refundedAmount`. Once any refund exists the sale's items are frozen — `assertSaleIsEditable` rejects further edits. Do not add a cash-back refund path.
- **Payment status** is computed in `checkSalesPaymentStatus` (`helpers/salesFn.ts`) and is about _money actually received_:
  - An **On Account** tender is a debt, not a payment, so it does NOT count toward "paid". A sale tendered entirely on account is `PENDING`; part-settled is `PARTIALLY_PAID`; fully settled is `PAID`.
  - **Store Credit** is prepaid value the customer already owns, so it settles a sale immediately, same as Cash.
  - `PENDING` is a value in _both_ `SaleStatus` (unused) and `SalePaymentStatus` (an unsettled on-account sale). Read the field name.
- **Account limit**: `generateSale` deducts the net on-account amount (`amount - change`) from `accountLimit.current` in the same transaction as the sale, and **rejects** the sale (`INSUFFICIENT_BALANCE`) if it would exceed the available balance. There is deliberately no over-limit override.
- **Settlement**: `settleSales` repays the on-account debt of one or many sales in a single transaction — the per-sale "Settle payment" action and the customer's "Bulk Payment" drawer both call it. It requires an **open register session** for the given register and stamps each settlement with that session, so cash repayments are counted in that shift's closure tally (`resolveSummary` in `resolvers/registerSession.resolver.ts` folds them into the expected totals). Settling frees the same amount back onto `accountLimit.current` (never `accountLimit.max`), writes a `Payment` document per sale so payment reports see it, and recomputes `currentSalePaymentStatus`. On Account can't be used to settle. `settleAccountBalance` still exists for a lump-sum adjustment that isn't tied to specific sales.
- **No stock management**: products have no quantity/stock fields. Do not add them.
