# Specification: Dynamic (ML) Pricing — Frontend Wiring

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-15
**Status**: Live — quote display + charge-vs-display consistency shipped 2026-08-15
**Purpose**: Document the frontend's response to the backend's dynamic-pricing rollout on `POST /api/rentalPlans/{id}/quote` — showing a "Smart Priced" indicator when the ML price differs from the flat base rate, and making sure the amount the customer sees and the amount actually charged never diverge.

## 1. Background

The Spring backend (`heavy-rental-spring-rest-api`) can price each rental-plan line item via a live ML model (`haystack-fast-api`) instead of always using `Asset.baseDailyRate` arithmetic, controlled by a backend-only flag `pricing.dynamic-enabled` — `false` in every environment by default at the time this was built. No API contract changed: `RentalPlanItemResponse.dailyRate`/`.subtotal` and `RentalPlanResponse.totalAmount` may reflect the ML price instead of the base rate when the flag is on, but field names/types/meaning are unchanged, and the backend silently falls back to base-rate arithmetic if dynamic pricing is unavailable for any reason (Haystack unreachable, timeout, etc.) — a quote never fails or hangs because of this. This was communicated to the frontend team via an ephemeral handoff document (not retained in this repo); this spec is the durable record of what the frontend did about it.

This reverses `api-contract-for-frontend.md` §4's 2026-08-14 clarification that `POST /rentalPlans/{id}/quote` was "Spring-only arithmetic... with no HTTP call to Haystack" — that was correct as of that date; the Haystack-backed path has since been built and shipped behind the flag above. See the Change Log entries added to that file and to `Spec-rental-plan-cart-checkout.md` on 2026-08-15.

**Prerequisite this spec assumes (and does not change):** `Spec-rental-plan-cart-checkout.md` PR 1 — the cart is a persisted `RentalPlan` (`rentalPlanCartApi`), not ephemeral client state. Everything below is API-mode only (`MODE === "api"`); mock mode has no `/quote` route and is untouched.

## 2. Scope

### In scope

- `src/app/api.ts` — `rentalPlanCartApi.quote()`, `createBookingFromPlan()`/`CreateBookingFromPlanRequest` (replacing `createDepositBooking()`/`CreateBookingRequest`).
- `src/features/checkout/DepositCheckout.tsx` — quote fetch + loading state, "Smart Priced" badge, summary dollar figures reflecting the resolved quote.
- `src/App.tsx` — wiring `onGetQuote`, and rewiring `onBeginPayment` to convert the plan via `rentalPlanId` instead of raw `items`/dates.
- `src/features/checkout/CartDrawer.tsx` — incidental bug fix surfaced while testing this (§5).

### Out of scope (deliberately deferred — see `Spec-rental-plan-cart-checkout.md` PR 2/PR 3)

- 24-hour quote-validity UI (`updatedAt`-based staleness check, "quote expired — get a new one").
- Branching checkout UI on the `quote_not_ready`/`quote_expired`/`conflict` error taxonomy (`api-contract-for-frontend.md` §5.4) — a failed conversion surfaces as a generic message via `DepositCheckout`'s existing `beginError` state instead.
- Any change to `ConfirmationScreen.tsx`.
- Backend work (the Haystack integration itself, the flag, or `haystack-fast-api`) — this spec only covers the frontend's response to it.

## 3. Where it shows, and when it's fetched

Opening the deposit-checkout modal (**"Proceed to Deposit"** in `CartDrawer.tsx`) mounts `DepositCheckout`, whose Step 1 ("BOOKING SUMMARY") is shown by default. A `useEffect` fires on that mount — not on any further click — calling `onGetQuote()` (`App.tsx` → `rentalPlanCartApi.quote(planId)`) if in API mode and a plan exists (`DepositCheckout.tsx:134`). Nothing about this blocks the rest of the UI: `quoteLoading`'s initial value is computed synchronously via a lazy `useState` initializer (not set inside the effect body) so the loading indicator is correct on the very first paint, and a failed/slow quote never disables "Continue to Payment".

"Continue to Payment" (→ Step 2, Stripe) does **not** trigger another quote fetch. The only other quote call is silent and UI-invisible: `onBeginPayment` (`App.tsx:1772`) re-quotes immediately before converting the plan into a booking (§4).

