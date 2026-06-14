# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-06-14

### Added
- `models/AllocationRule.js` — flat per-(product, member) schema with `WHOLE | FRACTION | FIXED` enum, `fraction`, `fixedQty`. Unique index on (product, member).
- `controllers/dto.js` — shared `toDTO`, `formatMoney`, `err` helpers for all API controllers.
- `controllers/ProductController.js` — CRUD for products.
- `controllers/MemberController.js` — CRUD for members.
- `controllers/RuleController.js` — CRUD for allocation rules; returns 409 on duplicate.
- `controllers/InvoiceController.js` — list, create, get; formats `totalP` → `total` at edge.
- `controllers/SplitController.js` — `POST /invoices/:id/split`; maps `ReconciliationError` → 500, `UnknownProductError` → 400.
- `controllers/SettlementController.js` — create window settlement, get by id.
- `routes/api.js` — all `/api/v1` endpoints: products, members, allocation-rules, invoices, split, settlements.

### Changed
- `models/Product.js` — renamed `unitPricePence` → `priceP` (integer pence suffix convention); added `category`; removed `packSize`.
- `models/Member.js` — added `isBuyer`; removed `email`.
- `models/Invoice.js` — restructured: `deliveryDays[]` → `lineItems[]` + `communalEvents[]`; `totalP` (was `grandTotalPence`); `number`/`receiptDate`/`transactionId` (was `externalRef`/`deliveryDate`); `LineItem.qty`/`totalP` are unconstrained (allow negatives for credits).
- `models/Settlement.js` — restructured: `cadence`, `windowStart`, `windowEnd`, `invoiceIds[]`, `balances[]` (`{ member, owedP }`).
- `services/SplitEngine.js` — removed `UNASSIGNED` from allocateLines switch; lines now use `totalP` field name; unknown rule type throws `UnknownProductError`.
- `services/InvoiceService.js` — full rewrite for new model shapes; `computeSettlement` loads members internally; buyer derived from WHOLE/FIXED rule (not stored on CommunalEvent).
- `services/RuleService.js` — ported to `AllocationRule` model (flat schema); new `getRulesForProduct` and `getRuleById`.
- `services/SettlementService.js` — updated for new Settlement model; `createWindowSettlement` aggregates per-invoice Settlements.
- `app.js` — added `express.json()` middleware; mounted `/api/v1` router.
- `controllers/milkmanController.js` — formats money at controller edge via `formatMoney`; uses `inv.number`/`inv.receiptDate`.
- `views/milkman/index.ejs` — uses pre-formatted `inv.total` and `inv.number` from controller.

### Removed
- `models/Rule.js` — deprecated in place; superseded by `AllocationRule.js`.
- `models/Customer.js` — deprecated in place; superseded by `Member.js`.
- `models/Order.js` — deprecated in place; superseded by `Invoice.js`.

---

## [1.5.0] - 2026-06-14

### Added
- `services/errors.js` — typed domain errors: `ReconciliationError`, `FractionsDoNotSumError`, `UnknownProductError`, `UnknownMemberError`.
- `services/SplitEngine.js` — pure split engine: `largestRemainder`, `splitFraction`, `allocateLines`, `applyAdjustments`, `applyCommunalEvents`, `reconcile`. No I/O.
- `services/MemberService.js` — member CRUD.
- `services/ProductService.js` — product CRUD.
- `services/RuleService.js` — allocation rule upsert/query/delete.
- `services/InvoiceService.js` — invoice CRUD and `computeSettlement` (orchestrates SplitEngine).
- `services/SettlementService.js` — settlement queries and per-member aggregation.
- `models/Member.js` — bill-sharing members.
- `models/Product.js` — products with `unitPricePence`, `packSize`, `pintsPerBottle`.
- `models/Rule.js` — allocation rules (WHOLE / FRACTION / FIXED / UNASSIGNED).
- `models/Invoice.js` — milkman invoices with lines, communal events, and adjustments (all money in integer pence).
- `models/Settlement.js` — computed per-member shares for an invoice.
- `.status-badge` CSS variants for invoice statuses.

### Changed
- `services/milkmanService.js` — replaced old Customer/Order logic; now re-exports MemberService and InvoiceService.
- `controllers/milkmanController.js` — uses MemberService and InvoiceService.
- `views/milkman/index.ejs` — shows recent invoices and active members.

---

## [1.4.2] - 2026-06-14

### Fixed
- `controllers/milkmanController.js` — wrapped async handler in try/catch and passed errors to `next(err)` so Express can handle them.
- `views/milkman/index.ejs` — replaced inline `style` attributes with `.empty-state` CSS class.
- `resources/css/style.css` — added `.empty-state` utility class.

---

## [1.4.1] - 2026-06-14

### Changed
- `AGENTS.md` — updated to reflect full project structure: MongoDB/Mongoose stack, request flow, current route table, environment variable reference, and step-by-step guide for adding new routes.

---

## [1.4.0] - 2026-06-14

### Added
- `models/Customer.js` — Mongoose schema for milkman customers (name, address, phone, email, active, notes).
- `models/Order.js` — Mongoose schema for deliveries (customer ref, deliveryDate, items, delivered, notes).
- `services/milkmanService.js` — `getActiveCustomers`, `getOrdersForDate`, `getPendingOrders`.
- `controllers/milkmanController.js` — `GET /milkman` handler.
- `routes/milkman.js` — Express Router for `/milkman`.
- `views/milkman/index.ejs` — dashboard showing pending deliveries and active customers.

### Changed
- `app.js` — mounted `/milkman` route.

---

## [1.3.0] - 2026-06-14

### Added
- `mongo:8.0` service in `compose.yaml` with a named volume (`mongo_data`) and a healthcheck.
- `labs-web` depends on `mongo` being healthy before starting.
- `services/db.js` — Mongoose connection helper, reads `MONGO_URI` from the environment.
- `models/` directory for Mongoose model definitions.
- `MONGO_URI`, `MONGO_INITDB_ROOT_USERNAME`, and `MONGO_INITDB_ROOT_PASSWORD` added to `.compose.env.example`.
- `mongoose` ^8.4.4 added to dependencies.

### Changed
- `app.js` — now calls `db.connect()` before starting the HTTP server; exits with code 1 on connection failure.

---

## [1.2.1] - 2026-06-14

### Added
- `.gitignore` — excludes `node_modules/`, `.compose.env`, logs, and OS artefacts.

---

## [1.2.0] - 2026-06-14

### Added
- `services/moduleService.js` — returns the list of active modules.
- `controllers/homeController.js` — handles the `GET /` request, calls the service.
- `routes/index.js` — Express Router wiring `GET /` to the home controller.

### Changed
- `app.js` — removed inline route handler; now mounts `routes/index.js`.

---

## [1.1.0] - 2026-06-14

### Added
- `controllers/` directory for route handler functions.
- `services/` directory for business logic and data-access functions.
- `routes/` directory for Express Router definitions.

---

## [1.0.1] - 2026-06-14

### Added
- `.compose.env.example` with `PORT` variable for container environment configuration.

### Changed
- `compose.yaml` — added `env_file: .compose.env` to the `labs-web` service.
- `Caddyfile` — corrected upstream reference to `labs-web:3000` (container/service name).

---

## [1.0.0] - 2026-06-14

### Added
- Initial Node.js application using Express and EJS.
- `express-ejs-layouts` for shared `layout.ejs` template.
- Static assets served from `/resources/` (`resources/css/style.css`).
- Index route rendering active modules for cappylabs.uk.
- `AGENTS.md` with versioning and changelog conventions for AI agents.
