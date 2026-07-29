# GraphQL Resolver Reference

Plain-English documentation of every Query and Mutation exposed at `/graphql`. Organized by domain, matching the files under `resolvers/`.

## Cross-cutting behavior (applies to everything below)

**Authentication.** Every Query and Mutation requires a signed-in session by default — this is enforced once, centrally, in [app/graphql/route.ts](../app/graphql/route.ts), not per-resolver. The only exception is `signIn` itself, since that's how a session is obtained. "Session" means a valid NextAuth JWT read from the request cookie; an unauthenticated call to anything else gets back `{"errors":[{"message":"Unauthorized", "extensions":{"code":"UNAUTHORIZED"}}]}`.

**Input validation.** Every Mutation's arguments are run through a Zod schema before the resolver body executes — also enforced centrally, via the registry at [validators/mutationRegistry.ts](../validators/mutationRegistry.ts). A mutation with no registered schema (and no explicit `NO_VALIDATION` marker) makes the server refuse to start, so a new mutation can't accidentally ship without a validation decision having been made for it. Validation failures return `{"errors":[{"message":"Form validation error.", "extensions":{"fields":[{"path":..., "message":...}]}}]}`.

**Pagination.** Every `*Table` query follows the same cursor-based shape: `first` (page size), `after` (opaque cursor from the previous page), `search` (free-text, matched with regex across a few relevant fields), `filter` (a list of typed field filters — `TEXT`/`NUMBER`/`DATE`/`BOOLEAN`/`SELECT`), and `sort` (`{ key, order }`). The response is always `{ total, pages, edges: [{ node, cursor }], pageInfo: { endCursor, hasNextPage } }`.

**Mutation response envelope.** Every mutation returns `{ ok, message, data }`, where `data` is a generic `JSON` scalar whose actual shape varies per mutation (documented below).

**`*Options` queries.** Every domain has one (`brandOptions`, `customerOptions`, etc.) — returns only active records as `{ label, value }` pairs, meant for populating select/combobox inputs.

---

## Auth ([resolvers/auth.resolver.ts](../resolvers/auth.resolver.ts))

