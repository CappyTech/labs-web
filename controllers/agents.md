# AGENTS.md — controllers/

Thin HTTP adapters between **routes/** and **services/**. Keep them thin: a
controller validates input, calls one service operation, and shapes the
response. Nothing else.

Shared conventions live in the **app-root AGENTS.md** — reference up, don't
duplicate.

---

## 1. Responsibility

- **Validate / parse** request input (shape, types, required fields, ranges).
- Call (usually) **one** service operation.
- **Shape the response** and map domain results to DTOs.
- **Format money here, at the edge:** convert integer pence → "£x.xx" only in
  the controller's response mapping. Everything upstream stays in pence.
- **Map domain errors → HTTP status:** validation → 400, not found → 404,
  reconciliation/invariant failure → 500 (it's a bug, surface it loudly),
  conflict → 409.

## 2. What does NOT belong here

- Business logic, maths, splitting, costing, rounding → **services/**.
  *If you are computing a split or a cost in a controller, it is in the wrong
  layer.*
- DB queries / Mongo access → delegate to services.
- Route paths, verbs, middleware wiring → **routes/**.

## 3. Conventions

- One controller per resource: `ProductController`, `MemberController`,
  `RuleController`, `InvoiceController`, `SplitController`,
  `SettlementController`.
- Return **DTOs** — never leak raw Mongo documents (no `_id`/`__v` bleed).
- Consistent error envelope across all controllers
  (`{ error: { code, message } }`).
- Controllers are synchronous glue around `await`ed service calls; no
  multi-step orchestration — if a request needs several service steps, that
  orchestration belongs in a service.

## 4. Contracts

Each controller depends on the matching service's public interface (see
**services/AGENTS.md** §3). Controllers must not reach past a service into the
`SplitEngine` directly — go through `InvoiceService` / `SettlementService`.
