# Specification: REST API Reference (Real Backend)

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-13
**Status**: Reference / Living document
**Input**: A cross-cutting REST index for `heavy-rental-spring-rest-api` (the real Spring Boot backend) was shared for comparison against this portal's actual and planned API usage. No file from that source is linked here — it was a working document from the backend team, not part of this repo's own spec set.

## Overview

Until this document, no spec in this portal catalogued the **real backend's** REST surface — only the mock server (`Spec-mock-api-server.md`) and scattered per-feature slices (`Spec-frontend-api-integration.md`, `Spec-stripe-payment-checkout.md`). This is the single place to see every real-backend route this portal uses today, is documented to use, or plans to use — and, separately, which routes this portal's code calls that the real backend does not yet support.

Scope is **this web portal's perspective only**: routes owned by the mobile/driver app with no web-portal feature (today or planned) are deliberately excluded — see §4. This document does not restate request/response shapes already owned by another spec (`Spec-frontend-authentication.md` for the login/session flow, `Spec-stripe-payment-checkout.md` for booking-creation/deposit-intent); it points to them.

**When a route this portal depends on is added, removed, or changed on the real backend, update this index in the same change set** — the same discipline this portal's other specs already commit to for their own content.

## Clarifications

### Session 2026-08-13

- Q: The backend's index filed `POST /api/bookings` and `POST /api/payments/deposit-intent` under a "mobile-only" section, but this portal calls both directly (`Spec-stripe-payment-checkout.md`) — how should this reference handle that? → A: The frontend's usage is correct; the backend-side client label is what's wrong, and correcting it is a backend-side documentation fix (out of scope for this repo). This reference lists both routes under §2.4 (Bookings) / §2.5 (Payments) as web-used, and separately still excludes the genuinely mobile/driver-only routes (deliveries, returns, payment webhook) — see §4 — rather than importing the backend's client labels wholesale.
- Q: Should this reference document the routes the frontend *calls but the real backend doesn't implement* (`/api/users`, depot/rental-plan/booking write routes beyond what's built) as something the frontend should stop calling, or as backend work still owed? → A: Backend work owed. The frontend's assumed contract (full CRUD on users, depots, rental plans; PATCH/DELETE on bookings) is treated as correct/intended here; §5 tracks each as a backend implementation gap, not a frontend bug.
- Q: `POST /api/auth/logout` is a real, merged backend route, but this portal's `handleLogout` never calls it (purely local session clear, unchanged since `Spec-frontend-authentication.md`) — fix the frontend to call it, or drop the backend route? → A: Left open — recorded in §6 as an undecided item rather than resolved either way, since deciding requires knowing whether the backend route does anything server-side (session/refresh-token invalidation, audit logging) beyond what a stateless JWT scheme needs.
- Q: The backend already implemented the S2b recommender routes (`/api/recommendations/*`), but `CustomerOnboarding.tsx`/`Chatbot.tsx` still simulate recommendations entirely client-side — how should that gap be tracked? → A: As frontend work still owed (§7) — this portal intends to wire these endpoints eventually, replacing the client-simulated flow.

### Session 2026-08-13 (continued)

- Q: Does `POST /api/rentalPlans/{id}/quote` reach Haystack, or is it Spring-only arithmetic? → A: It's intended to reach Haystack's quote endpoint for AI-informed pricing — this corrects an earlier speculative note in this document (§2.4) that guessed it was likely Spring-only because its contract lives in a separate spec from the Haystack client. See §8.1.
- Q: The backend's index recorded a `POST /api/pricing/estimate` route as removed ("never built, no matching Haystack endpoint to proxy") — does this portal still need an endpoint like that? → A: Yes, as a deliberate new proposal, not a revival of that removed phantom. It's meant to be the Spring-only counterpart to the Haystack-backed quote in §8.1 — a fast price calculation that never reaches Haystack. See §8.2.

## 1. Status legend

| Status | Meaning |
|---|---|
| ✅ Backend live, frontend wired | Real backend route exists and this portal calls it (in `npm run dev:api` / `MODE === "api"`) |
| 🧱 Backend stub | Route exists, returns success, but has no real backing data (e.g. always `[]`) |
| ⚠️ Frontend calls it, backend doesn't have it | This portal's code (unconditionally, not mode-gated) targets a path/method the real backend does not implement — see §5 |
| ⏳ Backend live, frontend not wired | Real backend route is implemented but this portal has no code calling it yet — see §7 |
| — | Not applicable to this portal (mobile/driver-only) — see §4 |
| 🚫 Not planned | This portal's code doesn't call it and isn't expected to — distinct from §5's gaps, which the frontend *does* call and *does* need the backend to add |

