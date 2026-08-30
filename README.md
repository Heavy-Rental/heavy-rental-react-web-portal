# Heavy Rental Web Portal

React + TypeScript + Vite frontend for a heavy machinery rental business (Singapore).

Canonical GitHub repository: [`Heavy-Rental/heavy-rental-react-web-portal`](https://github.com/Heavy-Rental/heavy-rental-react-web-portal).

UI mockup merged from a **Figma Make / Figma AI** design (see `ATTRIBUTIONS.md` for photo credits).

The portal talks to a **mock REST API** by default (`npm run dev`) and to the real Spring Boot backend in API mode (`npm run dev:api`). Production Release builds with `vite build --mode api`.

## Features

- **Public portal** — equipment catalog, search/filter, hero, stats, testimonials
- **Customer flow** — onboarding (know what I want / upload specs for Instant Quote), shared-date catalog, cart, Stripe (API mode) or simulated (mock mode) deposit checkout, profile & **My Bookings**
- **Admin dashboard** — overview, fleet, assets, bookings, users
- **Employee dashboard** — operational overview (role exists; there is no demo employee login)
- **Safety / About / Projects** pages
- **Equipment assistant chatbot** (rule-based mock; Instant Quote is wired to `POST /api/recommendations/project-spec`)

### Demo logins

These are the accounts shown in the sign-in modal. Passwords are compared client-side in mock mode (`src/features/auth/accounts.ts`); API mode then calls the real `/api/auth` login with the same credentials.

| Email | Password | Role |
|-------|----------|------|
| `alex.tan@example.sg` | `customer123` | Customer |
| `ravi.kumar@example.sg` | `admin123` | Admin |

Wrong email or password is rejected with a generic "Invalid email or password." There is no employee demo account.

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- [lucide-react](https://lucide.dev) icons
- [recharts](https://recharts.org) for dashboard charts
- Stripe.js (`@stripe/stripe-js`, `@stripe/react-stripe-js`) for API-mode deposit checkout
- MUI (`@mui/material`) for the login loading overlay
- Vitest + Testing Library (unit/component); Playwright (installed; no committed `e2e/` specs yet)

## Scripts

```bash
npm install
npm run dev            # local dev server, proxied to the mock API (same as dev:mock)
npm run dev:mock       # local dev server, proxied to the mock API server (127.0.0.1:4010)
npm run dev:api        # local dev server, proxied to VITE_API_TARGET (heavy-rental-rest-api:8080)
npm run build          # production build (`tsc -b` then `vite build`)
npm run preview        # preview production build
npm run lint           # ESLint
npm test               # Vitest once
npm run test:watch     # Vitest watch
npm run test:e2e       # Playwright (needs `npm run test:e2e:install` first)
npm run test:e2e:ui    # Playwright UI
npm run test:e2e:install  # install Chromium for Playwright
```

There is **no** npm script that starts the mock API. Start it from the Thinker "Mock Server" VS Code extension: Command Palette → **Mock Server: Start / Restart Server** (`127.0.0.1:4010`).

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
| Studies (not runtime SoT) | [`Feasibility_Study/`](Feasibility_Study/) | Architecture notes |

Conflict rule: workflow YAML / code, then OpenSpec, then `specification/`.

`CHANGELOG.md` is a short portal log. Feature-level history lives in each specification file's Change Log. `BLANK_README.md` is unused template leftover — use this README.

## Delivery pipelines (summary)

- **Fast Feedback** — feature-branch push; Integration only.
- **CI** — PR / push to `develop`; Integration Check (reuses Fast Feedback when possible), QC, Security, CodeQL, REST tests.
- **Release** — manual `workflow_dispatch` on `master`; package (`vite build --mode api`) + DAST + public GHCR + GitHub Release.
- **Security Report** — weekly summary of existing Code Scanning alerts.
- **Portal CD** — Academy or paid `workflow_dispatch`; `resolve-aws-profile`; paid is OIDC with no `secrets: inherit`; health is guest `GET /` (not ALB target-group config).

Defaults: Node 22, `DEFAULT_APP_REPOSITORY=Heavy-Rental/heavy-rental-react-web-portal`. Paid CD uses GitHub OIDC and MUST NOT use `secrets: inherit`.
