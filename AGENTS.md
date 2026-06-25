# Agent Instructions — labs-web

This file provides instructions for AI coding agents (GitHub Copilot, etc.) working in this repository.

---

## Repository overview

- **Site:** [cappylabs.uk](https://cappylabs.uk)
- **Repo:** <https://github.com/CappyTech/labs-web>
- **Stack:** Node.js · Express · EJS (`express-ejs-layouts`) · MongoDB 8.0 (Mongoose)
- **Entry point:** `app.js`
- **Views:** `views/` — shared layout in `views/layout.ejs`
- **Static assets:** `resources/` — served at `/resources/` URL path

---

## Project structure

```
app.js                        — bootstraps Express, connects to MongoDB, mounts routers
services/db.js                — Mongoose connection helper (reads MONGO_URI from env)
models/                       — Mongoose schema/model definitions
routes/                       — Express Router files, required from app.js
controllers/                  — Request handlers, called from routes/
services/                     — Business logic and data-access, called from controllers/
views/                        — EJS templates; every page uses layout.ejs automatically
views/layout.ejs              — Shared HTML shell (navbar, footer, clock)
resources/css/style.css       — Global stylesheet; reference as /resources/css/style.css
```

### Request flow

```
HTTP request
  → app.js (mounts router)
    → routes/*.js (Express Router)
      → controllers/*.js (handler calls service, renders view)
        → services/*.js (DB queries / business logic via Mongoose models)
          → models/*.js (Mongoose schemas)
```

### Current routes

| Mount point  | Router file            | Controller                    | View                    |
|--------------|------------------------|-------------------------------|-------------------------|
| `GET /`      | `routes/index.js`      | `controllers/homeController`  | `views/index.ejs`       |
| `GET /milkman` | `routes/milkman.js`  | `controllers/milkmanController` | `views/milkman/index.ejs` |
| `GET /milkman/invoices/:id` | `routes/milkman.js` | `controllers/milkmanInvoiceController` | `views/milkman/invoice.ejs` |
| `GET /milkman/members/:id` | `routes/milkman.js` | `controllers/milkmanMembersController` | `views/milkman/members/show.ejs` |
| `POST /milkman/products/:id/components` | `routes/milkman.js` | `controllers/milkmanProductsController` | — (redirect) |
| `POST /milkman/invoices/:id/split` | `routes/milkman.js` | `controllers/milkmanInvoiceController` | — (redirect) |
| `POST /milkman/invoices/:id/settle` | `routes/milkman.js` | `controllers/milkmanInvoiceController` | — (redirect) |

---

## Versioning rules

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

| Change type | Version bump |
|-------------|-------------|
| Bug fixes, minor tweaks | `PATCH` — `1.0.x` |
| New features, backward-compatible | `MINOR` — `1.x.0` |
| Breaking changes | `MAJOR` — `x.0.0` |

### When you make any meaningful change, you MUST:

1. **Update `package.json`** — increment `"version"` according to the table above.
2. **Add a changelog entry** to `changelog.md` — see the format below.

---

## Changelog format

Entries go at the **top** of `changelog.md`, directly below the header block, in this format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- Description of new features or files.

### Changed
- Description of modifications to existing behaviour.

### Fixed
- Description of bug fixes.

### Removed
- Description of anything deleted.
```

Only include sections that are relevant to the release. Use past tense, imperative mood ("Add route for …", "Fix crash when …").

---

## Project conventions

- Simple routes can be defined directly in `app.js`. For larger features, create a file in `routes/` and `require` it from `app.js`.
- Route handlers (controller logic) belong in `controllers/`, exported and called from `routes/`.
- Business logic and data-access functions belong in `services/`, exported and called from `controllers/`.
- Mongoose models belong in `models/`, one file per model, exported as `mongoose.model(...)`.
- EJS views live in `views/`. Every page view must use `layout.ejs` (handled automatically by `express-ejs-layouts`). Group sub-application views in a sub-folder (e.g. `views/milkman/`).
- CSS and other static assets live under `resources/`. Reference them as `/resources/css/style.css` etc.
- Do not add inline `<style>` or `<script>` blocks to view files — use `resources/` instead.
- Environment-specific config (port, secrets, connection strings) must come from `process.env`, never hardcoded. Document all variables in `.compose.env.example`.

---

## Environment variables

Defined in `.compose.env` (copy from `.compose.env.example`). All variables must be documented in `.compose.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the Node.js app listens on |
| `MONGO_URI` | `mongodb://localhost:27017/labsweb` | MongoDB connection string |
| `MONGO_INITDB_ROOT_USERNAME` | — | MongoDB root user (used by the mongo container) |
| `MONGO_INITDB_ROOT_PASSWORD` | — | MongoDB root password (used by the mongo container) |

---

## Adding a new module to the homepage

Edit the `MODULES` array in `services/moduleService.js`:

```js
{ callsign: 'TAG', name: 'Service Name', desc: 'One-line description.', url: 'https://service.cappylabs.uk' },
```

Then bump the `PATCH` version and add a changelog entry.

---

## Adding a new route / feature

1. Create `models/MyModel.js` if the feature needs persistence.
2. Create `services/myFeatureService.js` with data-access functions.
3. Create `controllers/myFeatureController.js` calling the service and rendering views.
4. Create `routes/myFeature.js` with an Express Router.
5. Mount it in `app.js`: `app.use('/my-feature', require('./routes/myFeature'));`
6. Create views under `views/my-feature/`.
7. Bump the **MINOR** version and add a changelog entry.

