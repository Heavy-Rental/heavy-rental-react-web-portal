# Feature Specification: Project Environment

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-04
**Status**: Implemented
**Input**: "Document the project's development/runtime environment, tooling, and CI/CD pipelines as a specification, referencing the structure of the existing specifications in this project."

## Overview

The `specification/` folder documents business rules (`Spec-ui-heavy-machinery-portal.md`) and the mock REST API (`Spec-mock-api-server.md`), but nothing describes the environment those specs are implemented against — the runtime, package manager, build/lint tooling, and the CI/CD pipelines that gate every change. This specification closes that gap so a contributor or an AI coding agent has one authoritative reference for how the project is built, checked, and shipped, instead of having to reverse-engineer it from `package.json` and workflow YAML.

## User Scenarios & Testing *(mandatory)*

### Primary User Story

As a contributor or AI coding agent working on this project, I need a single reference describing the runtime, build tooling, and CI/CD pipelines, so I can set up my environment correctly, validate changes locally the same way CI will, and understand what happens to a change after it's pushed.

### Acceptance Scenarios

1. **Given** a fresh clone of the repository, **When** a contributor runs `npm install` followed by `npm run dev`, **Then** the Vite dev server starts and serves the app locally.
2. **Given** a contributor wants to validate a change before pushing, **When** they run `npm run lint` and `npx tsc -b`, **Then** they get the same quality signal that CI's Quality Control job produces.
3. **Given** a pull request targeting the `develop` branch, **When** `portal-ci-caller.yml` triggers `integration-pipeline.yml`, **Then** Integration, Quality Control, Security Testing, CodeQL Analysis, and REST Endpoint Tests all run, and the GitHub Flow CI Gate only passes if every one of them succeeds.
4. **Given** a push to any branch other than `master` or `develop`, **When** `portal-fast-feedback-caller.yml` triggers, **Then** only a lightweight Integration check runs (checkout, dependency install, install verification) — no lint, security scan, or tests.
5. **Given** a GitHub release is published, or a pull request from `develop` into `master` is opened, **When** `portal-release-caller.yml` triggers `release-pipeline.yml`, **Then** the app is built, packaged into a zip archive, containerized via Docker/nginx, and — only for an actual published release, not a develop→master PR — pushed to GHCR.
6. **Given** a contributor wants to exercise the REST API locally, **When** they start the mock server via the Thinker "Mock Server" VS Code extension, **Then** a local mock API starts on `127.0.0.1:4010`, matching `Spec-mock-api-server.md`. (There is deliberately no npm script for this — see FR-003 and the Change Log.)

### Edge Cases