## 2. Endpoint index — routes this portal uses or depends on

### 2.1 Auth — shared with mobile

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/api/auth/getBearerToken` | ✅ Backend live, frontend wired | `src/app/api.ts` `login()`, API mode only. See `Spec-frontend-authentication.md`. |
| `POST` | `/api/auth/login` | ✅ Backend live, frontend wired | Same. |
| `POST` | `/api/auth/logout` | ⚠️ / open question | Backend route exists; frontend `handleLogout` (`src/App.tsx`) never calls it, in any mode. See §6 — not resolved here. |

There is one login flow, no web-vs-mobile distinction at the backend level (no `platform`/`audience` claim exists today).

### 2.2 Equipment

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/api/equipment` | ✅ Backend live, frontend wired | `equipmentApi.list()`, also accepts `startDate`/`endDate` query params from the frontend's call shape ([api.ts:82-88](../src/app/api.ts#L82-L88)) — availability-aware listing is a portal assumption, not independently re-verified against the real backend's `SPEC-equipment-browse-api.md` contract in this pass. |
| `GET` | `/api/equipment/{id}` | ✅ Backend live, frontend wired | |
| `POST` | `/api/equipment` | ✅ Backend live, frontend wired | Admin `AssetsTab`. |
| `PUT` | `/api/equipment/{id}` | ✅ Backend live, frontend wired | |
| `PATCH` | `/api/equipment/{id}` | ✅ Backend live, frontend wired | Admin `PricingTab` rate updates. |
| `DELETE` | `/api/equipment/{id}` | ✅ Backend live, frontend wired | |