## 4. Changes

### 4.1 `rentalPlanCartApi.quote()` (`src/app/api.ts`)

```ts
quote: (planId: number) =>
  request<RentalPlanResponse>(`/rentalPlans/${planId}/quote`, {
    method: "POST",
  }),
```

Wires `POST /api/rentalPlans/{id}/quote`, already live on the backend per §2.4 of `Spec-rest-api-reference.md`.

### 4.2 Quote fetch + loading state (`DepositCheckout.tsx`)

New optional prop `onGetQuote?: () => Promise<RentalPlanResponse | null>`. `quote`/`quoteLoading` state, populated by the mount-time effect described in §3. While loading, a small spinner + "Checking live pricing…" shows next to "Reserved Equipment"; a failed fetch is caught and swallowed (`quote` stays `null`) — indistinguishable from "feature off," which is the intended behavior per the backend's own fallback design.

### 4.3 "Smart Priced" badge

```ts
const quotedItem = (assetId: number) =>
  quote?.items.find((i) => i.assetId === assetId);
const isSmartPriced = (assetId: number, baseDailyRate: number): boolean => {
  const quoted = quotedItem(assetId);
  return quoted !== undefined && quoted.dailyRate !== baseDailyRate;
};
```

A line item gets a "Smart Priced" badge (`<Sparkles>` icon, primary-colored tag) when the quote's `dailyRate` for that `assetId` differs from the cart's own `baseDailyRate` — the comparison trick needs no new API field. Known limitation, accepted as-is: if the model's price happens to land exactly on `baseDailyRate`, no badge shows even though the model ran — vanishingly unlikely with continuous model output, not worth engineering around.

### 4.4 Summary dollar figures reflect the resolved quote

```ts
const displayDailyRate = (assetId: number, baseDailyRate: number): number =>
  quotedItem(assetId)?.dailyRate ?? baseDailyRate;
const displayTotal = quote?.totalAmount ?? totalCost;
```

Per-item price, Subtotal, GST, Total Payable, Balance Due, and Deposit Due Now all read off `displayDailyRate`/`displayTotal` instead of the raw client-side `totalCost`/`baseDailyRate`. This was a follow-up fix after initial ship: the badge alone, sitting next to numbers still computed from the base rate, was actively misleading. Falls back to the client-side estimate while loading, on failure, or outside API mode — visually and numerically identical to today's behavior in those cases.

### 4.5 Booking conversion uses the quoted plan, not raw items (`App.tsx:1738`, `src/app/api.ts`)

Previously, `onBeginPayment` called `createDepositBooking({ items: [...], startDate, endDate, siteAddress, deliveryNotes })` — pricing computed server-side from scratch off raw asset IDs and dates, completely independent of anything shown on the summary screen. This is what let the summary *display* a dynamic price while still *charging* the flat base-rate price once dynamic pricing went live.

Now:

```ts
if (planId === null) {
  throw new Error("Your rental plan couldn't be found — please refresh and try again.");
}
await rentalPlanCartApi.quote(planId); // re-quote — the plan must be QUOTED to convert, and this is what
                                        // keeps the charged amount from reverting to base-rate math
const booking = await createBookingFromPlan({
  rentalPlanId: planId,
  siteAddress,
  deliveryNotes: deliveryNotes || undefined,
});
```

`createDepositBooking()`/`CreateBookingRequest` were removed (no remaining callers) in favor of `createBookingFromPlan()`/`CreateBookingFromPlanRequest`, matching `api-contract-for-frontend.md` §5's `{ rentalPlanId, siteAddress, deliveryNotes }` shape — items/dates are derived server-side from the plan and ignored if sent. The response's `totalAmount` is guaranteed to equal the plan's quoted amount exactly, closing the gap. Re-quoting immediately before conversion also covers the case where `DepositCheckout`'s own display-only quote (§4.2) is still loading or never resolved when the customer clicks through — re-quoting a `QUOTED` plan is an explicitly supported operation (the same mechanism as the stale-quote recovery path).

**Not done**: branching on `quote_not_ready`/`quote_expired`/`conflict` if this call fails — it surfaces as a generic error via the existing `beginError` UI. See §2, Out of scope.

