# Feature Specification: Mock REST API Server

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-04
**Status**: Implemented
**Input**: "Set up a Mock API Server (Thinker Mock Server) in this project, with REST endpoints derived from the project's business-rule specification (`Spec-ui-heavy-machinery-portal.md`)."

## Overview

The portal has no live backend yet — the frontend runs entirely on local sample data, and business rules for the Singapore rental model (equipment catalog, booking model, deposits, rental plans, depots) exist only as UI behavior. This feature provides a local, HTTP-reachable **mock REST API** that mirrors those business rules, so frontend development and CI testing have a real API contract to work against ahead of an actual backend. It is built with the Thinker "Mock Server" VS Code extension (`@r35007/mock-server`), the tool already adopted for this project, and is wired to the project-local mock workspace at `/workspaces/heavy-rental-web-portal/heavy-rental-react-web-portal/mock`.

## Clarifications

### Session 2026-08-04

- Q: Should the mock server match the CI pipeline's existing `rest-endpoint-tests` contract (host/port/health route), or use the extension's own defaults? → A: Match the CI contract — `127.0.0.1:4010` with a `/health` route.
- Q: Should endpoints be bare resource paths or namespaced? → A: Namespace all resources under `/api`.
- Q: Should the mock expose only the spec's core business entities, or also the admin dashboard's analytics sample data? → A: Both — core entities plus analytics.
- Q: How should the Thinker VS Code extension know where to launch the mock server from? → A: The workspace is preconfigured so the extension uses the project-local mock root at `/workspaces/heavy-rental-web-portal/heavy-rental-react-web-portal/mock`, with the database file at `mock/db.json`. (Originally also had a custom `mock/server.cjs` entrypoint for an npm-invokable script; that script was removed 2026-08-04 for a security finding — see Change Log — leaving the VS Code extension as the sole launch path.)

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a frontend developer or a CI test job working on the heavy machinery rental portal, I need a local mock API that returns data shaped by the portal's real business rules, so I can build, exercise, and automatically test booking/rental-plan/equipment flows without depending on a live backend.

### Acceptance Scenarios

1. **Given** the mock server is running, **When** a client requests the equipment catalog, **Then** exactly the 4 approved equipment types are returned (Boom Lift, Scissors Lift, Fork Lift, Excavator) and no other category.
2. **Given** the mock server is running, **When** a client requests the depot list, **Then** exactly the 4 approved Singapore depots are returned (Jurong Port, Pioneer, Tuas, Marina South).
3. **Given** a booking references more than one equipment item, **When** the booking record is read, **Then** it exposes a single shared start date and end date and exactly one delivery event and one return event covering all referenced items.
4. **Given** a booking's total rental amount, **When** its deposit is read, **Then** the deposit equals 30% of the total, and the full-payment-due date is exactly 2 days before the delivery date.
5. **Given** a user already has an active rental plan, **When** the rental-plans data is queried, **Then** at most one plan per user is marked `active` (additional plans for that user are `completed`), reflecting that a new plan cannot be started while one is active.
6. **Given** the CI pipeline starts the mock server as part of `rest-endpoint-tests`, **When** it polls the health endpoint, **Then** the server responds successfully within the configured readiness timeout, allowing the job to proceed.
7. **Given** the admin dashboard needs utilization/status charts, **When** a client requests the analytics endpoints, **Then** monthly utilization and fleet status-distribution data are returned.

### Edge Cases

