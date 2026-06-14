# AGENTS.md — models/

The persistence layer: schema definitions, field-level validation, and indexes.
Schemas describe the **shape** of data — not what it means or how it's split.

Shared conventions live in the **app-root AGENTS.md** — reference up, don't
duplicate.

---

## 1. Responsibility

- Define the schema for each entity (Mongoose).
- **Field-level** validation only: required, type, enum, range.
- Indexes for the queries services actually run.
- Store **money as integer pence** (suffix money fields `…P`, e.g. `totalP`,
  `priceP`). Never floats, never a "£" string.
- Read-only derived **virtuals** are fine (e.g. a `unitCostP` virtual); anything
  that needs *other records* is not a model concern.

## 2. What does NOT belong here

- Splitting, fractions, communal logic, rounding, costing across records →
  **services/**.
- Cross-record validation (e.g. "fractions for a product sum to 1") →
  **services/**. A schema validator can't see sibling rules.
- HTTP, response shaping, £ formatting → **controllers/** / **views/**.

## 3. Schemas

- **Product** — `name`, `priceP`, `pintsPerBottle?` (milk = 3), `category`.
- **Member** — `name`, `isBuyer` (exactly one true).
- **AllocationRule** — `productId`, `memberId`, `type`
  (`WHOLE` | `FRACTION` | `FIXED`), `fraction?` (0 < x ≤ 1), `fixedQty?`.
- **Invoice** — `number`, `receiptDate`, `transactionId`, `totalP`,
  `deliveryDays[]`, `adjustments[]`.
- **DeliveryDay** — `date`, `lineItems[]`.
- **LineItem** — `productRef`, `qty`, `totalP`. **`qty`/`totalP` may be
  negative** (adjustments) — do not constrain these to ≥ 0.
- **CommunalEvent** — `productRef`, `units`, `participants[]` (memberIds).
- **Settlement** — `cadence`, `windowStart`, `windowEnd`, `invoiceIds[]`,
  `balances[]` (`{ memberId, owedP }`).

## 4. Conventions

- Enums for `type` and `cadence`; reject unknown values at the schema.
- `timestamps: true` on all schemas.
- Prices ≥ 0; but **never** block negative `LineItem` totals (adjustments).
- A `toJSON` transform may drop `__v`, but DTO/response shaping is the
  controller's job, not the model's.
- Prices, members, and pack sizes are seeded **data** — no values hardcoded in
  schema defaults beyond sane fallbacks.

## 5. Contracts

Only **services/** read and write through models. Controllers, routes, and views
never touch the DB directly.