### 2.3 Depots

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/api/depots` | 🧱 Backend stub, frontend wired | Real backend always returns `[]` — no `Depot` entity exists server-side. `depotApi.list()` is called (`App.tsx`, admin context) and tolerates the empty result. |
| `POST` / `PUT` / `PATCH` / `DELETE` | `/api/depots...` | ⚠️ Frontend calls it, backend doesn't have it | `depotApi` is a generic full-CRUD resource client-side; no write route exists on the real backend. See §5. |

### 2.4 Rental Plans

| Method | Path | Status | Notes |
|---|---|---|---|
| `POST` | `/api/rentalPlans` | ✅ Backend live, frontend wired | `rentalPlanCartApi.create()` (`Spec-rental-plan-cart-checkout.md` PR 1) — mock-mode checkout still uses the separate generic `rentalPlanApi.create()`, unaffected. **Pending change (not yet live):** `siteAddress` is becoming optional at creation — see `spring contract/rental-plan-site-address.md` and `postal-code-validation-execution-plan.md` (Phase 2). Until that lands, `siteAddress` is still `@NotBlank` as described in §2.4.1 below. |
| `GET` | `/api/rentalPlans` | ✅ Backend live, frontend wired | |
| `GET` | `/api/rentalPlans/{id}` | ✅ Backend live, frontend wired | |
| `POST` | `/api/rentalPlans/{id}/items` | ✅ Backend live, frontend wired | `rentalPlanCartApi.addItem()` (PR 1). |
| `DELETE` | `/api/rentalPlans/{id}/items/{itemId}` | ✅ Backend live, frontend wired | `rentalPlanCartApi.removeItem()` (PR 1). |
| `POST` | `/api/rentalPlans/{id}/quote` | ✅ Backend live, frontend wired | `rentalPlanCartApi.quote()` (`Spec-dynamic-pricing-e2e.md`). Reaches Haystack for AI-informed pricing when `pricing.dynamic-enabled` is on (off by default everywhere today), with a silent fallback to base-rate arithmetic otherwise — see §8.1. |
| `PATCH` | `/api/rentalPlans/{id}` | ⏳ Accepted by Spring, not yet live | **New, `siteAddress`-only** — not the generic update `rentalPlanApi.update()` assumes (see `PUT`/`DELETE` row below, still a real gap). Lets an already-created plan get `siteAddress` set/changed on its own record — accepts `{siteAddress}` only. **⚠️** setting it on a `QUOTED` plan reverts the plan to `DRAFT` and clears `totalAmount`, same rule as adding/removing a line item. See `spring contract/rental-plan-site-address.md` and `postal-code-validation-execution-plan.md` (Phase 2, Sub-task 7-8) for the full contract and frontend wiring plan. |
| `PUT` / `DELETE` | `/api/rentalPlans/{id}` | ⚠️ Frontend calls it, backend doesn't have it | `rentalPlanApi.replace/remove` are part of the generic resource client; the real backend has no generic replace/delete on a plan, only the item-, quote-, and (once the row above lands) `siteAddress`-scoped mutations. See §5. |

### 2.4.1 Field-level requirements for the cart/checkout workflow (`Spec-rental-plan-cart-checkout.md` PR 1-3)

The table above only tracks route-level wiring status. `SPEC-rental-plan-quote.md` (backend-side) was never shared into this repo, but `POST /api/rentalPlans` and `POST /api/rentalPlans/{id}/items`'s field-level shapes are now **confirmed directly from the Spring Boot source** (`RentalPlanController.java`, `RentalPlanService.java`, `RentalPlanCreateRequest.java`, `RentalPlanItemRequest.java`, `RentalPlanItemResponse.java` — shared 2026-08-13, superseding this section's earlier speculation on those two routes). The rest of this section still marks what's **confirmed**, **unconfirmed** (needs a backend check), and **🔧 change required** (new behavior this workflow needs that almost certainly doesn't exist yet).

- **`POST /api/rentalPlans`** (PR 1) — **Confirmed, as of today — pending a change, see below.** Request body is `RentalPlanCreateRequest { startDate: LocalDate | null, endDate: LocalDate | null, siteAddress: String }` — `siteAddress` is `@NotBlank` and must end in a 6-digit postal code (same pattern as `Booking.siteAddress`); `startDate`/`endDate` are unconstrained/nullable on this DTO. **There is no `status` field on the request** — the backend always creates at `status = "DRAFT"` regardless of what's sent, settling the old "must the client pass status" question as moot. On success (`201 Created`), the response is the full `RentalPlanResponse` (§2 of `api-contract-for-frontend.md`) with `items: []`, `totalAmount: null`, and **`updatedAt: null`** (only `createdAt` is set on creation — `updatedAt` stays genuinely absent until the plan is first quoted, not just "not yet meaningful" as the contract phrased it). The backend itself rejects a second `create()` with `409` while the caller already has an active (`DRAFT`/`SAVED`/`QUOTED`) plan — independent, server-side enforcement of B9/BR-06, not just a convention the frontend needs to uphold. A `siteAddress` validation failure short-circuits before the controller body runs: `400 {"error":"validation_failed","message":"siteAddress: <msg>"}`. **Pending, not yet live:** Spring has agreed to make `siteAddress` optional here (omit it entirely to create the plan with `siteAddress: null`) — validation stays exactly as strict whenever it *is* provided. See `spring contract/rental-plan-site-address.md`.
- **`PATCH /api/rentalPlans/{id}`** — **new, not yet live.** Accepts `{siteAddress}` only. Lets a plan created without an address (via the pending change above) get one set later, before conversion to a booking. Same validation as `POST` when `siteAddress` is present. **Setting it on a `QUOTED` plan reverts the plan to `DRAFT` and clears `totalAmount`** — same rule already in place for adding/removing a line item on a quoted plan. See `spring contract/rental-plan-site-address.md`.
- **`GET /api/rentalPlans`** (PR 1, PR 2) — each plan needs `id`, `status`, and `updatedAt` in the array (PR 2 needs `updatedAt` on every read, not just right after quoting — e.g. reopening the app later and re-checking quote validity). **Unconfirmed**: whether it supports filtering to "the caller's one active (non-`converted`) plan" server-side, or PR 1 must fetch all of a user's plans and filter client-side (this is B9 — not necessarily a change, but worth confirming before it becomes a real cost as plan history grows).
- **`GET /api/rentalPlans/{id}`** (PR 2) — same `status`/`updatedAt` requirement as above, for recomputing checkout-eligibility when the customer returns to a plan without having just quoted it. **Unconfirmed** whether these fields are already in the response (this is B8).
- **`POST /api/rentalPlans/{id}/items`** (PR 1) — **Confirmed, and the old per-item-dates question is resolved.** Request body is `RentalPlanItemRequest { assetId: Long }` only — **no per-item `startDate`/`endDate`**, settling B11's original framing: a plan has exactly one shared date range, fixed at creation, and items never carry their own (matching `api-contract-for-frontend.md`'s Clarifications, now doubly confirmed from source). This route has **no `@Valid`** — a malformed/missing-`assetId` body falls through to Spring's default `HttpMessageNotReadableException` 400 (not the portal's `{"error":...}` shape); an `assetId` that doesn't resolve to a real `Asset` is a manual check returning `400 {"error":"bad_request","message":"Unknown assetId"}`; a plan that doesn't exist or isn't owned by the caller returns `404 {"error":"not_found","message":"Rental plan not found"}`. **Confirmed (B10)**: on success (`201 Created`), the response is the full, current `RentalPlanResponse` — if the plan was `QUOTED`, this same response already reflects the revert to `DRAFT` (`totalAmount: null`, `updatedAt` refreshed to now), not the stale pre-mutation state.
- **`DELETE /api/rentalPlans/{id}/items/{itemId}`** (PR 1) — request/response shape not shown in the source excerpt reviewed 2026-08-13 (only `create`/`addItem` were); the revert-to-`DRAFT` behavior is very likely shared with `addItem` via the same `revertQuoteIfNeeded` service method, but that's an inference, not confirmed line-by-line the way the two rows above are. Treat as **🔧 change required (B10)** until independently checked.
- **`POST /api/rentalPlans/{id}/quote`** (PR 2) — **Wired 2026-08-15** (`Spec-dynamic-pricing-e2e.md`), superseding the "change required" framing below: the frontend now calls this route and reads `totalAmount`/`status`/`updatedAt` straight off its response, with no follow-up call, matching what B7 asked for. The original bullet is kept for its historical framing of B7: this call must itself set `status = quoted` and refresh `updatedAt` as part of succeeding — this is new required behavior, not existing behavior we're just undocumented on. Response needs an authoritative price (recommend matching `Booking`'s existing `totalAmount`/`depositAmount`/`remainingBalance` naming for consistency) plus `status` and `updatedAt`, so the frontend can update UI immediately without a follow-up call.
- **`PUT`/`DELETE /api/rentalPlans/{id}`** — unaffected by this workflow; still the removal candidates from §5. **`PATCH /api/rentalPlans/{id}`** is no longer in that category — see the new bullet above; it's a real, scoped (`siteAddress`-only) route Spring has agreed to build, not a removal candidate.

PR 3's needs (`POST /api/bookings` accepting `rentalPlanId`, deriving items/pricing from the plan per B1, and the `409` expired-quote response per B3) live in §2.5, not here — that section needs the same field-level pass, not done in this update.

### 2.5 Bookings & Payments

| Method | Path | Status | Notes |
|---|---|---|---|
| `POST` | `/api/bookings` | ✅ Backend live, frontend wired | `createBookingFromPlan()` (renamed 2026-08-15 from `createDepositBooking()` — now sends `{ rentalPlanId, siteAddress, deliveryNotes }`, not raw `items`/dates; see `Spec-dynamic-pricing-e2e.md` §4.5) — real booking-creation contract, API mode only. See `Spec-stripe-payment-checkout.md`. Used by **this web portal directly**, despite being filed under the backend's "mobile" section (§ Clarifications above). |
| `POST` | `/api/payments/deposit-intent` | ✅ Backend live, frontend wired | `paymentApi.createDepositIntent()`. Same web-usage note. |
| `GET` | `/api/bookings` | ⏳ Backend live, frontend not wired | Real route exists; this portal's "My Rental Plans" / admin bookings views still read from the mock server only in API mode's current scope (`Spec-stripe-payment-checkout.md` Out of Scope). Relevant if API-mode parity is extended later. |
| `GET` | `/api/bookings/{id}` | ⏳ Backend live, frontend not wired | Same. |
| `PUT` | `/api/bookings/{id}` | ⏳ Backend live, frontend not wired | Same — note this is a full-replace endpoint on the real backend, not a partial merge. |
| `PATCH` | `/api/bookings/{id}/status` | ✅ Backend live, frontend wired | `bookingApi.updateStatus()` — admin `BookingsTab`'s status dropdown. Real route, `{ "bookingStatus": "..." }` body, any of the 6 `BookingStatus` values accepted with no transition restriction. Previously called the generic `bookingApi.update()` against plain `/api/bookings/{id}` (PATCH), which 405'd — see `Spec-admin-dashboard-api-mode-fixes.md`. |
| `DELETE` | `/api/bookings/{id}` | 🚫 Not planned | `CANCELLED` is a real `BookingStatus` value, reachable via the status route above, and covers the "remove a booking" use case without a hard delete. `bookingApi.remove()` exists on the generic resource client but the admin UI never calls it for bookings. |

### 2.6 Analytics

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/api/monthly-utilization` | ✅ Backend live, frontend wired | `ROLE_ADMIN` only server-side; admin Overview tab. |
| `GET` | `/api/status-distribution` | ⚠️ Frontend calls it, backend doesn't have it | `statusDistributionApi` — mock-server-only endpoint (`Spec-mock-api-server.md` FR-009); no equivalent exists anywhere on the real backend. See §5. |

