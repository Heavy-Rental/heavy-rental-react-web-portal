# Feature Specification: Project Environment

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-04
**Status**: Implemented
**Input**: "Document the project's development/runtime environment, tooling, and CI/CD pipelines as a specification, referencing the structure of the existing specifications in this project."

## Overview

The `specification/` folder documents business rules (`Spec-ui-heavy-machinery-portal.md`) and the mock REST API (`Spec-mock-api-server.md`). This specification is the environment/tooling SDD: runtime, package manager, build/lint, and delivery pipelines. Living OpenSpec contracts for the same facts are `openspec/specs/project-environment`, `ci-pipelines`, and `portal-cd`. Durable why is `adr/` (walk `Supersedes:`; in force: ADR-0001, 0002, 0003, 0005, 0006; ADR-0004 is historical). If this file disagrees with `.github/workflows/`, the YAML wins and this file MUST be updated in the same change.

## User Scenarios & Testing *(mandatory)*

### Primary User Story

As a contributor or AI coding agent working on this project, I need an accurate environment SDD (this file) plus the OpenSpec `project-environment` / `ci-pipelines` / `portal-cd` capabilities, so I can set up locally the same way CI will and understand Fast Feedback, Integration, Release, Security Report, and Academy/paid CD after a change is pushed.

### Acceptance Scenarios

1. **Given** a fresh clone of the repository, **When** a contributor runs `npm install` followed by `npm run dev`, **Then** the Vite dev server starts and serves the app locally.
2. **Given** a contributor wants to validate a change before pushing, **When** they run `npm run lint` and `npx tsc -b`, **Then** they get the same quality signal that CI's Quality Control job produces.
3. **Given** a pull request targeting the `develop` branch, **When** `portal-ci-caller.yml` triggers `integration-pipeline.yml`, **Then** Integration Check (highest priority; reuses a successful Fast Feedback run for the PR head SHA when one exists), Quality Control, Security Testing, CodeQL Analysis, and REST Endpoint Tests all run, and the GitHub Flow CI Gate only passes if every one of them succeeds.
4. **Given** a push to any branch other than `master` or `develop`, **When** `portal-fast-feedback-caller.yml` triggers, **Then** only a lightweight Integration check runs (checkout, dependency install, install verification) — no lint, security scan, or tests. CI MUST NOT `uses:` Fast Feedback on pull_request.
5. **Given** an operator runs Actions → Release → Run workflow (`portal-release-caller.yml` is `workflow_dispatch` only), **When** `release-pipeline.yml` runs, **Then** it checks out `master`, packages `vite build --mode api` into nginx, runs DAST, publishes public GHCR `heavy_rental_web_portal:<semver>` and `:latest`, and **creates** the GitHub Release. It does **not** trigger on `on: release` or on a develop→master pull request.
6. **Given** a contributor wants to exercise the REST API locally, **When** they start the mock server via the Thinker "Mock Server" VS Code extension, **Then** a local mock API starts on `127.0.0.1:4010`, matching `Spec-mock-api-server.md`. (There is deliberately no npm script for this — see FR-003 and the Change Log.)
7. **Given** an operator dispatches Web Portal CD (Academy) or Web Portal CD (paid), **When** `web-portal-cd-academy.yml` runs, **Then** it authenticates with `resolve-aws-profile`, composes the portal on `asg-portal` for `deploy` / `configure-only`, and job `Health GET /` SSM-curls `http://127.0.0.1/` (200/301/302). Paid CD MUST NOT use `secrets: inherit` (OIDC; ADR-0006). CD MUST NOT modify ALB target-group health-check settings (ADR-0005).
8. **Given** Monday 08:00 UTC or a manual Security Report dispatch, **When** `portal-security-report-caller.yml` runs, **Then** existing Code Scanning alerts are summarized; no new Semgrep/npm audit/Trivy/CodeQL scan runs.

### Edge Cases

