# Project Environment Specification

## Purpose

Runtime, package manager, scripts, and local tooling for the React web portal. Detailed narrative and history: `specification/Spec-project-environment.md`.

## Requirements

### Requirement: Node 22 and npm ci

Install and CI MUST use Node.js 22 and npm with the committed `package-lock.json`. CI installs with `npm ci`.

#### Scenario: CI install
- GIVEN a GitHub Actions reusable pipeline for this portal
- WHEN Integration Check or Fast Feedback Integration runs
- THEN `NODE_VERSION` is `"22"`
- AND dependencies are installed with `npm ci`

### Requirement: npm scripts

The project MUST provide npm scripts: `dev` and `dev:mock` (Vite mock proxy), `dev:api` (Vite API proxy), `build` (`tsc -b` then `vite build`), `lint`, `preview`, `test` / `test:watch` (Vitest), `test:e2e` / `test:e2e:ui` / `test:e2e:install` (Playwright). Playwright MAY be installed with no committed specs under `e2e/`. There MUST NOT be an npm script that starts the mock API server.

#### Scenario: Local mock development
- GIVEN a contributor has Node 22 and has run `npm install`
- WHEN they run `npm run dev`
- THEN Vite starts in mock mode and proxies to the mock API target from `.env.mock`
- AND the mock API process itself is started only via the Thinker VS Code extension

### Requirement: Vite proxy environment

Local Vite MUST select the backend via `VITE_API_TARGET` from `.env.mock` or `.env.api`. Stripe publishable key for real-backend checkout MUST be `VITE_STRIPE_PUBLISHABLE_KEY`. Secret keys (`sk_` / `whsec_`) MUST NOT be committed. A test publishable key (`pk_test_…`) MAY be committed in `.env.api`. Release MUST build with `--mode api`, inject GitHub Environment variable `vars.VITE_STRIPE_PUBLISHABLE_KEY`, and MUST NOT bake `.env.production` URL vars (or COPY that file into the nginx image).

#### Scenario: API mode hostname
- GIVEN `.env.api`
- WHEN a contributor runs `npm run dev:api`
- THEN the proxy target is the hostname in `VITE_API_TARGET` (container network `http://heavy-rental-rest-api:8080`, not a documented `localhost:8080` default)

#### Scenario: Production bake
- GIVEN Release packaging
- WHEN `vite build --mode api` runs
- THEN `import.meta.env.MODE` is `"api"`
- AND `VITE_API_TARGET` is not baked as `http://heavy-rental-rest-api:8080`
- AND Stripe uses `vars.VITE_STRIPE_PUBLISHABLE_KEY`