### 2.7 Users

**Corrected 2026-08-14.** Previously listed as a backend gap (⚠️, §5) — that was stale. The real backend's `UserController`/`UserAdminService` fully implements this surface (`ROLE_ADMIN`-only, soft-delete on remove, server-generated one-time password on create); confirmed by reading the backend source directly, not just live HTTP calls.

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/api/users` | ✅ Backend live, frontend wired | Lists enabled users only (`enabled=true`), `{id, name, email, role}`. Called unconditionally on every login (`App.tsx` `handleLogin`) to resolve a numeric `userId`, and by the admin Users tab. |
| `GET` | `/api/users/{id}` | ✅ Backend live, frontend wired | Not currently called by this portal's code (list is sufficient today), but exists and matches `userApi.get()`. |
| `POST` | `/api/users` | ✅ Backend live, frontend wired | `{name, email}` only — role isn't accepted, always created as `role=USER`/`"customer"`. Response includes a server-generated one-time `temporaryPassword`, now surfaced to the admin via a confirmation modal after creation (`Spec-admin-dashboard-api-mode-fixes.md` FIX-06) rather than discarded. |
| `PATCH` | `/api/users/{id}` | ✅ Backend live, frontend wired | Partial update, `{name?, email?, role?}` — used by the admin Users tab's Edit modal. |
| `DELETE` | `/api/users/{id}` | ✅ Backend live, frontend wired | Soft-delete only (`enabled=false`, not a hard delete) — the user disappears from subsequent `GET /api/users` results but the row/FKs are preserved. |

No `PUT /api/users/{id}` exists, but nothing in this portal calls it (`userApi.replace()` is unused for this resource) — not a gap.

### 2.8 Recommendations (S2b)

| Method | Path | Status | Notes |
|---|---|---|---|
| `POST` | `/api/recommendations/project-spec` | ✅ Backend live, frontend wired | JSON (`recommendationApi.createFromProjectSpec`) or multipart (`createFromProjectSpecMultipart`). `CustomerOnboarding` Generate Instant Quote. Same path under `dev:mock` and `dev:api`. |
| `POST` | `/api/recommendations/{id}/knowledge-query` | ⏳ Backend live, frontend not wired | Backs the project chatbot (Call 3). `Chatbot.tsx` currently simulates replies client-side. See §7. |
| `GET` | `/api/recommendations/{id}` | ⏳ Backend live, frontend not wired | Session read-back; no frontend caller yet. |

### 2.9 Postal Codes

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/api/postalCodes/{postalCode}` | ✅ Backend live, frontend wired | Real-time Singapore postal code validation, called from `SiteAddressModal` (`postalCodeApi.lookup()`) while the customer is still filling in the site-address form (rental plan create, booking create), before final submit — additive, doesn't change the existing `siteAddress` submit payload. `200 {status: "VALID"\|"INVALID", ...}` (blocks Save on `INVALID`), `400 bad_request` if not 6 digits, `503 {status: "UNAVAILABLE", ...}` if the lookup service is down (soft-fail, doesn't block Save). See `specification/features/spring contract/postal-code-validation.md` (backend handoff) and `specification/features/postal-code-validation-execution-plan.md` (frontend execution plan) for the full contract and wiring plan. |

