# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.7.1] - 2026-06-16

### Added
- `Invoice.number` is now a unique index — the database will reject any duplicate at the storage layer.
- Parse preview shows a prominent amber warning banner when the parsed invoice number already exists in the system, with a direct link to the existing invoice and instructions not to proceed.
- `InvoiceService.findByNumber(number)` helper.

### Changed
- `confirmParse` and `create` now catch MongoDB E11000 duplicate-key errors and redirect to the existing invoice instead of crashing with a 500.

---

## [2.7.0] - 2026-06-16

### Added
- `/milkman/calendar` — delivery calendar view showing every delivery date across all invoices.
  - **Month grid** at the top: coloured dot per delivery day, multiple months side by side.
  - **Timeline** below: each delivery date expanded with product line items, invoice number, and status. Adjustment items (negative qty/total) are clearly distinguished from regular deliveries.
  - **Five states** per calendar date, derived from invoice status and position relative to the most recent invoice:
    - `awaiting` (grey) — delivery is in the most recent invoice; next invoice hasn't arrived yet.
    - `ready to split` (teal, faded) — a newer invoice has since been received but made no adjustment for this date; safe to compute.
    - `adjusted` (amber) — a later invoice has line items (negative) on this same date; correction captured.
    - `split computed` (teal) — parent invoice has been split.
    - `settled` (green) — parent invoice is fully settled.
  - Calendar nav card added to the dashboard Manage section.

---

## [2.6.3] - 2026-06-16

### Added
- `Invoice.kind` field (`'delivery'` | `'membership'`, default `'delivery'`). Parser auto-detects: no delivery days + membership charge → `membership`, everything else → `delivery`.
- Invoice list (`/milkman/invoices`) now groups by kind with section labels ("Deliveries", "Membership"). Delivery cards show `[INV]`, membership cards show `[SUB]`. Empty groups are omitted.
- Dashboard subtitle is now live: shows pending invoice count (amber, only when >0), total outstanding balance (amber when non-zero, grey when clear), and member count.

### Changed
- Invoice list cards now show date and invoice number together in the description line.

---

## [2.6.2] - 2026-06-16

### Changed
- Dashboard members section now shows each member's outstanding balance (`£0.00` in muted grey, positive amounts in amber). No extra DB query — reuses the balance data already fetched for the Outstanding balances section.

---

## [2.6.1] - 2026-06-16

### Fixed
- Settlements now sort by `windowStart` descending (receipt date of the invoice period) instead of `createdAt`. Previously a backdated April invoice computed today floated to the top of the settlements list because it was parsed most recently.
- Invoices list and dashboard "recent invoices" use `receiptDate: -1, _id: -1` so two invoices with the same receipt date appear in a stable, predictable order.

---

## [2.6.0] - 2026-06-16

