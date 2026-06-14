# AGENTS.md — services/

The business-logic layer for the milk-round splitter. **The splitting engine
lives here and is the most important code in the project** — the maths has been
worked out carefully and must be preserved exactly. Read §3–§6 before touching
it.

Shared conventions (stack, CI, lint, commits) live in the **app-root
AGENTS.md** — don't repeat them here, reference up.

---

## 1. Responsibility

- Implement all domain logic: allocation, fraction splits, communal
  consumption, adjustments, costing, rounding, settlement.
- Orchestrate: load data → run the pure engine → persist results.
- All money is **integer pence**.

## 2. What does NOT belong here

- HTTP, `req`/`res`, status codes, response shaping → **controllers/**.
- Formatting pence → "£x.xx" → **controllers/**, at the edge only.
- Route/middleware wiring → **routes/**.

Services throw **typed domain errors** (e.g. `ReconciliationError`,
`FractionsDoNotSumError`, `UnknownProductError`). They know nothing about HTTP.

## 3. Modules

- **`SplitEngine` (PURE — no I/O, no DB, no HTTP).** The crown jewel. Keep it a
  set of pure functions so the maths is trivially testable in isolation:
  `allocateLines`, `splitFraction`, `applyAdjustments`, `applyCommunalEvents`,
  `reconcile`.
- **`InvoiceService`** — invoice CRUD; orchestrates `SplitEngine` to compute a
  per-member breakdown for an invoice.
- **`SettlementService`** — batches invoices in a window into one per-member
  figure, by cadence.
- **`ProductService` / `MemberService` / `RuleService`** — CRUD. Prices,
  members and pack sizes are **data, never hardcoded.**

## 4. Allocation rules

Every line item must be accounted for.

- **WHOLE** — member takes 100% of a line. *("Jack: all Whole Milk")*
- **FRACTION** — line split by fractions across members; fractions for one
  product **must sum to 1**. *("Luke 2/3 + Ben 1/3 of Semi Milk")*
- **FIXED** — member takes a specific bundle/item outright. *(Candice: the
  Yoghurt Bundle = 4 yoghurts in one line.)*
- **UNASSIGNED fallback** — configurable: assign-to-member / split-evenly /
  exclude. (Reference data: Iron Brew → all Jack.)

`unit_cost = line_total / quantity`; `cost_per_pint = bottle_total /
pints_per_bottle` (milk = **3 pints/bottle**).

## 5. Communal consumption — the fairness engine (do not break)

A **CommunalEvent** = N units (usually pints) of a product used by a named group.

1. Cost communal units at the buyer's **actual `cost_per_pint`** — no markup, no
   rounding-up of the rate.
2. Split **equally among the event's participants only.**
3. Participants **may or may not include the buyer.** Buyer is in the split only
   if they consumed that portion.
4. Buyer pays solo for all **non-communal** units of that product.

**Hard invariant:** the buyer never pays more than `(solo units + equal share of
communal units) × cost_per_pint`. The buyer never subsidises the group and never
profits from being the payer. Do **not** implement a fixed weekly levy — it
breaks this.

## 6. Adjustments

A negative line dated **before** the invoice's first delivery is a **backdated
credit**, attributed to the member who owned the original item and netted
against their balance. (Reference: −£4.00 yoghurt nets Candice's £4.00 bundle to
£0.00.)

## 7. Invariants — assert each with a test

1. Per product line, allocations sum to the full line qty/total (fractions
   sum to 1).
2. **Sum of all member shares on an invoice == invoice grand total** (incl.
   adjustments and delivery fee). Reconciles exactly.
3. A member share is negative only via a net adjustment credit.
4. Communal participants ⊆ members; equal split; reconciles to communal cost.
5. **Rounding:** distribute pennies (largest-remainder, or assign the diff to
   the buyer) so totals reconcile to the **exact pence** — never lose or invent
   a penny.

## 8. Golden fixture (reconciliation test)

Invoice `39875277`, total **£33.15**. Rules: Luke = 2/3 Semi + all Apple; Ben =
1/3 Semi + all Milkshake; Candice = Yoghurt Bundle; Jack = all Whole Milk + all
Choco Protein; Iron Brew → Jack.

- **No communal use:** Jack £20.95 · Luke £8.67 · Ben £3.53 · Candice £0.00.
- **1 communal Whole-Milk pint, 4-way** (`cost_per_pint` = £5.80/6 = £0.9667):
  Jack £20.23 · Luke £8.91 · Ben £3.77 · Candice £0.24.

Both must reconcile to £33.15 exactly.

## 9. Working agreements

- `SplitEngine` stays pure and storage-free.
- Integer pence everywhere; never floats for money.
- Every split/rounding path has a reconciliation test (invariant #2).
- The §5 fairness invariant is a hard requirement, not a nicety.
- Never hardcode prices, members, or pack sizes.