## 3. Env/proxy context

This portal reaches the real backend only under `npm run dev:api` (`MODE === "api"`), via the Vite dev-server proxy's `VITE_API_TARGET` (`http://heavy-rental-rest-api:8080`, a container-network hostname) — see `Spec-project-environment.md` FR-011 and `Spec-mock-api-server.md`'s Appendix. Under the default `npm run dev`/`dev:mock`, every route in this document is instead served by the mock server per `Spec-mock-api-server.md`, which has no auth, no Stripe, and different write semantics (e.g. `POST` responses wrapped in a single-element array — see `unwrapCreateResponse()` in `api.ts`).

## 4. Excluded — mobile/driver-only, no web-portal feature today or planned

These exist on the real backend but have no corresponding screen or planned screen in this portal (no delivery/return record management exists anywhere in `src/features/admin`), so they're intentionally left out of §2 rather than tracked as gaps:

| Method | Path |
|---|---|
| `GET` | `/api/deliveries` |
| `PATCH` | `/api/deliveries/{bookingId}/status` |
| `GET` | `/api/returns` |
| `PATCH` | `/api/returns/{bookingId}/status` |
| `POST` | `/api/payments/webhook` |

The last one is a Stripe-to-backend server callback, not a route any frontend (web or mobile) ever calls directly — excluded on that basis regardless of client ownership.

