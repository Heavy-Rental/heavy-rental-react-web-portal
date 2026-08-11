# Feature Specification: Stripe Payment Checkout (Real Backend)

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-11
**Status**: Implemented (frontend wiring) — blocked on backend for full end-to-end verification
**Input**: "Refer to `STRIPE_INTEGRATION_HANDOFF.md`, and every file under `specification/` — I'm trying to get the react portal ready for stripe implementation."

## Overview

`STRIPE_INTEGRATION_HANDOFF.md` — a handoff document from the `heavy-rental-spring-rest-api` team (branch `hr-27-payment-checkout`) — reports that `POST /api/bookings` and `POST /api/payments/deposit-intent` are now real, verified endpoints, closing the previous blocking gap (booking creation). Until this feature, the portal's checkout was **100% simulated**: `src/features/checkout/payment.ts`'s `generateFakePaymentIntentId()` and `DepositCheckout.tsx`'s `setTimeout`-based fake processing never called any backend, in either `npm run dev:mock` or `npm run dev:api`.

This feature wires the checkout/deposit-payment flow to the real backend contract — but **only when running against it** (`npm run dev:api`, `import.meta.env.MODE === "api"`). The mock server (`npm run dev:mock`, the default) has no Stripe integration and no `/api/bookings` endpoint matching this contract, so its simulated flow is left entirely unchanged. This mirrors the existing precedent in `src/App.tsx`'s `handleLogin`, which already branches on the same `MODE` check to call the real `/api/auth/getBearerToken` → `/api/auth/login` chain instead of the client-simulated `issueSession()` (`Spec-frontend-authentication.md`).

Two things remain out of reach in most development environments and are **not** blockers for this feature: a real (non-placeholder) `STRIPE_API_KEY` on the backend, and the `hr-27-payment-checkout` branch being pushed/merged. This feature makes the frontend structurally ready for both the moment they land, per the handoff's own "What to actually build on the frontend" section (§5).

## Clarifications

### Session 2026-08-11

- Q: Should the mock-mode simulated checkout flow be replaced, or kept alongside the real one? → A: Kept, unchanged. The mock server has no Stripe/real-booking-contract support, so `DepositCheckout.tsx` branches on `import.meta.env.MODE === "api"` — real Stripe Elements + real booking/payment calls in API mode, the pre-existing simulated card form + `setTimeout` flow in mock mode.
- Q: Should the frontend collect raw card details (number/expiry/CVV) and pass them to Stripe, matching the mock UI's existing custom fields? → A: No. Real Stripe Elements (`@stripe/react-stripe-js`'s `<PaymentElement>`) is used in API mode instead — Stripe restricts and strongly discourages raw-card-data collection outside a higher PCI compliance tier (SAQ A-EP), and `PaymentElement` is the API the handoff's suggested `stripe.confirmPayment(clientSecret)` call is actually designed around. The mock mode's custom card/PayNow-toggle UI is unaffected.
- Q: The backend has no server-side guard against calling `deposit-intent` twice for the same booking (handoff §4) — how does the frontend avoid a duplicate PaymentIntent/duplicate charge risk? → A: The real booking + PaymentIntent are created exactly once, at the "Continue to Payment" transition, and cached in component state (`ApiDepositPayment`) for the rest of the checkout modal's lifetime — navigating back to the summary step and forward again reuses the same booking/PaymentIntent rather than re-creating them. The "Continue to Payment" and "Pay Deposit" buttons are both disabled immediately on click, matching the handoff's explicit ask ("disable the button after the first click... until the backend re-adds this check").
- Q: Where does the Stripe **publishable** key come from, given it can't be committed to the repo (flagged by this org's tooling even though publishable keys aren't cryptographically secret)? → A: `VITE_STRIPE_PUBLISHABLE_KEY` is declared (empty) in the committed `.env.api`; the real `pk_test_...` value is supplied locally via a gitignored `.env.api.local` (already covered by the existing `*.local` glob in `.gitignore`) for `npm run dev:api` testing, and via GitHub Secrets injected at build/deploy time in CI. `src/app/stripe.ts`'s `getStripe()` resolves to `null` (no Stripe.js loaded) if the key is absent, rather than throwing.
- Q: Should the deposit amount shown to the user be recomputed client-side from `totalCost * 0.3`, or trusted from the server? → A: Once the real booking exists, the server's `depositAmount` (from `POST /api/bookings`'s response) is authoritative and is what's displayed and what the confirmation screen records — matching the handoff's own note in §2 ("never trust a client-supplied amount for these"). The client-side `calcDeposit()` estimate is only ever shown before the booking is created (the summary step).

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a customer checking out against the real backend (`npm run dev:api`), I complete my booking and pay my deposit through Stripe's own hosted payment form, and see the same booking-confirmation screen as today — with real booking and payment identifiers behind it instead of simulated ones. As a customer or developer using the mock server (`npm run dev:mock`, the default for local development), checkout behaves exactly as it did before this feature.