### Added
- `Invoice.charges[]` — new schema field `{ type, label, amountP, splitType }` for invoice-level items that aren't per-member product deliveries: fees (`Weekly Delivery Fee`), discounts (`Coupon:*`), membership, balance carry-forwards, and other.
- `SplitEngine.applyCharges(shares, charges, members)` — distributes each charge across all members either `equal` (evenly) or `proportional` (in proportion to each member's pre-charge delivery share, so whoever ordered more absorbs more of a coupon saving). Falls back to equal when no member has a positive delivery share.
- Invoice parser now classifies all real-world milkman line types: coupons, delivery fees, balance carry-forwards, membership fees, and "Collect my empties" are routed into `parsed.charges[]` instead of being silently turned into junk products. Membership-only invoices (no delivery days) are now parsed correctly.
- Preview page shows a "Invoice charges" table with a per-charge `equal`/`proportional` split selector.
- Invoice detail page shows a "Charges" card grid (type, amount, label, split) with add/remove forms for pending invoices.
- `POST /milkman/invoices/:id/charges` and `POST /milkman/invoices/:id/charges/:idx/delete` routes.

### Changed
- `InvoiceService.computeSettlement` — calls `applyCharges` after adjustments, before reconciliation. Invoices with coupons and delivery fees now reconcile correctly: `sum(product lines) + sum(charges) === invoice.totalP`.

### Fixed
- Coupons and delivery fees no longer create spurious Product documents when parsing via the paste flow.
- `SplitEngine.reconcile` no longer throws on invoices that include coupons, fees, or membership lines.

---

## [2.5.10] - 2026-06-16

### Fixed
- `ProductService.checkDuplicates()` — AllocationRule repoint now handles the case where both the canonical and the duplicate already have a rule for the same member. Previously this threw `E11000 duplicate key error` on the `product_1_member_1` unique index. Fix: fetch the canonical's existing member IDs first; for each duplicate rule, delete it if the canonical already covers that member, otherwise repoint it and track the member as covered.

---

## [2.5.9] - 2026-06-16

### Changed
- `ProductService.checkDuplicates()` — now auto-fixes duplicates instead of only logging them. On startup, if any duplicate product groups are found (same name + `priceP`), the function automatically rewrites all Invoice line-item, communal-event, and AllocationRule references to the canonical ID (lowest ObjectId), then deletes the duplicates. No manual script run needed.
- Removed `scripts/dedup-products.js` and `npm run dedup-products` — superseded by the startup auto-fix.

---

## [2.5.8] - 2026-06-16

### Added
- `scripts/dedup-products.js` — one-time migration script that finds all products sharing the same name + `priceP`, keeps the oldest (lowest ObjectId), rewrites all Invoice line-item, communal-event, and AllocationRule references to the canonical ID, then deletes the duplicates. Run with `npm run dedup-products`.

---

## [2.5.7] - 2026-06-16

### Changed
- `views/milkman/rules/index.ejs` — product dropdown now appends `✓` to any product that already has at least one allocation rule, making it easy to spot unconfigured products at a glance.
- `milkmanRulesController.list` — passes `productsWithRules` (a `Set` of product ID strings) to the view, derived from the already-fetched grouped rules map at no extra DB cost.

---

## [2.5.6] - 2026-06-16

### Added
- `ProductService.checkDuplicates()` — scans all products on startup and logs any groups sharing the same name + `priceP`. Runs non-blocking after the server starts; prints a clean "OK" line when no duplicates exist, or a `⚠` warning per duplicate group with the product name, price, and all duplicate IDs.
- `app.js` — calls `checkDuplicates()` after DB connects.

---

## [2.5.5] - 2026-06-16

### Fixed
- `confirmParse` — product dedup now keys on `name + unit price` (`round(totalP/qty)`) rather than name alone. A 1-pint bottle at £1.10 and a 3-pint bundle at £2.90 share the same base name but have different unit prices and are correctly treated as distinct products. `ProductService.findByName` replaced with `findByNameAndPrice(name, priceP)` for the same reason.

---

## [2.5.4] - 2026-06-16

### Fixed
- `confirmParse` — removed price update on existing product match. Products are shared across historical invoices so mutating `priceP` would corrupt old records. Existing products are now reused as-is; only genuinely new products (no name match in DB) get created with the computed unit price.

---

## [2.5.3] - 2026-06-16

### Fixed
- `confirmParse` — when an auto-create product lookup finds an existing product by name, its `priceP` is now updated if the computed unit price (`round(totalP / qty)`) has changed. Milkman prices change week-to-week; previously the stored price would silently go stale.

---

## [2.5.2] - 2026-06-16

### Fixed
- `confirmParse` — duplicate products no longer created when the same unmatched product name appears on multiple delivery days within one invoice. A `productNameCache` map (keyed by lowercased name) is built during the confirm loop; on first miss, a case-insensitive DB lookup (`ProductService.findByName`) is performed before creating, so re-pasting an invoice that was already partially imported also avoids duplicates.
- `ProductService.findByName(name)` added — case-insensitive exact-match lookup by name.

---

## [2.5.1] - 2026-06-16

### Added
- **Outstanding balances on dashboard** — `/milkman` now shows a per-member balance card grid aggregated across all invoices with status `computed` (split run but not yet window-settled). Shows nothing when all splits are settled. Implemented via `SettlementService.getOutstandingBalances()`.

---

## [2.5.0] - 2026-06-16

### Added
- **Auto-create products on invoice parse** — if a line item on the paste-and-parse review page has no matching product, `confirmParse` now creates one automatically using the parsed item name and a unit price derived from `round(totalP / qty)`. The product is marked active. The review page labels these items "⚠ will auto-create" (was "⚠ no product match") so the user knows what will happen.
- A hidden `parsedName` field is included per line item in the preview form so `confirmParse` can use the base name (stripped of any "Adjustment " prefix) when creating the product.
- A "Paste invoice text instead →" shortcut link added to the `invoices/new` form.
- "Paste invoice" renamed to "Paste new invoice" on the invoices list page.

---

## [2.4.1] - 2026-06-16

### Fixed
- `views/layout.ejs` — Tailwind Play CDN script now loads **before** the `tailwind.config` assignment, resolving `ReferenceError: tailwind is not defined`.
- `views/layout.ejs` — Replaced `<style type="text/tailwindcss">` / `@apply` block with a plain `<style>` tag containing raw CSS. The `@apply bg-bg` pattern caused `CssSyntaxError: bg-bg class does not exist` because the Play CDN processed the style tag before the config script had run. Component classes (`.btn`, `.module`, `.section-label`, etc.) are now defined in plain CSS with no Tailwind dependency.

---

## [2.4.0] - 2026-06-16

### Changed
- Migrated all styling from custom CSS (`resources/css/style.css`) to **Tailwind CSS Play CDN** via a `<script>` tag in `views/layout.ejs`. No build step required.
- Custom design tokens (dark-mode palette, Space Grotesk / IBM Plex Mono fonts, LED animation, grid-line background) are preserved through a `tailwind.config` block extending the theme with named tokens (`bg`, `surface`, `ink`, `muted`, `accent`, `signal`, `settled`, `hairline`).
- All EJS views converted to Tailwind utility classes. Shared patterns (`.btn`, `.module`, `.card-grid`, `.section-label`, `.status-badge`, `.empty-state`, `.hero`, `.eyebrow`, `.lede`, `.wrap`) defined in `@layer components` via `@apply`; input/table base styles defined in `@layer base`.
- `resources/css/style.css` is now empty (stub kept so the static route doesn't 404 on stale caches).

---

## [2.3.1] - 2026-06-16

### Changed
- `views/layout.ejs` — footer now displays the app version number (`vX.Y.Z`), sourced from `package.json` via `res.locals.appVersion` set in `app.js`.

## [2.3.0] - 2026-06-15

### Added
- `services/invoiceParser.js` — pure parser for copy-pasted milkman invoice text. Extracts invoice number, receipt date, transaction ID, grand total (pence), and per-delivery-day line items. Handles negative lines ("Adjustment …" prefix), fee rows without a qty column (e.g. "Weekly Delivery Fee"), and skips zero-value fee rows.
- `GET /milkman/invoices/parse` — textarea form for pasting raw invoice text.
- `POST /milkman/invoices/parse` — parses the text server-side, attempts case-insensitive name matching against existing products, and renders a review page.
- `POST /milkman/invoices/confirm` — accepts the reviewed form and creates the invoice with all delivery days and line items in a single step.
- Review page (`views/milkman/invoices/preview.ejs`) — shows parsed header fields (editable), a table per delivery day with product dropdowns pre-selected on name matches, editable qty/pence fields, and a per-item skip checkbox. Unmatched products are flagged with a warning. A `<details>` element lets the user re-paste and re-parse without losing context.
- "Paste invoice" button added to the invoice list page alongside "New invoice".

## [2.2.0] - 2026-06-15

### Added
- **Members UI** — `GET /milkman/members` (list + inline create form), `GET /milkman/members/:id/edit` (edit name, isBuyer, active flag).
- **Products UI** — `GET /milkman/products` (list + inline create form), `GET /milkman/products/:id/edit` (edit all fields).
- **Allocation Rules UI** — `GET /milkman/rules` lists rules grouped by product with a create form and per-rule delete button.
- **Invoice list** — `GET /milkman/invoices` shows all invoices; `GET /milkman/invoices/new` is a creation form for the invoice header.
- **Invoice detail edit forms** (pending invoices only) — add/remove delivery days, add/remove line items per day, add/remove communal events per day (with member checkboxes for participants), add/remove adjustments.
- **Settlements UI** — `GET /milkman/settlements` lists all window settlements with per-member balances.
- Landing page (`/milkman`) now has a navigation grid linking to all sections.
- `express.urlencoded` middleware added to `app.js` to handle HTML form submissions.
- `InvoiceService.getAllInvoices` and `InvoiceService.getInvoiceRaw` (non-populated lean fetch for server-side mutation).
- Controllers: `milkmanMembersController`, `milkmanProductsController`, `milkmanRulesController`, `milkmanInvoicesController`, `milkmanSettlementsController`.

### Changed
- `milkmanInvoiceController.show` now loads active products and members and passes them to the invoice detail view for dropdown population.
- `views/milkman/invoice.ejs` — extended with inline edit forms for pending invoices and back-link to invoice list.
- `routes/milkman.js` — expanded with all new HTML routes.

## [2.1.0] - 2026-06-15

### Added
- `GET /api/v1/settlements` — list all settlements; accepts optional `?from=&to=` query params to filter by overlapping window.
- `PUT /api/v1/invoices/:id` — update a pending invoice (number, receiptDate, totalP, deliveryDays, adjustments); returns 404 if the invoice is not in pending status.
- `PATCH /api/v1/invoices/:id/status` — set invoice status to `pending`, `computed`, or `settled`.
- `SettlementService.getAllSettlements` — query all settlements without a date filter.
- `SettlementService.getSettlementForInvoice` — look up the settlement for a specific invoice by ID.
- `InvoiceService.updateInvoice` / `setInvoiceStatus` — service functions for the new API endpoints.
- `POST /milkman/invoices/:id/split` and `POST /milkman/invoices/:id/settle` — HTML form actions that trigger split computation and status update, then redirect.
- `GET /milkman/invoices/:id` — invoice detail page showing delivery days, line items, adjustments, split results, and contextual action buttons.
- `test/splitEngine.test.js` — 21 unit tests for `SplitEngine` using `node:test`; run with `npm test`.

### Changed
- `SettlementService.createWindowSettlement` — now marks all included invoices as `settled` after creating the window settlement.
- `SplitController.split` — returns 201 on first computation, 200 on re-computation. Now also catches `FractionsDoNotSumError` (→ 400 `FRACTIONS_ERROR`) and `UnknownMemberError` (→ 400 `UNKNOWN_MEMBER`).
- `milkmanController.index` — formats `receiptDate` at the controller edge as `receiptDateFormatted`; adds `id` string to each invoice object.
- `views/milkman/index.ejs` — uses pre-formatted date; invoice cards are now clickable links to the detail page; member cards show "account holder" label for buyers.
- `package.json` — added `test` script (`node --test test/**/*.test.js`).

### Fixed
- `InvoiceService.computeSettlement` — throws `UnknownProductError` if a communal event's product cannot be found in any line item (previously produced silent `NaN` in cost-per-pint calculation).
- `InvoiceController.create` — `totalP` validation now rejects non-integers (e.g. `1.5`) via `Number.isInteger` check.
- `SplitEngine.applyAdjustments` — throws `UnknownMemberError` for any adjustment referencing a member not in the active shares map (previously silently created a phantom entry).

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