- What happens when the mock server process restarts? → All data resets to the seed state defined in the resource data file; there is no persistence across restarts.
- What happens when a client requests an unknown resource id? → The server returns a standard "not found" response rather than a server error.
- What happens when a required npm script is missing? → The CI `rest-endpoint-tests` job skips cleanly with an explicit "not ready" note instead of failing (this covers the period before this feature existed, and remains true for the still-missing test-suite side of that job).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ~~The mock server MUST expose a health-check endpoint that responds successfully independent of any other resource being loaded, so external tooling can detect readiness.~~ **Superseded 2026-08-04**: no dedicated health route exists now that the server is launched only via the Thinker VS Code extension (see Change Log). External tooling MUST instead detect readiness via any resource endpoint (e.g. `GET /api/equipment`).
- **FR-002**: The mock server MUST expose read and write endpoints for an equipment resource restricted to exactly the 4 approved types: Boom Lift, Scissors Lift, Fork Lift, Excavator.
- **FR-003**: The mock server MUST expose read and write endpoints for a depot resource restricted to exactly the 4 approved Singapore locations: Jurong Port, Pioneer, Tuas, Marina South.
- **FR-004**: The mock server MUST expose read and write endpoints for a user resource.
- **FR-005**: The mock server MUST expose read and write endpoints for a rental-plan resource, where each plan belongs to exactly one user and carries a status that distinguishes an active plan from a completed one.
- **FR-006**: The mock server MUST expose read and write endpoints for a booking resource, where each booking represents exactly one delivery event and one return event, and shares a single start/end date across every equipment item it references.
- **FR-007**: Every booking record MUST carry a deposit amount equal to 30% of its total rental amount.
- **FR-008**: Every booking record MUST carry a full-payment-due date equal to 2 days before its delivery date.
- **FR-009**: The mock server MUST expose read endpoints for the aggregate reporting data (monthly utilization and fleet status distribution) used by the admin dashboard.
- **FR-010**: The mock server's host and port MUST be configurable via environment variables and workspace settings, defaulting to `127.0.0.1:4010` to match the CI pipeline's existing expectations. In this workspace, the Thinker extension is configured to use the local mock root at `/workspaces/heavy-rental-web-portal/heavy-rental-react-web-portal/mock` and the database file at `mock/db.json`.
- **FR-011**: Every resource endpoint MUST support standard REST operations: list, get-by-id, create, replace, partial-update, and delete.
- **FR-012**: All resource endpoints MUST be reachable under a common `/api` path prefix.

### Key Entities

- **Equipment**: A rentable machine. Category is one of the 4 approved types; carries pricing (daily/weekly rate), capacity, current location, availability, and descriptive fields used for catalog display.
- **Depot**: A Singapore pickup/return location; one of the 4 approved sites.
- **User**: A portal account; associated with at most one active rental plan at a time.
- **Rental Plan**: A user's in-progress equipment selection prior to booking, referencing one or more equipment items that share a common rental window; a user may have only one plan `active` at a time.
- **Booking**: A finalized single-delivery/single-return transaction tied to one or more equipment items sharing one rental window, carrying deposit amount, deposit-paid status, and the full-payment deadline.
- **Analytics Snapshot**: Aggregate reporting series (monthly utilization, fleet status distribution) surfaced on the admin dashboard; read-mostly reference data rather than transactional data.

## Dependencies & Assumptions

- Assumes the Thinker "Mock Server" VS Code extension as the mocking tool, run only through the extension's UI — the `@r35007/mock-server` npm package is deliberately **not** a project dependency (see Change Log: removed for a high-severity `npm audit` finding with no non-breaking fix). This also means there is no npm-invokable script to start the server headlessly.
- Assumes the CI pipeline's `rest-endpoint-tests` job (`.github/workflows/integration-pipeline.yml`) as the eventual consumer of this server's host/port contract, once a `test:api`-family script and an npm-invokable mock-server script both exist; today that job has neither and stays in its documented placeholder/skip state regardless of this server's implementation.
- Assumes no live backend exists yet — this server is a stand-in, not an integration with a real datastore.
- Assumes the workspace-level VS Code settings for the Thinker extension are present so the "Mock it" action resolves to the project-local mock folder and `mock/db.json` instead of an external or default location.
- Seed values for equipment and admin analytics are assumed to stay consistent with the frontend's existing canonical sample data, so the mock API and the UI's local fallback data don't visibly diverge.

## Out of Scope

