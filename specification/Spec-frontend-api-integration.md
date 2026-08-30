# Feature Specification: Frontend API Integration

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-04
**Status**: Implemented
**Input**: "Referencing the specification folder, implement the wiring for the relevant features in this project to consume the REST endpoints of the mock API server" — followed by "I intend to use only Thinker.mock-server for api mock server; I need to uninstall `node_modules/@r35007/mock-server` because there is a security issue," addressed as a prerequisite of this same feature.

## Overview

`Spec-mock-api-server.md` stood up a mock REST API but explicitly listed "wiring the frontend to actually call these endpoints" as Out of Scope. Until this feature, the portal ran on **four separate hardcoded, mismatched data sources**: a stale 6-item, US-located equipment catalog duplicated independently in `src/App.tsx`, `src/app/AdminDashboard.tsx`, and `src/app/CustomerOnboarding.tsx` (Excavator/Crane/Bulldozer/Forklift/Boom Lift, Houston/Dallas/Austin/San Antonio) — none of which satisfied `Spec-ui-heavy-machinery-portal.md`'s "4 approved types, Singapore only" rule — plus a fourth, unused 4-item Singapore-aligned copy sitting dead in `src/app/shared.ts` (zero importers). Users, rental plans, and bookings were similarly duplicated with denormalized, ad hoc shapes that didn't match the mock API's normalized resources.

This feature replaces all of that with one consolidated API client layer and wires every page that previously read hardcoded data to fetch it live from the mock server instead, including persisting user-driven mutations (checkout, admin CRUD) back to the API. Fixing the catalog to the spec-compliant 4-item Singapore set fell out of this migration naturally, since the API's seed data is now the single source of truth. Along the way, `@r35007/mock-server` was found to pull in a vulnerable transitive dependency with no non-breaking fix; it was removed as a project dependency, and the mock server now runs exclusively through the Thinker "Mock Server" VS Code extension (tracked in `Spec-mock-api-server.md`'s and `Spec-project-environment.md`'s own Change Logs — referenced here only as it affects how the frontend reaches the server).

## Clarifications

### Session 2026-08-04