- What happens if a contributor's local Node.js version differs from the version CI uses? Nothing enforces alignment locally — there is no `.nvmrc` and no `engines` field in `package.json`; this is a known gap (see Requirements).
- What happens if a future feature needs environment variables? ~~None exist today for the app itself~~ **Superseded 2026-08-06**: one now does — `VITE_API_TARGET` (see FR-011), read by `vite.config.ts` via `.env.mock`/`.env.api`, selecting the Vite dev-server proxy destination. The mock server itself still doesn't read `process.env` (it runs only via the VS Code extension, configured through `.vscode/settings.json`/`.mockserverrc.cjs`).
- What happens when `rest-endpoint-tests` runs before a test script exists? It takes a documented "not ready" placeholder path and passes green with an explanatory summary, rather than failing or silently skipping.
- What happens if a contributor runs `npm run dev:api` locally without Stripe webhook delivery reaching the backend? **New 2026-08-20.** The deposit payment itself still succeeds (Stripe confirms client-side), but the backend's `PaymentWebhookService` never runs, so `Booking.status` silently never leaves `PENDING_DEPOSIT` (see `Spec-stripe-payment-checkout.md` FR-008/Dependencies). Locally this requires Stripe webhook forwarding to be running against the backend alongside `npm run dev:api`; the `heavy-rental-spring-rest-api` repo provides `./scripts/dev-webhook-listen.sh` for this (run in its own terminal, uses the shared team Stripe test key — no personal Stripe login needed). This script lives in the backend repo, not here, so its exact behavior isn't independently verified from this repo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST target Node.js 22 for install and build steps, as pinned by `NODE_VERSION: "22"` in every CI workflow.
- **FR-002**: The project MUST use npm as its package manager, governed by the committed `package-lock.json` (lockfileVersion 3); CI installs via `npm ci`.
- **FR-003**: The project MUST provide npm scripts for: starting the dev server against the mock API (`dev`, `dev:mock`) or against the Spring Boot backend (`dev:api`, `VITE_API_TARGET=http://heavy-rental-rest-api:8080`), producing a production build (`build`), linting (`lint`), previewing a production build (`preview`), running the unit/component suite (`test` = `vitest run`, `test:watch` = `vitest`), and running Playwright E2E (`test:e2e`, `test:e2e:ui`, `test:e2e:install`). Playwright is installed and configured (`playwright.config.ts`); there are currently **no committed specs under `e2e/`**. `dev`/`dev:mock`/`dev:api` only choose which backend the Vite dev-server proxy targets (see FR-011) — there is still deliberately **no** npm script for the mock API server itself, which is started only via the Thinker VS Code extension's UI (**Mock Server: Start / Restart Server**), since the underlying npm package was removed for a high-severity `npm audit` finding with no non-breaking fix (see `Spec-mock-api-server.md`'s Change Log).
- **FR-004**: The production build MUST perform a TypeScript project build (`tsc -b`, using the composite `tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json` structure) before bundling with `vite build`.
- **FR-005**: Linting MUST run via ESLint's flat config (`eslint.config.js`), applying JS-recommended, `typescript-eslint`-recommended, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh` rule sets to all `**/*.{ts,tsx}` files, excluding `dist`.
- **FR-006**: Styling MUST be provided by Tailwind CSS v4 through the `@tailwindcss/vite` plugin, with no separate PostCSS or `tailwind.config` file required.
- **FR-007**: Every pull request targeting `develop` MUST pass all of: Integration Check, Quality Control (lint + typecheck), Security Testing (SAST, dependency audit, filesystem vulnerability scan), CodeQL Analysis, and REST Endpoint Tests, aggregated by a GitHub Flow CI Gate job that fails if any one of them does not succeed. Integration Check MUST reuse a successful Fast Feedback run for the PR head SHA when one exists, and MUST NOT invoke `fast-feedback-pipeline.yml` from `portal-ci-caller.yml`.
- **FR-008**: Security Testing MUST produce SARIF 2.1.0 reports (Semgrep SAST, `npm audit` SCA, Trivy filesystem scan), upload them to GitHub Code Scanning, and fail the pipeline on ERROR/CRITICAL-severity findings. A human-readable `combined-security-report.pdf` is an additional artifact, not a replacement for SARIF.
- **FR-009**: Pushes to any branch other than `master` or `develop` MUST trigger only a lightweight, Integration-only fast-feedback pipeline (`portal-fast-feedback-caller.yml` → `fast-feedback-pipeline.yml`).
- **FR-010**: ~~A published release, or a pull request from `develop` into `master`, MUST trigger a packaging pipeline…~~ **Superseded 2026-08-27**: Release is `workflow_dispatch` only (`portal-release-caller.yml` → `release-pipeline.yml`). It checks out `master`, runs Integration + QC, packages `vite build --mode api` into nginx, runs DAST (`combined-dast-report.pdf`), then Publish pushes public GHCR `heavy_rental_web_portal:<semver>` + `:latest` and **creates** the GitHub Release. It MUST NOT use `on: release` and MUST NOT run on develop→master pull requests.
- **FR-011**: ~~The local mock REST API server MUST be configurable via `MOCK_API_HOST` and `MOCK_API_PORT` environment variables~~ **Superseded 2026-08-04**: the mock server (VS Code extension only) does not read environment variables — its host/port are fixed by `.vscode/settings.json`/`.mockserverrc.cjs` at `127.0.0.1:4010`, matching CI's expected values by convention, not by env-var injection. CI's `MOCK_API_BASE_URL`/`MOCK_API_HEALTH_PATH`/`MOCK_API_READY_TIMEOUT_SECONDS` remain the readiness-polling contract those CI workflow env vars define, for whenever an npm-invokable mock-server script and a `test:api`-family script both exist (neither does today — see FR-012 and `Spec-mock-api-server.md`). **Further superseded 2026-08-06**: the paragraph above is still accurate for the mock server itself, but the *frontend's* Vite dev-server proxy now does read an environment variable — `VITE_API_TARGET`, set per npm script via `.env.mock` (`http://127.0.0.1:4010`, this mock server) or `.env.api` (originally `http://localhost:8080`, a placeholder Spring Boot target; see next update) and consumed in `vite.config.ts` via `loadEnv`. This only selects the proxy destination; it does not give the mock server itself env-var configuration. See `Spec-frontend-api-integration.md` FR-002 and `Spec-mock-api-server.md`'s Appendix. **Further superseded 2026-08-09**: `.env.api`'s `VITE_API_TARGET` value changed from `http://localhost:8080` to `http://heavy-rental-rest-api:8080` — a resolvable container-network hostname for the Spring Boot backend service, not a locally-run process on `localhost`. Running `npm run dev:api` now requires that hostname to resolve (e.g. via Docker Compose), not a bare `localhost:8080` process. See `Spec-frontend-api-integration.md` FR-002 and `Spec-mock-api-server.md`'s Appendix for the matching update.
- **FR-012**: ~~No automated test runner is currently configured…~~ **Superseded 2026-08-13**: Vitest is the unit/component runner (`npm test` / `npm run test:watch`, `jsdom`, Testing Library, setup in `src/test/setup.ts`). Playwright (`@playwright/test`) is installed for browser E2E (`npm run test:e2e`, Chromium, `playwright.config.ts`). **There are no committed Playwright specs in `e2e/` yet**; CI Quality Control does not run Playwright or Vitest. There is still no `test:api` / Cypress suite.
- **FR-013**: Reusable Fast Feedback, Integration, and Release workflows MUST set `DEFAULT_APP_REPOSITORY` to `Heavy-Rental/heavy-rental-react-web-portal` (ADR-0002). Same-repo callers still check out `github.repository` @ `github.sha`.
- **FR-014**: Portal CD MUST use two callers — Academy (`academy` + Vocareum keys as dispatch inputs) and paid (`AWS_ACTUAL` + OIDC) — both calling `web-portal-cd-academy.yml` via `.github/actions/resolve-aws-profile` (ADR-0003). Paid CD MUST NOT pass `secrets: inherit` (ADR-0006, supersedes ADR-0004). Copy comments MUST NOT instruct operators to install `resolve-vocareum-aws` for portal CD.
- **FR-015**: Portal CD job `Health GET /` MUST SSM-curl `http://127.0.0.1/` on InService + SSM Online `asg-portal` guests and succeed on HTTP 200/301/302 from at least one guest. REST `/api` MUST NOT be a CD health gate. This repository MUST NOT treat ALB target-group health-check configuration as a portal CD responsibility (ADR-0005).
- **FR-016**: `portal-security-report-caller.yml` MUST summarize existing Code Scanning alerts (weekly Monday 08:00 UTC and `workflow_dispatch`) and MUST NOT run new scans.
- **FR-017**: Documentation MUST follow OpenSpec `spec-driven-with-adr`, OpenSPDD REASONS Canvas, and MADR-short ADRs (ADR-0001). See `openspec/config.yaml`, `adr/README.md` (walk `Supersedes:`; ADR-0006 is in force for paid secrets), `spdd/README.md` (in-force canvas), and `specification/README.md`.
- **FR-018**: Release packaging MUST run `vite build --mode api` so `import.meta.env.MODE === "api"`. It MUST seed/scan `.env.production` (empty `VITE_*` URL vars so the SPA does not bake `http://heavy-rental-rest-api:8080` or a Haystack URL) and MUST inject GitHub Environment variable `vars.VITE_STRIPE_PUBLISHABLE_KEY`. Portal CD MUST NOT COPY `.env.production` into the nginx image (nginx does not read it; comments on that file that cited a non-existent "ADR-0007" mean this rule).