- Persistent storage beyond the mock server's in-memory copy of its seed data (no database, no disk writes on mutation).
- Authentication and authorization.
- A REST test suite exercising these endpoints (the CI job's test-script side remains unimplemented; the job stays in its placeholder/skip state until one is added).
- An OpenAPI/Swagger contract.
- Wiring the frontend (`src/App.tsx`, `src/app/*.tsx`) to actually call these endpoints — this feature only stands up the API surface.

## Appendix: Running Locally & Testing with Postman

### Start the server

Start the mock server from the **Thinker "Mock Server" VS Code extension** — there is no npm script for this (see Dependencies & Assumptions and the Change Log below for why). With the extension installed, use its "Mock it" command; the workspace's `.vscode/settings.json` and `.mockserverrc.cjs` are preconfigured to point it at the project-local mock root (`/workspaces/heavy-rental-web-portal/heavy-rental-react-web-portal/mock`) and `mock/db.json`, so it starts on `http://127.0.0.1:4010` with the `/api` base out of the box. Stop it via the same extension UI.

### Quick sanity check (curl)

Optional, before opening Postman:

```bash
curl http://127.0.0.1:4010/api/equipment
```

Note: the unprefixed `/health` route described elsewhere in this spec was custom middleware added by the now-removed npm-package wrapper script; the VS Code-extension-launched server does not serve it. Readiness checks (e.g. in CI) should fall back to a resource route like `/api/equipment` or the base URL instead.

### Testing with Postman (desktop)

1. Create a Postman **Environment** with one variable: `baseUrl` = `http://127.0.0.1:4010`.
2. Build requests against `{{baseUrl}}`, e.g.:

   | Method | URL                           | Notes                                                                                                                                                |
   | ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
   | GET    | `{{baseUrl}}/api/equipment`   | 4 items: Boom Lift, Scissors Lift, Fork Lift, Excavator                                                                                              |
   | GET    | `{{baseUrl}}/api/equipment/1` | Single item by id                                                                                                                                    |
   | GET    | `{{baseUrl}}/api/depots`      | 4 Singapore depots                                                                                                                                   |
   | GET    | `{{baseUrl}}/api/bookings`    | Sample bookings                                                                                                                                      |
   | POST   | `{{baseUrl}}/api/bookings`    | Body → raw/JSON, e.g. `{"rentalPlanId":1,"depotId":1,"equipmentIds":[2],"startDate":"2026-09-01","endDate":"2026-09-03","status":"pending-deposit"}` |
   | PATCH  | `{{baseUrl}}/api/bookings/1`  | Body → e.g. `{"status":"completed"}`                                                                                                                 |
   | DELETE | `{{baseUrl}}/api/bookings/1`  | Removes the record                                                                                                                                   |

   The same pattern applies to `/api/users`, `/api/rental-plans`, `/api/monthly-utilization`, and `/api/status-distribution` (see §3 Resources & Endpoints above for the full route table).

3. **Note**: all resources reset to the seed data in `mock/db.json` whenever the server restarts — POST/PATCH/DELETE changes only persist in memory while the process is running.

## Review & Acceptance Checklist

### Content Quality

- [x] Describes required behavior and contracts, not internal implementation mechanics
- [x] Focused on the value this API provides to frontend development and CI testing
- [x] Understandable by both technical and non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No open `[NEEDS CLARIFICATION]` markers remain — ambiguities were resolved in the Clarifications session above
- [x] Requirements are testable and unambiguous (each FR maps to an observable HTTP response)
- [x] Success criteria are measurable (exact counts, percentages, and date offsets are specified)
- [x] Scope is clearly bounded (see Out of Scope)
- [x] Dependencies and assumptions are identified

## Change Log

- 2026-08-04: Initial specification written, documenting the mock REST API server implemented for the portal (equipment, depots, users, rental plans, bookings, and admin analytics endpoints), aligned to the business rules in `Spec-ui-heavy-machinery-portal.md` and to the CI pipeline's `rest-endpoint-tests` contract.
- 2026-08-04: Added an appendix with local run instructions (`npm run mock:server`) and Postman desktop testing steps (environment variable setup, example request table).
- 2026-08-04: Updated the implementation notes to reflect the workspace-based Thinker mock-server configuration, including the project-local mock root at `/workspaces/heavy-rental-web-portal/heavy-rental-react-web-portal/mock` and the VS Code settings that point the extension at `mock/db.json`.
- 2026-08-04: Removed the `@r35007/mock-server` npm devDependency and `mock/server.cjs`/`npm run mock:server` — `npm audit --audit-level=high` flagged a high-severity SSRF advisory (GHSA-2p57-rm9w-gvfp, via a transitive `ip` dependency present in every package version ≥9.1.0) with no non-breaking fix available. The mock server is now started **only** via the Thinker VS Code extension's UI, using the unchanged `.mockserverrc.cjs`/`.vscode/settings.json` configuration. As a consequence, the custom `/health` route (previously added via the npm package's programmatic API) no longer exists; FR-001 and the Postman appendix were updated accordingly, and readiness checks should use a resource route (e.g. `/api/equipment`) instead.
