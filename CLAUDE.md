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

No refund logic exists and none should be added. Void (cancel a sale entirely) is the only post-sale mutation.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| API | GraphQL via Apollo Server (`@as-integrations/next`) |
| ORM | Mongoose (MongoDB) |
| Auth | NextAuth v4 — JWT sessions |
| UI | shadcn/ui + Radix UI + Tailwind CSS |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Tables | TanStack Table v8 |
| Forms | TanStack Form |
| Validation | Zod (server-side, schema-level middleware) |
| Date utils | date-fns + little-date |
| State | React local state only — no Zustand/Redux |

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
  myNewMutation: myNewMutationSchema,  // or NO_VALIDATION if truly no input
  // ...
}
```

### Status toggle resolvers — `updatePipeline: true` required

All `change*Status` mutations use MongoDB aggregation pipeline updates to atomically toggle `isActive`:

```ts
Model.findByIdAndUpdate(
  _id,
  [{ $set: { isActive: { $not: "$isActive" } } }],
  { returnDocument: "after", updatePipeline: true }   // ← required or Mongoose throws
)
```

Never remove `updatePipeline: true`.

### `generateSale` — uses MongoDB transaction

The sale creation resolver wraps everything in `session.withTransaction()`. Key gotcha: `Model.create()` with a session requires the **array form**:

```ts
const [result] = await Sale.create([newSale], { session })  // array form — required
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

Statuses mapped: `PENDING`, `COMPLETED`, `VOIDED`, `PAID`, `UNPAID`, `PARTIALLY_PAID`, `ACTIVE`, `INACTIVE`.

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
- **Void only**: there is no refund mutation and none should be added. `voidSale` sets `currentSaleStatus: "VOIDED"` and appends to `saleStatusHistory`.
- **PARTIALLY_PAID**: only applicable to `ON_ACCOUNT` and `STORE_CREDIT` payment types. Implementation is pending user specification.
- **No stock management**: products have no quantity/stock fields. Do not add them.

---

## Environment variables

See `.env.example`. Key vars:

```
NEXTAUTH_SECRET   — JWT signing secret (generate with crypto.randomBytes(32))
JWT_SECRET        — separate JWT secret
DB_URI            — MongoDB Atlas connection string
NEXT_PUBLIC_CASH_ID          — ObjectId of the "Cash" PaymentMethod document
NEXT_PUBLIC_ON_ACCOUNT_ID    — ObjectId of the "On Account" PaymentMethod document
NEXT_PUBLIC_STORE_CREDIT_ID  — ObjectId of the "Store Credit" PaymentMethod document
```

---

## Dev commands

```bash
npm run dev        # development server
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --write
npm run build      # production build
```

Always run `typecheck` before committing. Run `format` before committing to keep diffs clean.