## 5. Backend implementation gaps (routes this portal's code expects, not yet real)

These are treated as backend work still owed, not frontend bugs to fix — the frontend's assumed contract is the intended one:

- **`/api/depots` write routes** (`POST`/`PUT`/`PATCH`/`DELETE`) — real backend has GET-only stub, no `Depot` entity. Needed if depot management is ever exercised in API mode (currently only read via the stub, so no visible breakage yet — but any write path would fail).
- **`/api/rentalPlans/{id}`** generic `PUT`/`DELETE` — real backend only has item-, quote-, and (once
  `spring contract/rental-plan-site-address.md` lands) `siteAddress`-scoped mutations (§2.4). **`PATCH` is no
  longer an open-ended gap** — Spring has agreed to build a `siteAddress`-only `PATCH` (not a generic update)
  as part of §2.4's pending change; tracked there and in `postal-code-validation-execution-plan.md` Phase 2,
  not here, once it lands.
- **`/api/status-distribution`** — no real-backend equivalent at all; mock-only today.

## 6. Open item — `POST /api/auth/logout`

Not resolved in this document. The route is real and merged on the backend, but this portal's logout has always been a purely local session clear (`Spec-frontend-authentication.md`, predates API mode) and was never updated to call it once API mode existed. Two ways this could go, neither decided here:

- Wire `handleLogout` to call it in API mode, treating it as a real server-side action (session/refresh-token invalidation, audit logging).
- Confirm it's a no-op for this backend's stateless-JWT scheme and deprecate/remove the route.

Whoever owns the backend's auth design should confirm which, since that determines whether the current frontend behavior is a gap or already correct.

## 7. Frontend work owed — recommender wiring

`POST /api/recommendations/project-spec` is wired (`recommendationApi` + `CustomerOnboarding`). Still owed: `POST /api/recommendations/{id}/knowledge-query` (`Chatbot.tsx` is still client-simulated) and `GET /api/recommendations/{id}` (no caller).

### 7.1 `POST /api/recommendations/project-spec` — as-built contract

**Status: wired.** JSON body is Spring `SubmitProjectSpecRequest`. Multipart uses camelCase form parts plus optional `file`. Response is the Instant Quotation DTO (`CreateProjectSpecResponse`). Orchestration: Web → Spring → Haystack Call 1 + Call 2; Haystack session id stays server-side.

**JSON request:**

```json
{
  "projectText": "6-storey building, 8T load, 18m reach, 3 weeks of facade work",
  "userName": "Alex Tan"
}
```

Optional: `startDate`, `endDate`, `query`, `topK`. JWT supplies user identity. File uploads use the multipart hop instead (`file`, `projectText`, `userName`, …).

**Response:** Instant Quotation DTO — `recommendationId`, `ingestId`, `quoteRef` (string), `confidenceScore`, `days`, `estimatedTotal`, `specSummary`, `rationale`, `items[]` with nested `equipment`, plus session fields (`needsSummary`, `expectedBudget`, `warnings`, `correlationId`, `tentativeStartDate`, `tentativeEndDate`).

**Frontend date-bar binding:** After Add All to Rental Plan, the portal seeds the catalog `DateRangeBar` from `tentativeStartDate` / `tentativeEndDate`, falling back to `days` when a bound is missing (`resolveQuoteDates` in `src/lib/dateFormat.ts`). Know / Browse do not send dates. Locked by `src/lib/dateFormat.test.ts` (`npm test`).

## 8. Pricing calls — quote (Haystack) vs. estimate (Spring-only)

This portal needs two distinct pricing paths, not one: an AI-informed **quote** that consults Haystack, and a fast **estimate** that never leaves Spring. They are not interchangeable and must not be conflated into a single route.

### 8.1 `POST /api/rentalPlans/{id}/quote` — reaches Haystack

**Corrected 2026-08-13.** An earlier revision of this document speculated (§2.4) that this route was likely Spring-only arithmetic, reasoning from the fact that its contract lives in `SPEC-rental-plan-quote.md`, a spec separate from the Haystack client spec. That speculation was wrong: this route is intended to reach Haystack's quote endpoint for AI-informed pricing on a rental plan's existing items (e.g., bundle- or recommendation-aware pricing), not a plain sum.

