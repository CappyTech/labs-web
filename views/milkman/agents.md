# AGENTS.md — views/

The presentation layer: templates that render invoices, per-member breakdowns,
and settlement statements. **Views are dumb — they display values, they never
compute them.**

Shared conventions live in the **app-root AGENTS.md** — reference up.

---

## 1. Responsibility

- Render server-side templates (Pug / EJS / Handlebars) for the breakdown,
  invoice summary, and settlement statement screens.
- Display money as `£x.xx` using a **single shared format helper/filter** —
  defined once, used everywhere.
- Semantic, accessible HTML.

## 2. What does NOT belong here

- **Any calculation** — splitting, rounding, currency conversion, summing.
  Values arrive **display-ready** from controllers (already pence-formatted at
  the controller edge). If a template is doing arithmetic, the logic is in the
  wrong layer.
- Data fetching, DB, or service calls → **controllers/** → **services/**.
- Business decisions (who pays what, fallback handling) → **services/**.

## 3. Conventions

- Templates loop and render — no `if`-heavy branching, no maths in the markup.
- The £ format helper mirrors the controller's edge rule: pence → "£x.xx" is
  defined in exactly one place.
- Escape all output; money is rendered as text only, never interpolated into
  attributes/URLs.
- Keep a clear template per screen; share partials for the member-row and the
  reconciliation total line.

## 4. If this is an API-only / SPA frontend

If the UI is a separate single-page app consuming `/api/v1` rather than
server-rendered, this layer is the **response view-models / serializers**
instead — the rules are unchanged: presentation only, no logic, format at the
edge, never import services or models.

## 5. Contracts

Views receive **view-models / DTOs from controllers**. They never import
services or models, and never see integer pence that hasn't already been shaped
for display.