## 5. Incidental bug fix: empty-but-active plan blocked new dates

Found while testing this end to end. Removing the last item from a cart deletes the `RentalPlanItem` but not the `RentalPlan` itself — the plan stays alive at `status: "DRAFT"` with `items: []`, and (since no route exists to change a plan's dates after creation) keeps its original `startDate`/`endDate`. `findActiveRentalPlan` only excludes `CONVERTED`/`CANCELLED`, so this empty plan still read as "my active plan" — the next add-to-cart with a different date range was wrongly rejected as a real conflict ("Your active rental plan is already set for ... Remove all items first to change dates.") against a plan that had nothing in it.

Fixed in two places:

- **`App.tsx`'s `removeFromCartApi`** now calls `rentalPlanCartApi.cancel(plan.id)` (best-effort) and clears local `planId`/`cart`/`planItemIds` the moment a removal empties the plan, so this can't recur going forward.
- **`CartDrawer.tsx`** now shows the "Cancel rental plan" link even when the cart is empty (previously gated behind `cart.length > 0`), as a manual recovery path for any plan that's already in this state — including sessions already affected before the fix above shipped.

## 6. Manual Validation Checklist

- [ ] `npm run dev:mock` — open the cart, proceed to deposit: no "Checking live pricing…", no "Smart Priced" badge, no behavior change from before this work (mock mode never calls `onGetQuote`).
- [ ] `npm run dev:api` against a backend with `pricing.dynamic-enabled=false` (or unset) — quote fetch succeeds, but `dailyRate === baseDailyRate`, so no badge shows and the summary figures match the pre-quote client estimate. Confirms "off" and "on-but-fell-back" are indistinguishable, as designed.
- [ ] Same, with `pricing.dynamic-enabled=true` and `haystack-fast-api` actually reachable — badge appears on any item whose model price differs from base rate; Subtotal/GST/Total/Deposit switch to the quoted total once it resolves.
- [ ] Slow-network / throttled quote call — "Checking live pricing…" shows, "Continue to Payment" stays enabled and clickable throughout.
- [ ] Complete a real payment in API mode with dynamic pricing on — confirm the amount actually charged (Stripe deposit intent amount, and the created `Booking.totalAmount`) matches what the summary displayed, not the flat base-rate total.
- [ ] Add an item, remove it (cart now empty), then try adding a different date range — succeeds without the stale "already set for ..." error.
- [ ] With a cart already emptied under the *old* code (a leftover empty-but-active plan), open the cart drawer — "Cancel rental plan" is visible and clears it.

## 7. Change Log

- 2026-08-15: Initial implementation — `rentalPlanCartApi.quote()`, quote fetch + loading state + "Smart Priced" badge in `DepositCheckout.tsx`, wired from `App.tsx`.
- 2026-08-15: Follow-up — summary dollar figures (`displayDailyRate`/`displayTotal`) now reflect the resolved quote instead of only the badge; previously the badge could sit next to numbers still computed from the base rate.
- 2026-08-15: Follow-up — closed the charge-vs-display gap: `onBeginPayment` now re-quotes and converts via `rentalPlanId` (`createBookingFromPlan`) instead of `createDepositBooking()`'s raw `items`/dates, which priced the booking independently of anything shown at checkout. Removed the now-unused `createDepositBooking`/`CreateBookingRequest`.
- 2026-08-15: Bug fix (§5) — emptying a cart via item removal left a stale, date-locked, still-"active" plan blocking new date ranges; `removeFromCartApi` now auto-cancels an emptied plan, and `CartDrawer` offers "Cancel rental plan" as a recovery path even with an empty cart.
- 2026-08-15: Automated coverage — `src/features/checkout/DepositCheckout.test.tsx` (new: mode gating, loading indicator, badge shown/not-shown, summary figures switching to the quoted total, checkout never blocked on a pending quote) and two new cases in `src/features/checkout/CartDrawer.test.tsx` (empty-cart cancel-link shown/hidden). `tsc --noEmit`, `eslint .`, and the full suite verified green throughout. Manually driven in a real browser (Playwright) for the mock-mode regression path (login → cart → checkout → payment → confirmation, zero console errors); the API-mode dynamic-pricing path itself could not be exercised live in that environment — no Spring backend was available to connect to.