- What happens if a contributor's local Node.js version differs from the version CI uses? Nothing enforces alignment locally — there is no `.nvmrc` and no `engines` field in `package.json`; this is a known gap (see Requirements).
- What happens if a future feature needs environment variables? ~~None exist today for the app itself~~ **Superseded 2026-08-06**: one now does — `VITE_API_TARGET` (see FR-011), read by `vite.config.ts` via `.env.mock`/`.env.api`, selecting the Vite dev-server proxy destination. The mock server itself still doesn't read `process.env` (it runs only via the VS Code extension, configured through `.vscode/settings.json`/`.mockserverrc.cjs`).
- What happens when `rest-endpoint-tests` runs before a test script exists? It takes a documented "not ready" placeholder path and passes green with an explanatory summary, rather than failing or silently skipping.
- What happens if a contributor runs `npm run dev:api` locally without Stripe webhook delivery reaching the backend? **New 2026-08-20.** The deposit payment itself still succeeds (Stripe confirms client-side), but the backend's `PaymentWebhookService` never runs, so `Booking.status` silently never leaves `PENDING_DEPOSIT` (see `Spec-stripe-payment-checkout.md` FR-008/Dependencies). Locally this requires Stripe webhook forwarding to be running against the backend alongside `npm run dev:api`; the `heavy-rental-spring-rest-api` repo provides `./scripts/dev-webhook-listen.sh` for this (run in its own terminal, uses the shared team Stripe test key — no personal Stripe login needed). This script lives in the backend repo, not here, so its exact behavior isn't independently verified from this repo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST target Node.js 22 for install and build steps, as pinned by `NODE_VERSION: "22"` in every CI workflow.
- **FR-002**: The project MUST use npm as its package manager, governed by the committed `package-lock.json` (lockfileVersion 3); CI installs via `npm ci`.
- **FR-003**: The project MUST provide npm scripts for: starting the dev server against the mock API (`dev`, `dev:mock`) or against a placeholder Spring Boot target (`dev:api`), producing a production build (`build`), linting (`lint`), previewing a production build (`preview`), running the unit/component suite (`test` = `vitest run`, `test:watch` = `vitest`), and running Playwright E2E (`test:e2e`, `test:e2e:ui`, `test:e2e:install`). `dev`/`dev:mock`/`dev:api` only choose which backend the Vite dev-server proxy targets (see FR-011) — there is still deliberately **no** npm script for the mock API server itself, which is started only via the Thinker VS Code extension's UI, since the underlying npm package was removed for a high-severity `npm audit` finding with no non-breaking fix (see `Spec-mock-api-server.md`'s Change Log).
- **FR-004**: The production build MUST perform a TypeScript project build (`tsc -b`, using the composite `tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json` structure) before bundling with `vite build`.
- **FR-005**: Linting MUST run via ESLint's flat config (`eslint.config.js`), applying JS-recommended, `typescript-eslint`-recommended, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh` rule sets to all `**/*.{ts,tsx}` files, excluding `dist`.
- **FR-006**: Styling MUST be provided by Tailwind CSS v4 through the `@tailwindcss/vite` plugin, with no separate PostCSS or `tailwind.config` file required.
- **FR-007**: Every pull request targeting `develop` MUST pass all of: Integration, Quality Control (lint + typecheck), Security Testing (SAST, dependency audit, filesystem vulnerability scan), CodeQL Analysis, and REST Endpoint Tests, aggregated by a GitHub Flow CI Gate job that fails if any one of them does not succeed.
- **FR-008**: Security Testing MUST produce SARIF 2.1.0 reports (Semgrep SAST, `npm audit` SCA, Trivy filesystem scan), upload them to GitHub Code Scanning, and fail the pipeline on ERROR/CRITICAL-severity findings.
- **FR-009**: Pushes to any branch other than `master` or `develop` MUST trigger only a lightweight, Integration-only fast-feedback pipeline.
- **FR-010**: A published release, or a pull request from `develop` into `master`, MUST trigger a packaging pipeline that builds the app, verifies and zips the `dist/` output, and builds a Docker/nginx image; the image MUST be pushed to GHCR only when triggered by an actual published release.
- **FR-011**: ~~The local mock REST API server MUST be configurable via `MOCK_API_HOST` and `MOCK_API_PORT` environment variables~~ **Superseded 2026-08-04**: the mock server (VS Code extension only) does not read environment variables — its host/port are fixed by `.vscode/settings.json`/`.mockserverrc.cjs` at `127.0.0.1:4010`, matching CI's expected values by convention, not by env-var injection. CI's `MOCK_API_BASE_URL`/`MOCK_API_HEALTH_PATH`/`MOCK_API_READY_TIMEOUT_SECONDS` remain the readiness-polling contract those CI workflow env vars define, for whenever an npm-invokable mock-server script and a `test:api`-family script both exist (neither does today — see FR-012 and `Spec-mock-api-server.md`). **Further superseded 2026-08-06**: the paragraph above is still accurate for the mock server itself, but the *frontend's* Vite dev-server proxy now does read an environment variable — `VITE_API_TARGET`, set per npm script via `.env.mock` (`http://127.0.0.1:4010`, this mock server) or `.env.api` (originally `http://localhost:8080`, a placeholder Spring Boot target; see next update) and consumed in `vite.config.ts` via `loadEnv`. This only selects the proxy destination; it does not give the mock server itself env-var configuration. See `Spec-frontend-api-integration.md` FR-002 and `Spec-mock-api-server.md`'s Appendix. **Further superseded 2026-08-09**: `.env.api`'s `VITE_API_TARGET` value changed from `http://localhost:8080` to `http://heavy-rental-rest-api:8080` — a resolvable container-network hostname for the Spring Boot backend service, not a locally-run process on `localhost`. Running `npm run dev:api` now requires that hostname to resolve (e.g. via Docker Compose), not a bare `localhost:8080` process. See `Spec-frontend-api-integration.md` FR-002 and `Spec-mock-api-server.md`'s Appendix for the matching update.
- **FR-012**: ~~No automated test runner is currently configured…~~ **Superseded 2026-08-13**: Vitest is the unit/component runner (`npm test` / `npm run test:watch`, `jsdom`, Testing Library, setup in `src/test/setup.ts`). Playwright (`@playwright/test`) is installed for browser E2E (`npm run test:e2e`, Chromium, `e2e/`, `playwright.config.ts`). There is still no `test:api` / Cypress suite.

### Key Entities / Components