### Acceptance Scenarios

1. **Given** `npm run dev:api` and a cart with items from one depot, **When** the customer clicks "Continue to Payment," **Then** a real booking is created via `POST /api/bookings` and a real Stripe PaymentIntent via `POST /api/payments/deposit-intent`, and the payment step renders Stripe's `PaymentElement` using the returned `clientSecret`.
2. **Given** the payment step described above, **When** the customer completes a Stripe test-mode card and submits, **Then** `stripe.confirmPayment` is called, and on `succeeded` the existing `ConfirmationScreen` is shown with the real `bookingId`-derived reservation id and the server's real `depositAmount`.
3. **Given** the same flow, **When** Stripe declines the payment or returns an error, **Then** the existing "Payment Unsuccessful" screen is shown with Stripe's actual error message, and "Retry Payment" re-attempts against the same cached booking/PaymentIntent rather than creating a new one.
4. **Given** `npm run dev:mock` (or `dev`, the default), **When** a customer checks out, **Then** the flow is bit-for-bit unchanged from before this feature — the simulated card form, the `4000000000000002` simulated-decline card, and the `setTimeout`-based processing delay.
5. **Given** `npm run dev:api` and a customer clicks "Continue to Payment" twice in a row (e.g. a slow network double-click), **When** the second click is registered, **Then** no second booking or PaymentIntent is created — the button is disabled for the duration of the first request and the cached result is reused if already available.
6. **Given** `VITE_STRIPE_PUBLISHABLE_KEY` is unset (e.g. a fresh clone without a local `.env.api.local`), **When** `npm run dev:api` is used and the payment step is reached, **Then** `getStripe()` resolves `null` and Stripe Elements fails to mount rather than throwing an unhandled exception — a known, accepted limitation until the key is supplied locally (see Dependencies & Assumptions).

### Edge Cases