**Note (2026-08-14 → 2026-08-15):** `Spec-rental-plan-cart-checkout.md` briefly asserted the opposite (Spring-only, no Haystack) on 2026-08-14, sourced from a direct read of the backend as it stood that day — this document was not corrected to match at the time (flagged as out of scope in that doc's Change Log). That 2026-08-14 state has since been superseded again: Haystack-backed dynamic pricing has shipped behind a flag (`pricing.dynamic-enabled`, off by default everywhere), with a silent base-rate fallback when unavailable — i.e., this section's original claim is the currently-correct one. **Status updated: `✅ Backend live, frontend wired`** (§2.4) — see `Spec-dynamic-pricing-e2e.md` for the frontend's handling (quote display, "Smart Priced" badge, and keeping the charged amount in sync with the quoted amount).

### 8.2 `POST /api/pricing/estimate` — proposed, Spring-only, never reaches Haystack

**Status: proposed, new route — does not exist on the backend today.** The backend's temporary index recorded a same-named route as removed: *"`/api/pricing/estimate` was never built and has no matching Haystack endpoint to proxy."* That removal was about a phantom placeholder with no design behind it. This is a fresh, deliberate proposal for the same path, scoped specifically as the **non-Haystack counterpart** to §8.1's quote: a fast, side-effect-free price calculation with no external AI call and no persisted resource — no `Booking`, no `RentalPlan`, no `AIRecommendation` row created.

Purpose: let the web portal show an authoritative price for an ad-hoc set of equipment + dates before the user commits to a rental plan or booking — reusing the same pricing formula `POST /api/bookings` already computes server-side (sum of `baseDailyRate × days` per asset, minimum 1 day, 30%/70% deposit split, `HALF_UP` rounding to 2dp, same `DEPOSIT_RATE` constant) instead of the frontend's own client-side `calcDeposit()` estimate, which existing precedent (`Spec-stripe-payment-checkout.md`) already treats as non-authoritative ("never trust a client-supplied amount").

**Request:**

```json
{
  "items": [{ "assetId": 4 }, { "assetId": 7 }],
  "startDate": "2026-09-01",
  "endDate": "2026-09-21"
}
```

Deliberately the same `items`/`startDate`/`endDate` shape as `POST /api/bookings`'s request, so the same validation and pricing logic can be reused server-side without a second implementation.

**Response:**

```json
{
  "totalAmount": 4200.00,
  "depositAmount": 1260.00,
  "remainingBalance": 2940.00
}
```

Same three fields `POST /api/bookings`'s response already carries — no new shape to learn on the frontend side.

**Open design question, not resolved here:** should this route run the same availability/overlap check `POST /api/bookings` does (`409` on a double-booked asset), or stay purely arithmetic with no availability awareness? Recommendation: no availability check — an estimate should stay fast and side-effect-free, and a conflict on an asset the user hasn't committed to yet isn't actionable at estimate time; conflict detection stays owned by the real booking-creation step. Needs confirmation from the backend team.

## Related specs

- `Spec-mock-api-server.md` — the mock server's own route contract (used under `dev`/`dev:mock`, the default).
- `Spec-frontend-api-integration.md` — the API client layer (`src/app/api.ts`) and its mock-oriented wiring.
- `Spec-frontend-authentication.md` — the login/session/bearer-token flow.
- `Spec-stripe-payment-checkout.md` — the real-backend booking-creation and deposit-payment contract.
- `Spec-project-environment.md` — `VITE_API_TARGET` / `dev:api` proxy configuration.

## Change Log

- 2026-08-15: §2.4's quote row and §2.4.1's quote bullet flipped to "frontend wired" (`rentalPlanCartApi.quote()`, `Spec-dynamic-pricing-e2e.md`); §2.5's `POST /api/bookings` row updated for the `createDepositBooking()` → `createBookingFromPlan()` rename (now sends `rentalPlanId`, not raw `items`/dates). §8.1 note added: the "reaches Haystack" claim this section made on 2026-08-13 is, after a brief 2026-08-14 reversal elsewhere, correct again as of 2026-08-15 — Haystack-backed dynamic pricing has shipped behind a flag, off by default everywhere. Status flipped to `✅ Backend live, frontend wired`.
- 2026-08-13: §2.4/§2.4.1 updated against the Spring Boot source directly (`RentalPlanController.java`, `RentalPlanService.java`, `RentalPlanCreateRequest.java`, `RentalPlanItemRequest.java`, `RentalPlanItemResponse.java`), confirming what was previously speculative: `POST /api/rentalPlans`'s request body is `{startDate, endDate, siteAddress}` with `siteAddress` required (`@NotBlank` + 6-digit-postal-code pattern) and no client-settable `status`; the backend 409s a second `create()` while an active plan exists (B9 enforced server-side, not just client convention); a fresh plan's `updatedAt` is `null`, not just "not yet meaningful"; `POST /api/rentalPlans/{id}/items`'s request is `{assetId}` only, confirming no per-item dates (B11) and that a `QUOTED`→`DRAFT` revert is already reflected in that same response (B10). Also flipped §2.4's item-route rows from "frontend not wired" to "frontend wired" now that `Spec-rental-plan-cart-checkout.md` PR 1 wires them via a new `rentalPlanCartApi`. `DELETE /items/{itemId}`'s own shape remains an inference, not independently confirmed.
- 2026-08-13: Initial reference written, consolidating the real backend's REST surface as relevant to this portal (auth, equipment, depots, rental plans, bookings, payments, analytics, users, recommendations), scoped to routes this portal uses, is documented to use, or plans to use. Excludes mobile/driver-only routes with no web-portal feature (§4). Records backend implementation gaps (§5) and two explicitly undecided items — the unused `/api/auth/logout` route (§6) and the unwired recommender endpoints (§7) — as open/owed rather than resolving them.
- 2026-08-13: Added §7.1 — a proposed (unconfirmed) request/response contract for `POST /api/recommendations/project-spec`, since the authoritative contract isn't available in this repo. Covers the `description`/`attachmentFileNames`/`startDate`/`endDate` request shape and a `recommendationId`/`confidenceScore`/`quoteRef`/`items` response that reuses the existing `POST /api/rentalPlans/{id}/quote` engine for pricing rather than duplicating it.
- 2026-08-13: Added §8 — clarified this portal needs two distinct pricing paths: `POST /api/rentalPlans/{id}/quote` (§8.1, corrected to reach Haystack for AI-informed pricing, reversing this document's earlier speculation that it was Spring-only) and a new, proposed `POST /api/pricing/estimate` (§8.2, Spring-only, never reaches Haystack, reuses `POST /api/bookings`'s pricing formula and request/response shape). §2.4's quote row note updated to cross-reference §8.1.
- 2026-08-13: Added §2.4.1 — field-level requirements for `Spec-rental-plan-cart-checkout.md`'s PR 1-3, marking each rental-plan route's needed fields as confirmed/unconfirmed/change-required. Flags two likely-required backend changes not previously called out at field level: item add/remove must revert a `quoted` plan to `draft` and refresh `updatedAt`, and the quote endpoint must itself set `status = quoted`/refresh `updatedAt` rather than that being read passively later. Notes §2.5 needs the same pass for PR 3's booking-conversion fields, not done here.
- 2026-08-13: §2.5/§5 updated — the `PATCH /api/bookings/{id}` gap is resolved: the backend added `PATCH /api/bookings/{id}/status` (not the same path — a dedicated sub-resource, `{ "bookingStatus": "..." }` body, no transition restriction) and the frontend's admin `BookingsTab` now calls it via a new `bookingApi.updateStatus()`. Added a new 🚫 Not planned status to the legend and reclassified `DELETE /api/bookings/{id}` under it — no longer listed as a gap, since `CANCELLED` (a real status, reachable via the new route) covers the same need without a hard delete.
- 2026-08-13: Marked `POST /api/recommendations/project-spec` as frontend-wired (`recommendationApi` + Instant Quote in `CustomerOnboarding`). §7 now only tracks `knowledge-query` and `GET /{id}`. Vite `/api` proxy timeout set to 180s so `dev:api` can wait out Spring’s Haystack saga.
- 2026-08-13: Documented `tentativeStartDate` / `tentativeEndDate` on the Instant Quotation DTO and the frontend binding that seeds DateRangeBar from those fields (or `days`) after Add All to Rental Plan.
- 2026-08-13: `resolveQuoteDates` field rules are locked by `src/lib/dateFormat.test.ts` (`npm test`).
- 2026-08-14: §2.7/§5 corrected — `/api/users` was listed as a backend gap; that was stale. The real backend's `UserController`/`UserAdminService` fully implements `GET`/`POST`/`PATCH`/`DELETE` (no `PUT`, not called anyway), confirmed by reading the backend source. Removed from §5's gap list; §2.7 now documents each route's actual behavior (soft-delete on remove, `role` not settable on create, one-time `temporaryPassword` on create — see `Spec-admin-dashboard-api-mode-fixes.md` FIX-06 for the frontend fix that stopped discarding it).