- **Runtime stack**: Node.js 22, npm, React 19.2, TypeScript ~6.0, Vite 8.2, Tailwind CSS v4.
- **Build configuration**: `vite.config.ts` (React + Tailwind plugins, `@` → `./src` alias), TypeScript project references (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`), ESLint flat config (`eslint.config.js`).
- **CI/CD pipeline set**: three caller → reusable workflow pairs — fast-feedback, integration/CI, and release — each reusable workflow restricted to its one designated caller via an `assert-caller` gate job.
- **Mock API tooling**: Thinker "Mock Server" VS Code extension, `mock/db.json`, `.mockserverrc.cjs` (see `Spec-mock-api-server.md`). Not an npm devDependency — see FR-003.
- **Documentation set**: `README.md` (current, accurate), `specification/*.md` (SDD specs), plus template-origin files carried over from repo scaffolding (`BLANK_README.md`, `CHANGELOG.md`, `LICENSE.txt`).

## Dependencies & Assumptions

- Assumes contributors use Node.js 22 locally to match CI, even though nothing currently enforces this (no `.nvmrc`, no `engines` field in `package.json`).
- Assumes npm as the sole package manager; no yarn/pnpm lockfiles exist or are supported.
- Assumes the actual git repository root is `heavy-rental-react-web-portal/` itself — the outer `/workspaces/heavy-rental-web-portal` wrapper directory is not a git repository.
- Assumes GitHub Actions' `secrets.GITHUB_TOKEN` is available in CI for GHCR image pushes; no secrets are required for local development.
- ~~Assumes no application environment variables are needed; nothing in the project reads `process.env` today~~ **Superseded 2026-08-06**: `vite.config.ts` now reads `VITE_API_TARGET` via `loadEnv` to select the dev-server proxy target per npm script (see FR-011). The mock API server itself still doesn't read `process.env` — it runs solely through the VS Code extension; only the frontend's build tooling does now.

## Out of Scope

- Full reproduction of each CI workflow's YAML — this spec summarizes triggers, jobs, and gates; the workflow files under `.github/workflows/` remain the source of truth for exact steps.
- Remediating the identified template-leftover documentation (`BLANK_README.md`'s generic boilerplate, `CHANGELOG.md`'s generic entries, `LICENSE.txt`'s carried-over copyright holder, duplicate/unused CSS files under `src/styles/`) — noted here as observations, not fixed by this spec.
- Adding a `test:api` / Playwright / Cypress suite — Vitest unit/component tests are in (FR-012 superseded 2026-08-13); end-to-end and mock-API contract tests remain out of this spec.
- Pinning a local Node version (`.nvmrc`/`engines`) — tracked as a gap, not implemented by this spec.

## Review & Acceptance Checklist

### Content Quality

- [x] Describes required environment/tooling characteristics, not narrative history
- [x] Focused on giving contributors and agents an accurate, actionable operational picture
- [x] Understandable by technical stakeholders (an environment spec is inherently technical)
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No open `[NEEDS CLARIFICATION]` markers remain
- [x] Requirements are testable and unambiguous (each FR maps to an observable command or CI outcome)
- [x] Success criteria are measurable (exact versions, script names, job names, environment variable names)
- [x] Scope is clearly bounded (see Out of Scope)
- [x] Dependencies and assumptions — including known gaps — are identified

## Change Log

- 2026-08-04: Initial specification written, documenting the project's runtime, package manager, build/lint tooling, styling setup, and the three CI/CD pipelines (fast-feedback, integration/CI, release), including known gaps (no Node version pin, no test runner configured).
- 2026-08-04: Removed the `mock:server` npm script and the `@r35007/mock-server` devDependency (high-severity `npm audit` finding, no non-breaking fix); the mock API server now runs only via the Thinker VS Code extension, with no environment-variable configuration. Updated FR-003 and FR-011 accordingly.
- 2026-08-06: Added `VITE_API_TARGET`, the first application-level environment variable in the project — `vite.config.ts` now reads it via `loadEnv` to pick the dev-server proxy target: `dev`/`dev:mock` → `.env.mock` (`http://127.0.0.1:4010`, the mock server, unchanged default), `dev:api` → `.env.api` (`http://localhost:8080`, a placeholder Spring Boot target). Further superseded FR-011 and the "no env vars" dependency/edge-case notes; updated FR-003's script list. See `Spec-frontend-api-integration.md` FR-002 for the corresponding change there.
- 2026-08-09: `.env.api`'s `VITE_API_TARGET` updated from `http://localhost:8080` to `http://heavy-rental-rest-api:8080` — a container-network hostname for the Spring Boot backend service, not a locally-run process. Further superseded FR-011's `dev:api` description accordingly. See `Spec-frontend-api-integration.md` FR-002 and `Spec-mock-api-server.md`'s Appendix for the matching updates.
- 2026-08-11: A second application-level environment variable added — `VITE_STRIPE_PUBLISHABLE_KEY` in `.env.api` (empty/placeholder; the real value is never committed, see `Spec-stripe-payment-checkout.md`), read by `src/app/stripe.ts` for the real-backend Stripe Elements checkout flow. Does not change FR-011's `VITE_API_TARGET` description.
- 2026-08-13: Added Vitest (`npm test` / `npm run test:watch`, jsdom + Testing Library). Superseded FR-012; FR-003 now lists `test` / `test:watch`. There is still no Playwright / `test:api` suite.
- 2026-08-13: Installed Playwright (`@playwright/test`, Chromium). Scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:install`. Specs live in `e2e/`; Vitest excludes that folder.
- 2026-08-20: Added an Edge Case noting that `npm run dev:api` requires Stripe webhook forwarding (`./scripts/dev-webhook-listen.sh` in the backend repo) running alongside it, or a deposit payment's effect on `Booking.status` silently never lands locally — prompted by a booking (RNT-0099) found stuck at `PENDING_DEPOSIT` in local dev due to exactly this. See `Spec-stripe-payment-checkout.md`'s 2026-08-20 Change Log entry for the corresponding backend-status update.
