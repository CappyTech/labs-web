# AGENTS.md — routes/

The HTTP surface: paths, verbs, and middleware wiring to controllers. **Wiring
only — no logic.**

Shared conventions live in the **app-root AGENTS.md** — reference up.

---

## 1. Responsibility

- Define endpoints and their HTTP verbs.
- Attach middleware (validation, error handler). **No auth in v1.**
- Wire `route → controller method`. That's it.

## 2. What does NOT belong here

- Any business logic or validation *implementation* (declare the middleware
  here; implement it elsewhere).
- Response shaping or money formatting → **controllers/**.
- DB or service calls → **controllers/** then **services/**.

## 3. Endpoint map (suggested)

Prefix everything with `/api/v1`.

- **Products** — `GET/POST /products`, `GET/PUT/DELETE /products/:id`
- **Members** — `GET/POST /members`, `GET/PUT/DELETE /members/:id`
- **Allocation rules** — `GET/POST /allocation-rules`,
  `GET/PUT/DELETE /allocation-rules/:id`
- **Invoices** — `POST /invoices`, `GET /invoices`, `GET /invoices/:id`
- **Split** — `POST /invoices/:id/split` (communal events passed in the **body**,
  never the query string), returns the per-member breakdown
- **Settlements** — `POST /settlements` (cadence + window in body),
  `GET /settlements/:id`

## 4. Conventions

- RESTful plural nouns; resource ids in the path.
- **Money never appears in a URL or query string** (pence in JSON bodies only) —
  keeps amounts out of logs/history.
- Versioned prefix `/api/v1` so the contract can evolve.
- Each route line points at exactly one controller method — if a route needs
  "and then" logic, that belongs in a controller/service, not the route file.