| Field | What it does |
|---|---|
| `signIn(username, password)` | The only public mutation. Looks up the user, verifies the password with bcrypt (inside the Zod schema's `superRefine`, not the resolver body), and if it matches, issues a JWT (7-day expiry) containing `_id`, `username`, `role`. Returns `{ user, token }`. This token isn't the session itself — NextAuth wraps it into its own session JWT via the credentials provider in `app/api/auth/[...nextauth]/route.ts`. |
| `signOut` | Declared in the schema but **has no resolver implemented**. Calling it won't crash, but it won't do anything meaningful either — it's dead schema. Sign-out is actually handled entirely by NextAuth's own `/api/auth/signout` endpoint, bypassing this GraphQL field. |

---

## User ([resolvers/user.resolver.ts](../resolvers/user.resolver.ts))

| Field | What it does |
|---|---|
| `user(_id)` | Fetch one user by ID. |
| `userTable(...)` | Paginated/searchable user list. Search matches name, surname, displayName, email, username, or the computed `fullName`. |
| `userOptions` | Active users as `{ label: "First Last", value: _id }`. |
| `createUser(input)` | Creates a user with a **randomly generated temporary password** (12 chars, ambiguous characters excluded) — never the username, never admin-supplied. The plaintext temp password is returned once in `data.temporaryPassword` for the admin to hand off; it's never stored or shown again. The new user is flagged `mustChangePassword: true`. |
| `updateUser(_id, input)` | Standard field update (name, role, pin, etc.) — does not touch the password. |
| `changeUserStatus(_id)` | Atomically flips `isActive` (MongoDB pipeline update, not a read-then-write). |
| `changePassword(oldPassword, newPassword)` | Self-service password change for the *currently signed-in* user (uses `ctx.session._id`, not an `_id` argument — you can't change someone else's password through this field). Verifies `oldPassword` against the stored hash, requires `newPassword` to be 8+ characters, and clears `mustChangePassword`. The frontend calls NextAuth's `session.update()` right after this succeeds so the forced password-change screen ([components/custom/layouts/require-password-change.tsx](../components/custom/layouts/require-password-change.tsx)) lifts immediately without a fresh login. |

---

## Outlet ([resolvers/outlet.resolver.ts](../resolvers/outlet.resolver.ts))

| Field | What it does |
|---|---|
| `outlet(_id)` | Fetch one outlet, with its registers looked up separately and attached (`Register.find({ outlet: _id })`). |
| `outletTable(...)` | Paginated list; each row includes its registers via a `$lookup`. |
| `outletOptions` | Active outlets for selects. |
| `createOutlet` / `updateOutlet` | Standard create/update — just `name` and `isActive`. |
| `changeOutletStatus(_id)` | Atomic `isActive` toggle, then re-fetches the outlet's registers for the response. |

---

## Register ([resolvers/register.resolver.ts](../resolvers/register.resolver.ts))

A register is a physical checkout point (tied to one outlet), with its own prefix (used for sale numbering), accepted payment methods, and open/close schedule.

| Field | What it does |
|---|---|
| `register(_id)` | Fetch one register with `paymentMethods` and `outlet` populated. |
| `processedRegister(_id)` | **The query that powers the actual POS checkout screen** ([app/(auth)/process/[id]/page.tsx](../app/(auth)/process/[id]/page.tsx)). Returns the register plus every `Product` assigned to it (`Product.find({ registers: register._id })`) and the distinct set of product types among those products, so the register UI can render its category tabs and product grid. |
| `registerTable(...)` | Paginated list; each row includes its resolved `outletName` via `$lookup`. |
| `registers` | All registers (no pagination), populated. |
| `registerOptions` | Active registers for selects. |
| `createRegister` / `updateRegister` | Standard create/update. |
| `changeRegisterStatus(_id)` | Atomic `isActive` toggle (enable/disable the register entirely — distinct from open/closed for the day, see below). |
| `changeRegisterOpenStatus(_id)` | Atomic `isOpen` toggle. Superseded by the `RegisterSession` flow below for actual use, but left in place. |

`isOpen` is enforced in `generateSale` (`REGISTER_CLOSED` if false) and kept in sync by `resolvers/registerSession.resolver.ts`'s `openRegisterSession`/`closeRegisterSession`, not by `changeRegisterOpenStatus` directly.

---

## Register Session ([resolvers/registerSession.resolver.ts](../resolvers/registerSession.resolver.ts))

Cash-drawer reconciliation for a register's shift: a cashier opens a register with a starting float, the system tracks what each tender type *should* have taken in based on actual sales during that window, the cashier logs manual cash in/out, and closing requires entering what was physically counted — producing a permanent variance record. Powers `app/(auth)/cash-register/[id]/page.tsx`.

| Field | What it does |
|---|---|
| `activeRegisterSession(register)` | The currently `OPEN` session for a register, if any, with a live-computed `summary` (see below). Returns `null` if the register is closed. |
| `registerSession(_id)` | Fetch one session by id (open or closed), same `summary` shape, bounded by `closedAt` instead of "now" once closed. |
| `openRegisterSession(register, openingFloat)` | Throws if the register already has an `OPEN` session. Creates the session with an initial `IN` cash movement for the opening float, sets `Register.isOpen = true`. |
| `addCashMovement(_id, input)` | Appends an `IN`/`OUT` entry to an `OPEN` session's `cashMovements`; throws if the session is already `CLOSED`. |
| `closeRegisterSession(_id, input)` | Takes the submitted `counted` amount per payment method, computes `expected` one final time, freezes both plus `difference` into `tally`, sets `status: CLOSED`, and sets `Register.isOpen = false`. |

`summary` (and the frozen `tally`) is computed by aggregating `Sale`s for that register within `[openedAt, closedAt ?? now]`, excluding `VOIDED` sales — mirroring the aggregation style in `resolvers/dashboard.resolver.ts`. The Payment Tally deliberately **excludes On Account** (it's a receivable, never physically counted) — it's reported instead as `summary.totalOnAccountSales`. Store Credit is included alongside whatever tenders the register is configured with.

> **Nested-object queries need their key field.** While building this, a query for `cashMovements { by { name surname } }` (no `_id`) made Apollo Client's cache normalization throw on the client, which silently killed the entire query — the UI showed "register closed" even when it was open, with no console error surfaced to the user. Any GraphQL selection on a type with a cache key field (`_id` here) must include that field, even if the UI doesn't display it directly.

---

## Brand ([resolvers/brand.resolver.ts](../resolvers/brand.resolver.ts))

Simple lookup entity (`name`, `isActive`) that products can be tagged with. `brand(_id)`, `brandTable(...)`, `brandOptions`, `createBrand`, `updateBrand`, `changeBrandStatus(_id)` — no domain-specific behavior beyond the standard CRUD + atomic-toggle pattern described above.

---

## Product Type ([resolvers/productType.resolver.ts](../resolvers/productType.resolver.ts))

Product categories, with an optional self-referencing `parent` for nesting (e.g. "Drinks" → "Coffee").

| Field | What it does |
|---|---|
| `productType(_id)` | Fetch one, with `parent` populated. |
| `productTypeTable(...)` | Paginated list; search also matches the parent's name via `$lookup`. |
| `productTypeOptions` | Active types for selects. |
| `createProductType` / `updateProductType` | Standard create/update. |
| `changeProductTypeStatus(_id)` | Atomic `isActive` toggle. |

> **Known bug (not fixed, flagged during testing):** `generateNode` in this resolver does `productType.parent.name` unconditionally. Since `parent` is optional on the model, calling `changeProductTypeStatus`, `updateProductType`, or `createProductType` on a *top-level* product type (no parent) throws `Cannot read properties of undefined (reading 'name')` when formatting the response — even though the database write itself succeeds. Worth a follow-up fix.

---

## Product ([resolvers/product.resolver.ts](../resolvers/product.resolver.ts))

The catalog. **Deliberately has no stock/quantity field** — this app tracks what's sold (via `Sale.items`), not what's on hand.

| Field | What it does |
|---|---|
| `product(_id)` | Fetch one, with `type`, `brand`, `registers` populated. |
| `productTable(...)` | Paginated/searchable list (name, SKU, description, barcode, price, type/brand/register names). |
| `productOptions` | Active products for selects. |
| `createProduct(input)` | Creates the product and seeds `priceHistory` with the initial price. |
| `updateProduct(_id, input)` | Updates fields; if `currentPrice` changed from the stored value, **appends** a new entry to `priceHistory` rather than overwriting it — this is how the price-audit trail is built. |
| `changeProductStatus(_id)` | Atomic `isActive` toggle. |

---

## Payment Method ([resolvers/paymentMethod.resolver.ts](../resolvers/paymentMethod.resolver.ts))

The tender types selectable at checkout (Cash, Card, Gcash, etc.), each typed `PHYSICAL`, `DIGITAL`, or `OTHER`. Standard CRUD (`paymentMethod`, `paymentMethodTable`, `paymentMethodOptions`, `createPaymentMethod`, `updatePaymentMethod`, `changePaymentMethodStatus`) — no domain-specific behavior.

> **Account/store-credit feature — now wired up.** The env vars `NEXT_PUBLIC_ON_ACCOUNT_ID` and `NEXT_PUBLIC_STORE_CREDIT_ID` reference specific `Payment_Method` document IDs representing "charge to account" and "use store credit" as selectable tender types at checkout. `generateSale` special-cases both: it deducts the net tendered amount from the customer's `accountLimit.current`/`storeCredit.current` in the same transaction as the sale, and rejects the sale (`INSUFFICIENT_BALANCE`) if either would go negative. See the Customer and Sale sections below.

---

## Customer ([resolvers/customer.resolver.ts](../resolvers/customer.resolver.ts))

The credit/account-limit system. Every customer has two independent ledgers:
- **`accountLimit`** — `{ max, current, history[] }`. A running credit line; `adjustAccountLimit` moves both `max` and `current` together, so it represents *raising or lowering the limit itself*, not spending against it.
- **`storeCredit`** — `{ current, history[] }`. A standalone credit balance (e.g. refunds issued as store credit); `adjustStoreCredit` only moves `current`.

Both ledgers keep a full history of every adjustment (`{ remaining, transacted, date, ... }`), independently paginated.

| Field | What it does |
|---|---|
| `customer(_id)` | Basic info only (name, email, active status) — no ledger data. |
| `customerReport(_id)` | Same customer, but includes the full `accountLimit` and `storeCredit` objects. Used by the admin reports UI. |
| `customerCreditHistoryItemById(customerId, itemId)` | Fetch a single store-credit history entry (used when viewing detail on one adjustment). |
| `customerTable(...)` | Basic paginated customer list. |
| `customerReportTable(...)` | Paginated list projected with `remainingAccountLimit`/`remainingStoreCredit` — what the reports page actually renders. |
| `customerCreditHistoryTable(customerId, ...)` / `customerLimitHistoryTable(customerId, ...)` | Paginated ledger history for store credit / account limit respectively (each unwinds the `history[]` subdocument array and paginates over it). |
| `customerOptions` | Active customers for selects (used by the "Add Customer" picker at checkout). |
| `createCustomer(input)` | Creates a customer with both ledgers zeroed (`accountLimit: {max:0, current:0}`, `storeCredit: {current:0}`) — ledgers only grow from here via the adjust mutations below. |
| `adjustAccountLimit(_id, amount)` | Increments **both** `accountLimit.current` and `accountLimit.max` by `amount` (can be negative), appends a history entry recording the new remaining balance. Input is validated (`amount` must be a finite number) as of a recent fix — previously this endpoint had no input validation at all. |
| `adjustStoreCredit(_id, amount, description)` | Increments `storeCredit.current` by `amount`, appends a history entry with the given description. Same validation guarantee as above. |
| `updateCustomer(_id, input)` | Standard field update — name/email only, doesn't touch either ledger. |
| `changeCustomerStatus(_id)` | Atomic `isActive` toggle. |

> **Now connected to checkout:** `generateSale` (below) debits `accountLimit.current`/`storeCredit.current` when a sale uses those tender types, in the same transaction as the sale. There is still no repayment/settlement mutation — paying down an `accountLimit` balance has to go through `adjustAccountLimit`, which (per its description above) raises `max` right along with `current`, so it's not a clean "record a repayment" operation. See TASKS.md's "Account settlement mutation" item.

---

## Sale ([resolvers/sale.resolver.ts](../resolvers/sale.resolver.ts))

| Field | What it does |
|---|---|
| `sale(_id)` | Full sale detail, every reference populated (customer, items' products, payments' methods/payer, status history). |
| `saleHistoryTable(...)` | Paginated sale list. Search also matches an aggregated string of all non-empty payment notes on the sale. |
| `saleOptions` | Active sales for selects. **Likely dead/broken**: it filters on `Sale.isActive`, a field that doesn't exist anywhere on the `Sale` model (the model has `currentSaleStatus`/`isOnAccount`, no `isActive`) — this query will always return an empty result and throw `"No sales found."` |
| `generateSale(input)` | **The core checkout mutation.** Runs inside a MongoDB transaction (all-or-nothing — see the commit history around the "sale creation isn't atomic" fix for why): creates the `Payment` documents for however many tenders were used, computes `currentSalePaymentStatus` (`PAID`/`PARTIALLY_PAID`/`UNPAID`) by comparing total paid to the sale total, generates `saleNumber` as `{register.prefix}-{zero-padded sequence}` (sequence = count of existing sales on that register + 1 — see the note below), creates the `Sale`, then backfills each `Payment.sale` with the new sale's ID. All four writes commit together or not at all. |

> **Also worth knowing about `generateSale`:**
> 1. It requires the target register's `isOpen` to be `true` (throws `REGISTER_CLOSED` otherwise) — see the Register section above and `resolvers/registerSession.resolver.ts`, which keeps `isOpen` in sync with whether that register has an open `RegisterSession`.
> 2. **`saleNumber` generation has a race condition**, separate from the atomicity fix: the sequence number is computed by counting existing sales for the register *before* the transaction starts. Two sales hitting the same register at nearly the same moment could compute the same count and collide on `saleNumber` (which has a `unique` index) — the second one would fail with a duplicate-key error rather than silently corrupting data, but the customer's second attempt would need to be retried. Not fixed as part of the atomicity work since it's a different problem (numbering scheme, not write atomicity).

---

## Payment ([resolvers/payment.resolver.ts](../resolvers/payment.resolver.ts))

| Field | What it does |
|---|---|
| `payment(_id)` | Fetch one payment, with `method`, `by` (the user who took it), and `sale` populated. |
| `paymentTable(...)` | Paginated/searchable payment ledger. Computes `amount - change` as the displayed amount, and joins in the method name, payer's full name, and the sale numbers it settled. |
| `updatePaymentNote(_id, note)` | Updates the payment's own `note` field, **and** cascades that same note into the matching entry inside `Sale.payments[].note` for whichever sale references this payment — keeps the sale-embedded copy in sync so the sale detail view and the payment ledger never disagree. `note` is capped at 500 characters (this mutation had no input validation at all before a recent fix). |

---

## Known gaps summary (for quick reference)

- `saleOptions` filters on a field (`isActive`) that doesn't exist on `Sale` — always returns empty.
- `productType`'s response formatting (`generateNode`) crashes on any product type without a `parent`, even though the underlying write succeeds.
- `Mutation.signOut` is declared but has no resolver — sign-out actually happens through NextAuth's own endpoint instead.
- `generateSale`'s `saleNumber` sequence has a narrow race window under concurrent sales on the same register (mitigated, not eliminated, by the `unique` index).
- No repayment/settlement mutation for paying down an `accountLimit` balance without also raising `max` (see TASKS.md).
- No "past sessions" browsing UI for `RegisterSession` — data is saved and queryable (`registerSession(_id)`), just no list page yet.