- What happens if `POST /api/bookings` returns `409 Conflict` (double-booked asset, per the handoff §2)? → The error is shown inline on the summary step; the user never advances to a payment step with no real booking behind it.
- What happens if the backend's `STRIPE_API_KEY` is still the placeholder value (per the handoff, true in most environments today)? → `POST /api/payments/deposit-intent` fails at the Stripe boundary; this surfaces as an inline error on the summary step, same as any other `onBeginPayment` failure. Not a frontend defect — tracked as a backend-side gap in Dependencies & Assumptions below.
- What happens to a successful deposit payment's effect on the booking's own status? → Per the handoff §4, the backend doesn't yet update `Booking.status` after a successful payment — `GET /api/bookings/{id}` won't reflect "deposit paid" immediately afterward. This feature doesn't build any UI that depends on that status changing right away (the confirmation screen is built entirely from the client's own cart/response data, not a re-fetched booking).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `DepositCheckout.tsx` MUST branch on `import.meta.env.MODE === "api"` — real backend/Stripe behavior in API mode, the pre-existing simulated behavior unchanged in every other mode (mirrors `src/App.tsx`'s `handleLogin` precedent).
- **FR-002**: In API mode, leaving the summary step MUST call a real `POST /api/bookings` (`createDepositBooking()`, `src/app/api.ts`) using the handoff §2 contract (`items: [{assetId}]`, shared `startDate`/`endDate`, `siteAddress`, optional `deliveryNotes`) followed by a real `POST /api/payments/deposit-intent` (`paymentApi.createDepositIntent(bookingId)`), and MUST cache the resulting `bookingId`/`clientSecret`/`paymentIntentId`/`depositAmount` for the remainder of the checkout modal's lifetime rather than re-creating them on a later transition.
- **FR-003**: The "Continue to Payment" button MUST be disabled for the duration of the booking/PaymentIntent creation call, and MUST NOT re-issue that call if a cached result already exists — the client-side mitigation for the backend having no server-side deposit re-initiation guard yet (handoff §4).
- **FR-004**: In API mode, the payment step MUST render Stripe's `PaymentElement` (`@stripe/react-stripe-js`, mounted via the returned `clientSecret`) instead of the mock mode's custom card-number/expiry/CVV fields and PayNow toggle.
- **FR-005**: Submitting the Stripe payment form MUST disable the submit button immediately and call `stripe.confirmPayment({ elements, redirect: "if_required" })`; on `succeeded`, the existing confirmation flow MUST run using the server's real `bookingId`/`paymentIntentId`/`depositAmount`; on error, the existing "Payment Unsuccessful" screen MUST render using Stripe's actual `error.message`.
- **FR-006**: The Stripe **publishable** key MUST be read from `VITE_STRIPE_PUBLISHABLE_KEY` via an isolated loader (`getStripe()`, `src/app/stripe.ts`) that resolves `null` rather than throwing when the key is absent, and MUST NOT be committed to the repository with a real value — `.env.api` carries it empty/placeholder; real values come from a gitignored `.env.api.local` locally or GitHub Secrets in CI/deploy.
- **FR-007**: Mock mode (`npm run dev:mock`/`dev`) checkout behavior — the simulated card form, the `4000000000000002` decline convention, the `setTimeout`-based processing delay, and mock-server booking/rental-plan creation via `bookingApi`/`rentalPlanApi` — MUST remain byte-for-byte unchanged by this feature.
- **FR-008**: The confirmation screen (`ConfirmationScreen.tsx`) MUST NOT be modified to depend on any booking-status field the real backend doesn't yet update after payment (handoff §4) — it continues to render entirely from client-held cart/response data, as it already did before this feature.

### Key Entities / Components

- **`src/app/api.ts`**: `createDepositBooking()`, `CreateBookingRequest`/`CreateBookingResponse` (handoff §2 contract), `paymentApi.createDepositIntent()` — new, alongside (not replacing) the existing mock-oriented `bookingApi` resource, which targets the same `/api/bookings` path under a different `MODE`/contract and is never called in the same mode.
- **`src/app/stripe.ts`** (new): `getStripe()` — a memoized `loadStripe()` wrapper, isolating the one place Stripe.js is loaded, mirroring `src/app/auth.ts`'s isolation style for "swap this for the real thing" concerns.
- **`src/features/checkout/DepositCheckout.tsx`**: `ApiDepositPayment`/`ApiPaymentResult` types, the new `onBeginPayment` prop (API-mode booking + PaymentIntent creation; a no-op returning `null` in mock mode), the widened `onPaid` prop (`(result?: ApiPaymentResult) => Promise<void>`), and the new `StripeDepositForm` inner component (`useStripe()`/`useElements()`/`<PaymentElement>`).
- **`src/App.tsx`**: the `DepositCheckout` call site's `onBeginPayment`/`onPaid` closures — API-mode and mock-mode bodies live side by side, sharing the same `cart`/`siteAddress`/`deliveryNotes`/`cartDateRange()` state already collected for the pre-existing mock-mode path.
- **`.env.api`**: `VITE_STRIPE_PUBLISHABLE_KEY` (new, empty/placeholder — see FR-006).

## Dependencies & Assumptions

- Assumes `STRIPE_INTEGRATION_HANDOFF.md`'s documented contracts (`POST /api/bookings`, `POST /api/payments/deposit-intent`) as of 2026-08-11 remain accurate; that document is the source of truth for the real backend's request/response shapes, not duplicated field-by-field here.
- Carries forward the handoff's own known backend gaps, none of which this frontend feature can close: no server-side guard against calling `deposit-intent` twice for the same booking (mitigated client-side, FR-003); a successful deposit payment doesn't update the booking's own status; the daily balance-charge cron is disabled; this environment typically has no real `STRIPE_API_KEY` configured, so a true real-money (test-mode) charge has not been completed end-to-end as of this writing.
- Assumes the `hr-27-payment-checkout` backend branch is reachable at the `VITE_API_TARGET` configured in `.env.api` (`http://heavy-rental-rest-api:8080`, a container-network hostname — see `Spec-project-environment.md` FR-011) for any of this to function at all; as of this writing that branch is local-only on the backend side, not pushed to `origin`.
- Assumes `equipmentApi`'s numeric `Equipment.id` (from `GET /api/equipment`) is the same id the real backend expects as `assetId` in `POST /api/bookings` — the handoff doesn't state otherwise, and equipment browsing is separately confirmed "ready" in the handoff's readiness checklist.
- Assumes a real, valid Stripe publishable key is supplied out-of-band (a gitignored `.env.api.local` locally, GitHub Secrets in CI/deploy) — this feature does not include a real key, per this org's policy against committing it (see FR-006, Clarifications).

## Out of Scope

- Anything not on the handoff's readiness checklist as "ready": full API-mode parity for "My Rental Plans," the admin dashboard, or booking-status-driven UI — those continue to target the mock server's contract; only the checkout/deposit-payment path is wired to the real backend by this feature.
- Making the real Stripe publishable key or backend reachability actually present in any given environment — this feature makes the frontend ready to use them, but doesn't supply them (see Dependencies & Assumptions).
- The backend-side gaps listed in the handoff §4 (server-side re-initiation guard, booking-status-on-payment-success, the balance-charge cron) — tracked here as known limitations, not fixed by this feature.
- A production/CI build actually receiving `VITE_STRIPE_PUBLISHABLE_KEY` or `VITE_API_TARGET` — the release pipeline's `npm run build` doesn't pass `--mode api` today, a pre-existing gap already noted in `Spec-project-environment.md`'s Out of Scope, not introduced or closed by this feature.
- PayNow (or any payment method beyond what Stripe's `PaymentElement` itself offers) in API mode — the mock mode's custom PayNow toggle/QR UI is retained only for the simulated flow; `PaymentElement` surfaces whatever methods are enabled on the connected Stripe account.

## Review & Acceptance Checklist

### Content Quality

- [x] Describes required behavior and contracts, not internal implementation mechanics
- [x] Focused on the value this integration provides to a customer checking out, and to the developer working against either backend
- [x] Understandable by both technical and non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No open `[NEEDS CLARIFICATION]` markers remain — ambiguities were resolved in the Clarifications session above
- [x] Requirements are testable and unambiguous (each FR maps to an observable code path or UI behavior)
- [x] Success criteria are measurable (exact endpoint paths, exact env var name, exact library/API used)
- [x] Scope is clearly bounded (see Out of Scope)
- [x] Dependencies and assumptions — including known backend gaps carried forward from the handoff — are identified

## Change Log

- 2026-08-11: Initial specification written, documenting the frontend wiring of the checkout/deposit-payment flow to the real backend (`STRIPE_INTEGRATION_HANDOFF.md`'s `POST /api/bookings` and `POST /api/payments/deposit-intent`) via Stripe Elements/`PaymentElement`, gated behind `MODE === "api"` so the mock-mode simulated flow is unaffected. New: `src/app/stripe.ts`, `src/vite-env.d.ts`. Modified: `src/app/api.ts` (`createDepositBooking`, `paymentApi`), `src/features/checkout/DepositCheckout.tsx`, `src/App.tsx`, `.env.api` (`VITE_STRIPE_PUBLISHABLE_KEY`, no real value committed), `package.json`/`package-lock.json` (`@stripe/stripe-js`, `@stripe/react-stripe-js`). See `Spec-frontend-api-integration.md`'s and `Spec-project-environment.md`'s own Change Logs for cross-references.
