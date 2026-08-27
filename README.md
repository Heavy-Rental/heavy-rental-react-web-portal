# Heavy Rental Web Portal

React + TypeScript + Vite frontend for a heavy machinery rental business.

Canonical GitHub repository: [`Heavy-Rental/heavy-rental-react-web-portal`](https://github.com/Heavy-Rental/heavy-rental-react-web-portal).

UI mockup merged from a **Figma Make / Figma AI** design (see `ATTRIBUTIONS.md` for photo credits).

## Features (design prototype)

- **Public portal** — equipment catalog, search/filter, hero, stats, testimonials
- **Customer flow** — onboarding (know / browse / specs), calendar booking, cart, checkout, profile & rental plans
- **Admin dashboard** — fleet, assets, bookings, pricing, analytics charts
- **Employee dashboard** — operational overview
- **Safety / About / Projects** pages
- **Equipment assistant chatbot** (rule-based mock)

### Demo logins

| Email | Role |
|-------|------|
| `john@company.com` | Customer |
| `sarah@company.com` | Admin |

Any non-empty password works in this mockup.

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- [lucide-react](https://lucide.dev) icons
- [recharts](https://recharts.org) for dashboard charts

## Scripts

```bash
npm install
npm run dev      # local dev server, proxied to the mock API (same as dev:mock)
npm run dev:mock # local dev server, proxied to the mock API server (127.0.0.1:4010)
npm run dev:api  # local dev server, proxied to VITE_API_TARGET (heavy-rental-rest-api:8080)
npm run build    # production build
npm run preview  # preview production build
```

## Project layout

```
src/
  App.tsx
  app/                    # API client, auth, session, shared pages
  features/               # admin, auth, browse, cart, checkout, customer, employee, marketing
  components/             # shared UI
  lib/                    # date/postal helpers
  styles/theme.css        # Dark industrial design tokens
```

## Documentation

| Layer | Path | Standard |
| --- | --- | --- |
| Behavior (what) | [`openspec/specs/`](openspec/specs/) | OpenSpec `spec-driven-with-adr` |
| Design contract (how) | [`spdd/prompt/`](spdd/prompt/) | OpenSPDD REASONS Canvas |
| Architecture (why) | [`adr/`](adr/) | MADR-short ADRs |
| Feature SDD | [`specification/`](specification/) | Product specs + [index](specification/README.md) |
| Environment / CI/CD SDD | [`specification/Spec-project-environment.md`](specification/Spec-project-environment.md) | Matches `openspec/specs/ci-pipelines` and `portal-cd` |

Conflict rule: workflow YAML / code, then OpenSpec, then `specification/`.

## Delivery pipelines (summary)

- **Fast Feedback** — feature-branch push; Integration only.
- **CI** — PR / push to `develop`; Integration Check (reuses Fast Feedback when possible), QC, Security, CodeQL, REST tests.
- **Release** — manual `workflow_dispatch` on `master`; package + DAST + public GHCR + GitHub Release.
- **Security Report** — weekly summary of existing Code Scanning alerts.
- **Portal CD** — Academy or paid `workflow_dispatch`; `resolve-aws-profile`; paid is OIDC with no `secrets: inherit`; health is guest `GET /` (not ALB target-group config).

Defaults: Node 22, `DEFAULT_APP_REPOSITORY=Heavy-Rental/heavy-rental-react-web-portal`. Paid CD uses GitHub OIDC and MUST NOT use `secrets: inherit`.