- Q: Wire every resource end-to-end, or just a read-only catalog? → A: Full scope — equipment, depots, users, rental plans, bookings, and analytics, across the customer portal, onboarding flow, and admin dashboard.
- Q: Should customer/admin actions persist to the API, or just seed initial reads from it? → A: Persist. Checkout and admin CRUD call POST/PATCH/DELETE against the mock server, not just client-local state.
- Q: How should the frontend reach the mock server at `127.0.0.1:4010`? → A: A Vite dev-server proxy (`/api` → `http://127.0.0.1:4010`) in `vite.config.ts`, so the app fetches relative `/api/...` paths — no CORS handling, no hardcoded host, no environment variables.
- Q: Keep the duplicated per-file data arrays, or consolidate? → A: Consolidate into one API layer (`src/app/types.ts`, `src/app/api.ts`); delete the dead `src/app/shared.ts` and every duplicated `EQUIPMENT_LIST`/`MONTHLY_UTILIZATION`/`STATUS_DIST`/`MOCK_USERS`/`MOCK_BOOKINGS` array.
- Q: The demo login accounts (`john@company.com`, `sarah@company.com`) don't match any seed user's email in `mock/db.json`, so no real `userId` could be resolved at login — how to fix? → A: Remap `ACCOUNTS` to the seed users' real emails (`alex.tan@example.sg` → customer, `ravi.kumar@example.sg` → admin) and resolve the matching numeric id via `userApi.list()` at login time. **Current location:** `src/features/auth/accounts.ts` (not `App.tsx`).
- Q: A booking needs one shared start/end date across all its equipment, but the cart lets each item pick its own range — enforce via a cart UX rework, or normalize at checkout? → A: Normalize at checkout to the widest covering range (earliest start / latest end), via `cartDateRange()`.
- Q: A booking needs one `depotId`, but cart items only carry an equipment `location` string — add a depot picker, or derive it? → A: Derive `depotId` from the cart's equipment locations via `resolveCartDepotId()`, requiring every item resolve to the same depot; throw a clear error otherwise.
- Q: The UI's booking-status vocabulary (`Confirmed`/`Pending`/`Completed`/`Cancelled`) didn't match the API's (`pending-deposit`/`deposit-paid`/`completed`/`cancelled`) — which wins? → A: Adopt the API's vocabulary everywhere in the admin UI (`BOOKING_STATUSES`, `formatBookingStatus()`).
- Q: `@r35007/mock-server` (the npm package underlying the VS Code extension) was flagged by `npm audit --audit-level=high` for a transitive `ip` package SSRF advisory (GHSA-2p57-rm9w-gvfp) present in every version ≥9.1.0, with no non-breaking fix. Keep it as a devDependency, or remove it? → A: Uninstall it; the mock server runs only via the VS Code extension going forward (see `Spec-mock-api-server.md` Change Log). The frontend is unaffected — it always talked to the server over HTTP through the Vite proxy, never through the npm package directly.

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a customer, employee, or admin using the heavy machinery rental portal, I see real data served by the mock API — equipment, depots, rental plans, bookings, and fleet analytics — instead of hardcoded sample arrays, and the actions I take (booking equipment, managing users, updating a booking's status) are persisted to the mock server for the rest of the session.

### Acceptance Scenarios

1. **Given** the mock server is running, **When** any page that lists equipment loads (home page, onboarding, customer catalog, employee dashboard, admin asset records), **Then** it shows exactly the API's 4 items (Boom Lift, Scissors Lift, Fork Lift, Excavator) — no Crane, Bulldozer, or other non-approved category ever appears.
2. **Given** a customer has items in their cart with different date ranges but equipment from the same depot, **When** they complete checkout, **Then** the created booking's `startDate`/`endDate` cover the earliest start through the latest end across all cart items, `depositAmount` equals 30% of `totalAmount`, and `fullPaymentDueDate` is exactly 2 days before `deliveryDate`.
3. **Given** a customer's cart contains equipment located at more than one depot, **When** they attempt checkout, **Then** it fails with a clear inline error instead of creating an inconsistent booking.
4. **Given** a customer logs in with a demo account, **When** the login completes, **Then** the app resolves that account's real numeric `userId` via the API and "My Rental Plans" shows only that user's actual rental plans and bookings.
5. **Given** an admin edits a user, deletes an asset, or changes a booking's status, **When** the action completes, **Then** the corresponding API call (`PATCH`/`DELETE`/`POST`) has been made, and the change is visible after a page reload for as long as the mock server keeps running.
6. **Given** the mock server is unreachable, **When** a page that depends on it loads, **Then** the page shows a loading spinner while the request is in flight and a readable error message on failure — never a blank screen or an unhandled exception.
7. **Given** the admin pricing tab's "Apply" or "Apply All" action is used, **When** it completes, **Then** the affected equipment's `daily`/`weekly` rates are updated via the API, not just in local component state.

### Edge Cases

- What happens if a user's demo-login email has no matching record in `/api/users`? → Checkout is blocked with an explicit error ("You must be signed in with a linked account to book equipment") rather than silently creating an orphaned booking.
- What happens if the mock server restarts mid-session? → All prior writes are lost (the mock server itself has no persistence — see `Spec-mock-api-server.md`); the next read reflects the reset seed data. This is expected, not a bug in the wiring.
- What happens to fields the UI displays but the API doesn't model (asset maintenance dates/condition/photo, fleet deployment/lifecycle status, pricing floor/ceiling bounds, day-level equipment availability)? → They remain client-local, deterministically derived or synthesized, and are never sent to the API.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The frontend MUST fetch equipment, depots, users, rental plans, bookings, and analytics (monthly utilization, status distribution) from the mock API rather than hardcoded arrays, via a single shared client module (`src/app/api.ts`).
- **FR-002**: ~~All API requests MUST be routed through a Vite dev-server proxy (`/api` → `http://127.0.0.1:4010`, `vite.config.ts`) using relative paths — no absolute URLs, no environment variables, no CORS workarounds.~~ **Superseded 2026-08-06**: API requests still route through relative `/api` paths via the Vite dev-server proxy — no absolute URLs, no CORS workarounds — but the proxy's *target* is now environment-variable-driven instead of hardcoded. `vite.config.ts` reads `VITE_API_TARGET` (via `loadEnv`), set per npm script: `dev`/`dev:mock` → `.env.mock` (`http://127.0.0.1:4010`, the mock server, same as before this change) or `dev:api` → `.env.api` (originally `http://localhost:8080`, a placeholder Spring Boot target; see next update). `src/app/api.ts`'s `BASE = "/api"` is unchanged. See `Spec-project-environment.md` FR-011. **Further superseded 2026-08-09**: `.env.api`'s `VITE_API_TARGET` changed from `http://localhost:8080` to `http://heavy-rental-rest-api:8080` — a container-network hostname for the Spring Boot backend, not a locally-run process. `dev:api` now requires that hostname to resolve (e.g. via Docker Compose), not `localhost`.
- **FR-003**: The API client MUST use native `fetch` with no new HTTP-client dependency (no axios, no react-query), exposing typed `list`/`get`/`create`/`replace`/`update`/`remove` functions per resource.
- **FR-004**: Every component reading API-backed data MUST render an explicit loading state and an explicit error state (via the shared `useApiResource` hook, `src/app/useApiResource.ts`) rather than rendering with empty/undefined data or crashing.
- **FR-005**: Checkout MUST normalize a multi-item cart to one shared `startDate`/`endDate` (earliest start, latest end) before creating a booking, per `Spec-ui-heavy-machinery-portal.md` §4.3.
- **FR-006**: Checkout MUST derive the booking's `depotId` from the cart's equipment locations and MUST reject checkout with a clear error if cart items resolve to more than one depot.
- **FR-007**: Checkout MUST compute `depositAmount` as 30% of `totalAmount` and `fullPaymentDueDate` as exactly 2 days before `deliveryDate`, using the shared `calcDeposit`/`calcFullPaymentDueDate` helpers in `src/app/api.ts` — no duplicated calculation logic.
- **FR-008**: Login MUST resolve a real numeric `userId` by matching the authenticated demo account's email against `GET /api/users`, and MUST carry that id through to any screen that creates or lists a user's rental plans/bookings.
- **FR-009**: Admin user management (add/edit/delete), booking status changes, and asset/equipment create/update/delete MUST call the corresponding mock API endpoint and only update local UI state after that call succeeds (or roll back / show an error on failure).
- **FR-010**: ~~The admin pricing tab's recommendation-apply actions MUST persist updated `daily`/`weekly` rates to `/api/equipment` for every equipment item they affect.~~ **Superseded**: the admin Pricing tab was removed (`Spec-admin-dashboard-api-mode-fixes.md`). Rate fields live on `Asset` and are edited via Asset Records (`assetApi` → `/api/assets`).
- **FR-011**: Booking status values displayed and settable in the admin UI MUST use the live enum (`PENDING_DEPOSIT`, `PENDING_CONFIRMED`, `CONFIRMED`, `MOBILISED`, `COMPLETED`, `CANCELLED`) — not the historical kebab-case mock vocabulary (`pending-deposit` / `deposit-paid`).
- **FR-012**: Fields and features with no corresponding API resource (asset maintenance metadata, fleet deployment/lifecycle tracking, pricing floor/ceiling rules, day-level equipment availability calendar) MUST remain client-local and MUST NOT be silently or partially persisted to the API.
- **FR-013**: The duplicated per-file hardcoded data arrays (`EQUIPMENT_LIST`, `MONTHLY_UTILIZATION`, `STATUS_DIST`, `MOCK_USERS`, `MOCK_BOOKINGS`) and the dead `src/app/shared.ts` module MUST be removed once every consumer is wired to the API client.

### Key Entities / Components

- **`src/app/types.ts`**: Shared TypeScript types mirroring `mock/db.json` field-for-field (`Equipment`, `Depot`, `User`, `RentalPlan`, `RentalPlanItem`, `Booking`, `BookingStatus`, `MonthlyUtilization`, `StatusDistribution`), plus shared UI vocabulary (`Role`, `View`, `OnboardingMode`).
- **`src/app/api.ts`**: The `fetch`-based API client — a generic `resource<T>()` factory producing full CRUD functions per writable resource, a `readOnlyResource<T>()` factory for the two analytics endpoints, and the business-rule helpers `DEPOSIT_RATE`, `calcDeposit()`, `calcFullPaymentDueDate()`.
- **`src/app/useApiResource.ts`**: A dependency-free hook returning `{status, data, error, reload}` for any `fetch`-returning function, used for every read across the app; the only prior async pattern in the codebase was one unrelated scroll effect.
- **`src/app/assetRecord.ts`**: Shared `AssetRecord` type and `deriveAssetRecord()` helper, deduplicating logic that `AdminDashboard.tsx` and `App.tsx`'s `EmployeeDashboard` previously each implemented independently for synthesizing maintenance-tracking fields on top of `Equipment`.
- **`vite.config.ts`**: `server.proxy` entry routing `/api` to the mock server.
- **View-model builders** (`App.tsx`: `buildRentalPlanViews`, `cartDateRange`, `resolveCartDepotId`; `AdminDashboard.tsx`: `buildUserRows`, `buildBookingRows`): pure functions joining normalized API resources (rental plans, bookings, users, equipment) into the denormalized shapes the existing UI components render, without changing that UI code's structure.

## Dependencies & Assumptions

- Assumes the mock server (per `Spec-mock-api-server.md`) is reachable at `127.0.0.1:4010`, started via the Thinker "Mock Server" VS Code extension — the frontend has no offline fallback and no local data if the server isn't running.
- Assumes the demo login accounts in `src/features/auth/accounts.ts` stay in sync with `mock/db.json`'s seed users by email; adding or renaming seed users requires updating `ACCOUNTS` to match.
- Assumes fields with no API equivalent (fleet deployment/lifecycle tracking, pricing floor/ceiling rules, the day-level availability calendar) are acceptable as permanently client-local/synthetic rather than a gap to close later. Asset `condition` / `serialno` / photos are now backend-owned (`Spec-admin-asset-records.md`).
- Assumes the Vite **dev-server** proxy is development-time-only. Production Release builds with `--mode api`; the deployed nginx guest proxies `/api` to the REST ALB (`Spec-project-environment.md` FR-018) — there **is** a live backend for deployed builds.
- Assumes booking mutations made through the UI in mock mode are best-effort against the mock server's in-memory store — consistent with `Spec-mock-api-server.md`'s "no persistence across restarts" behavior, not a regression introduced here.

## Out of Scope

- Persisting the fields identified above as having no API resource (fleet deployment/lifecycle tracking, asset maintenance records, pricing floor/ceiling rules, day-level availability calendar) — these remain synthetic by design.
- Authentication and session security beyond the existing local demo-account login gate **in mock mode**; the mock API itself has no auth (per `Spec-mock-api-server.md`). API-mode auth is `Spec-frontend-authentication.md` FR-011.
- A `test:api` contract suite against the mock server — Vitest covers the API client helpers; there is still no Cypress / REST-script suite (`Spec-project-environment.md` FR-012).
- Enforcing "one active rental plan per user" at the **mock** write layer — the mock server accepts any rental-plan creation. API mode enforces it server-side (`409` on a second active plan). The frontend also blocks new-plan checkout/onboarding when an active plan exists.

## Review & Acceptance Checklist

### Content Quality

- [x] Describes required behavior and contracts, not internal implementation mechanics
- [x] Focused on the value this integration provides to end users of each role (customer, employee, admin)
- [x] Understandable by both technical and non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No open `[NEEDS CLARIFICATION]` markers remain — ambiguities were resolved in the Clarifications session above
- [x] Requirements are testable and unambiguous (each FR maps to an observable UI behavior or API call)
- [x] Success criteria are measurable (exact percentages, date offsets, and resource counts are specified)
- [x] Scope is clearly bounded (see Out of Scope)
- [x] Dependencies and assumptions are identified

## Change Log

- 2026-08-04: Initial specification written, documenting the frontend's migration from four hardcoded/duplicated sample-data sources to a single API client layer (`types.ts`, `api.ts`, `useApiResource.ts`, `assetRecord.ts`) wired against `Spec-mock-api-server.md`'s mock REST API, across the customer portal, onboarding flow, and admin dashboard, including the business-rule decisions (shared-date normalization, depot derivation, deposit/full-payment calculation, unified booking-status vocabulary, login-to-userId resolution) made along the way.
- 2026-08-04: `Spec-frontend-authentication.md` added a client-simulated bearer-token session (3600s TTL, sessionStorage-persisted, `Authorization` header injection in `api.ts`) on top of the demo-account login gate described here. This spec's Out of Scope line on authentication is unchanged and should be read alongside that new spec — login still resolves via the same `ACCOUNTS`/`userApi.list()` flow (FR-008); only what happens after a successful login changed.
- 2026-08-06: Superseded FR-002's "no environment variables" clause — the Vite dev-server proxy target is now driven by `VITE_API_TARGET` (`.env.mock`/`.env.api`, selected via `npm run dev:mock` / `dev:api`) instead of being hardcoded, so a placeholder Spring Boot backend (`localhost:8080`) can be targeted alongside the mock server (`127.0.0.1:4010`, still the default under `dev`/`dev:mock`). Relative `/api` paths, `BASE = "/api"` in `src/app/api.ts`, and the dev-only nature of the proxy are all unchanged. See `Spec-project-environment.md` FR-011 and `Spec-mock-api-server.md`'s Appendix.
- 2026-08-09: `.env.api`'s `VITE_API_TARGET` changed from `http://localhost:8080` to `http://heavy-rental-rest-api:8080` — a container-network hostname for the Spring Boot backend, not a locally-run process. Further superseded FR-002 accordingly. See `Spec-project-environment.md` FR-011 and `Spec-mock-api-server.md`'s Appendix for the matching updates.
- 2026-08-11: The checkout flow described here as simulated is no longer simulated when `MODE === "api"` — `Spec-stripe-payment-checkout.md` wires real booking creation and Stripe payment against the real backend, gated so this mock-mode flow is unaffected. See that spec for the full contract.
- 2026-08-30: Docs alignment. FR-010 Pricing tab removed; FR-011 booking statuses are UPPERCASE. `ACCOUNTS` path, live-backend production proxy, and one-plan-per-user (API mode) updated. Out of Scope no longer claims there is no test runner or no live backend.