### Key Entities / Components

- **Runtime stack**: Node.js 22, npm, React 19.2, TypeScript ~6.0, Vite 8.2, Tailwind CSS v4.
- **Build configuration**: `vite.config.ts` (React + Tailwind plugins, `@` → `./src` alias), TypeScript project references (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`), ESLint flat config (`eslint.config.js`).
- **CI/CD pipeline set**: four quality/report caller → reusable pairs — Fast Feedback, Integration CI, Release, Security Report — each reusable workflow restricted to its designated `portal-*-caller.yml` via `assert-caller`. Plus two portal CD callers (Academy, paid) sharing `web-portal-cd-academy.yml`. None of the quality pipelines deploy to AWS.
- **Mock API tooling**: Thinker "Mock Server" VS Code extension, `mock/db.json`, `.mockserverrc.cjs` (see `Spec-mock-api-server.md`). Not an npm devDependency — see FR-003.
- **Env files**: `.env.mock` (`VITE_API_TARGET=http://127.0.0.1:4010`), `.env.api` (`VITE_API_TARGET=http://heavy-rental-rest-api:8080` plus optional test `VITE_STRIPE_PUBLISHABLE_KEY`), `.env.production` (Release bake profile; empty URL vars; not copied into the nginx image).
- **Documentation set**: OpenSpec (`openspec/specs/`, schema `spec-driven-with-adr`), OpenSPDD (`spdd/`), MADR ADRs (`adr/`), this `specification/` tree (product SDD), `README.md`. `CHANGELOG.md` is a short portal log (feature history stays in spec Change Logs). Template leftover: `BLANK_README.md` (not the project README).

## Dependencies & Assumptions

- Assumes contributors use Node.js 22 locally to match CI, even though nothing currently enforces this (no `.nvmrc`, no `engines` field in `package.json`).
- Assumes npm as the sole package manager; no yarn/pnpm lockfiles exist or are supported.
- Assumes the actual git repository root is `heavy-rental-react-web-portal/` itself — the outer `/workspaces/heavy-rental-web-portal` wrapper directory is not a git repository.
- Assumes GitHub Actions' `secrets.GITHUB_TOKEN` is available in CI for GHCR image pushes; no secrets are required for local development. Paid portal CD MUST NOT inherit repository secrets; OIDC uses `vars.AWS_ROLE_TO_ASSUME`, and the caller refuses Vocareum keys on `AWS_ACTUAL`. Academy CD passes keys as workflow_dispatch inputs.
- Assumes the canonical GitHub repository is `Heavy-Rental/heavy-rental-react-web-portal` (ADR-0002).
- ~~Assumes no application environment variables are needed; nothing in the project reads `process.env` today~~ **Superseded 2026-08-06**: `vite.config.ts` now reads `VITE_API_TARGET` via `loadEnv` to select the dev-server proxy target per npm script (see FR-011). The mock API server itself still doesn't read `process.env` — it runs solely through the VS Code extension; only the frontend's build tooling does now.

## Out of Scope

- Full reproduction of each CI workflow's YAML — this spec summarizes triggers, jobs, and gates; the workflow files under `.github/workflows/` remain the source of truth for exact steps. OpenSpec `ci-pipelines` and `portal-cd` are the living behavior contracts; this file is the SDD narrative.
- Configuring ALB target-group health checks (path, matcher, interval) — infra CD, not this repository (ADR-0005).
- Remediating remaining template leftovers (`BLANK_README.md`, `LICENSE.txt` copyright holder, duplicate/unused CSS files under `src/styles/`) — noted here as observations. `CHANGELOG.md` is no longer the generic template.
- Adding a `test:api` / Cypress suite — Vitest and Playwright E2E are in (FR-012 superseded 2026-08-13); mock-API contract tests remain out of this spec.
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
- 2026-08-27 (HR-239): Aligned this SDD with live workflows and the OpenSpec/OpenSPDD/ADR stack. Superseded FR-010 (Release is manual `workflow_dispatch`, not GitHub Release / develop→master PR). Added FR-013–FR-017 (canonical `Heavy-Rental/...` default repo, Academy/paid CD + `resolve-aws-profile`, guest `GET /` health vs ALB TG, Security Report, documentation standard). Pipeline set is no longer “three caller pairs”. **Same-day correction:** the first draft of this bullet said paid CD uses `secrets: inherit`; that is **not** current — see the next entry and ADR-0006.
- 2026-08-27 (HR-239): FR-014 updated — paid CD MUST NOT use `secrets: inherit` so Semgrep `yaml.github-actions.security.secrets-inherit` stays clean; OIDC + caller `refuse-non-paid` remain the security controls (ADR-0006 supersedes ADR-0004).
- 2026-08-30: Docs alignment. Overview ADR range includes ADR-0006. FR-003: `dev:api` is the real Spring target, not a placeholder; Playwright has no committed `e2e/` specs. FR-018: `.env.production` + Release `--mode api` + Environment var `VITE_STRIPE_PUBLISHABLE_KEY`; do not COPY that file into the nginx image. `CHANGELOG.md` no longer treated as generic leftover.
