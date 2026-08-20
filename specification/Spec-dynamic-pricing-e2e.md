# Specification: Dynamic (ML) Pricing — Frontend Wiring

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-15
**Status**: Live — quote display + charge-vs-display consistency shipped 2026-08-15; single-quote checkout + reactive stale-quote confirmation shipped 2026-08-20 (HR-205, §4.5/§4.6)
**Purpose**: Document the frontend's response to the backend's dynamic-pricing rollout on `POST /api/rentalPlans/{id}/quote` — showing a "Smart Priced" indicator when the ML price differs from the flat base rate, and making sure the amount the customer sees and the amount actually charged never diverge.

## 1. Background

The Spring backend (`heavy-rental-spring-rest-api`) can price each rental-plan line item via a live ML model (`haystack-fast-api`) instead of always using `Asset.baseDailyRate` arithmetic, controlled by a backend-only flag `pricing.dynamic-enabled` — `false` in every environment by default at the time this was built. No API contract changed: `RentalPlanItemResponse.dailyRate`/`.subtotal` and `RentalPlanResponse.totalAmount` may reflect the ML price instead of the base rate when the flag is on, but field names/types/meaning are unchanged, and the backend silently falls back to base-rate arithmetic if dynamic pricing is unavailable for any reason (Haystack unreachable, timeout, etc.) — a quote never fails or hangs because of this. This was communicated to the frontend team via an ephemeral handoff document (not retained in this repo); this spec is the durable record of what the frontend did about it.

This reverses `api-contract-for-frontend.md` §4's 2026-08-14 clarification that `POST /rentalPlans/{id}/quote` was "Spring-only arithmetic... with no HTTP call to Haystack" — that was correct as of that date; the Haystack-backed path has since been built and shipped behind the flag above. See the Change Log entries added to that file and to `Spec-rental-plan-cart-checkout.md` on 2026-08-15.

**Prerequisite this spec assumes (and does not change):** `Spec-rental-plan-cart-checkout.md` PR 1 — the cart is a persisted `RentalPlan` (`rentalPlanCartApi`), not ephemeral client state. Everything below is API-mode only (`MODE === "api"`); mock mode has no `/quote` route and is untouched.

## 2. Scope

### In scope

- `src/app/api.ts` — `rentalPlanCartApi.quote()`, `createBookingFromPlan()`/`CreateBookingFromPlanRequest` (replacing `createDepositBooking()`/`CreateBookingRequest`).
- `src/features/checkout/DepositCheckout.tsx` — quote fetch + loading state, "Smart Priced" badge, summary dollar figures reflecting the resolved quote.
- `src/App.tsx` — wiring `onGetQuote`, and rewiring `onBeginPayment` to convert the plan via `rentalPlanId` instead of raw `items`/dates. **Superseded 2026-08-15**: this wiring lives in `src/features/customer/CustomerPortal.tsx` today, not `App.tsx` — see §4.5's note.
- `src/features/checkout/CartDrawer.tsx` — incidental bug fix surfaced while testing this (§5).
- **Added 2026-08-20 (HR-205)**: `src/features/checkout/quoteStaleness.ts` (new — `QuoteStaleError`/`isQuoteStaleCode`), `onBeginPayment`'s conversion logic (`CustomerPortal.tsx`), and a new "price changed" confirmation step in `DepositCheckout.tsx` — see §4.5/§4.6.

### Out of scope (deliberately deferred — see `Spec-rental-plan-cart-checkout.md` PR 2/PR 3)

- 24-hour quote-validity UI (`updatedAt`-based staleness check, "quote expired — get a new one") — **superseded 2026-08-20 (HR-205)**: not built as a client-side clock check, but the equivalent outcome is now covered reactively — the backend enforces the 24h window itself (`api-contract-for-frontend.md` §6, `409 quote_expired`) and the frontend responds with an explicit "quote expired, here's the new price" confirmation step. See §4.5/§4.6.
- ~~Branching checkout UI on the `quote_not_ready`/`quote_expired`/`conflict` error taxonomy (`api-contract-for-frontend.md` §5.4) — a failed conversion surfaces as a generic message via `DepositCheckout`'s existing `beginError` state instead.~~ **Superseded 2026-08-20 (HR-205)**: `quote_not_ready`/`quote_expired` are now branched on explicitly — see §4.5/§4.6. `conflict` (rare double-submit race) is unchanged and still surfaces as a generic `beginError` message; deliberately not distinguished, since it isn't a pricing issue.
- Any change to `ConfirmationScreen.tsx`.
- Backend work (the Haystack integration itself, the flag, or `haystack-fast-api`) — this spec only covers the frontend's response to it.

## 3. Where it shows, and when it's fetched

Opening the deposit-checkout modal (**"Proceed to Deposit"** in `CartDrawer.tsx`) mounts `DepositCheckout`, whose Step 1 ("BOOKING SUMMARY") is shown by default. A `useEffect` fires on that mount — not on any further click — calling `onGetQuote()` (`App.tsx` → `rentalPlanCartApi.quote(planId)`) if in API mode and a plan exists (`DepositCheckout.tsx:134`). Nothing about this blocks the rest of the UI: `quoteLoading`'s initial value is computed synchronously via a lazy `useState` initializer (not set inside the effect body) so the loading indicator is correct on the very first paint, and a failed/slow quote never disables "Continue to Payment".

**Superseded 2026-08-20 (HR-205).** "Continue to Payment" previously triggered a second, silent, UI-invisible quote fetch on every click (`onBeginPayment` unconditionally re-quoted before converting) — this caused the Subtotal shown on the summary step and the deposit charged on the Stripe step to be computed from two different quote snapshots, which could disagree without any indication to the customer. As of HR-205, "Continue to Payment" attempts conversion directly against the price already on screen, with **no** pre-emptive quote fetch; a second quote fetch only happens reactively, and is never silent. See §4.5/§4.6.

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

**Note:** the `displayTotal` snippet above is itself stale as of 2026-08-18 — `quote?.totalAmount` was found to disagree with the per-item line total live (`Spec-customer-portal-bugfixes.md` CHANGE-01) and `displayTotal` was changed to sum `days × displayDailyRate(...)` directly instead of trusting `quote.totalAmount`. Not re-fixed here (out of scope for this pass) — see that spec for the current implementation. §4.6's new `totalFromQuote(q)` helper (HR-205) is the same cart-summed logic, factored out so it can price both `quote` and a candidate re-quote consistently.

### 4.5 Booking conversion uses the quoted plan, not raw items (`CustomerPortal.tsx`, `src/app/api.ts`)

Previously, `onBeginPayment` called `createDepositBooking({ items: [...], startDate, endDate, siteAddress, deliveryNotes })` — pricing computed server-side from scratch off raw asset IDs and dates, completely independent of anything shown on the summary screen. This is what let the summary *display* a dynamic price while still *charging* the flat base-rate price once dynamic pricing went live.

`createDepositBooking()`/`CreateBookingRequest` were removed (no remaining callers) in favor of `createBookingFromPlan()`/`CreateBookingFromPlanRequest`, matching `api-contract-for-frontend.md` §5's `{ rentalPlanId, siteAddress, deliveryNotes }` shape — items/dates are derived server-side from the plan and ignored if sent. The response's `totalAmount` is guaranteed to equal the plan's quoted amount exactly, closing the gap.

**Superseded 2026-08-20 (HR-205).** The snippet that shipped 2026-08-15 unconditionally re-quoted (`await rentalPlanCartApi.quote(planId)`) before every single conversion attempt, specifically to guarantee the plan was `QUOTED` and to paper over the fact that branching on `quote_not_ready`/`quote_expired` wasn't built yet. That forced re-quote is what caused the bug this revision fixes: it silently produced a second, independent price snapshot that could differ from the one already on screen (dynamic/Haystack pricing is a live model, not a cache — it can return a different number seconds apart), and nothing reconciled the two, so the Subtotal shown pre-payment and the deposit charged on the Stripe step could visibly disagree.

Now, `onBeginPayment` (`CustomerPortal.tsx:987-1045`) attempts conversion directly, with no pre-emptive quote call:

```ts
if (planId === null) {
  throw new Error("Your rental plan couldn't be found — please refresh and try again.");
}
try {
  const booking = await createBookingFromPlan({
    rentalPlanId: planId,
    siteAddress,
    deliveryNotes: deliveryNotes || undefined,
  });
  const intent = await paymentApi.createDepositIntent(booking.bookingId);
  return { bookingId: booking.bookingId, clientSecret: intent.clientSecret,
           paymentIntentId: intent.paymentIntentId, depositAmount: booking.depositAmount };
} catch (err) {
  if (err instanceof ApiError && isQuoteStaleCode(err.code)) {
    // 409 quote_not_ready or quote_expired — re-quote once, then hand the fresh plan
    // back as a typed error rather than retrying automatically. quoteRentalPlan()
    // dedupes against any still-in-flight DepositCheckout onGetQuote() call (§4.2).
    const refreshed = await quoteRentalPlan(planId);
    throw new QuoteStaleError(refreshed, err.code);
  }
  // already_converted / conflict / anything else — unchanged, see
  // Spec-customer-portal-bugfixes.md CHANGE-04 and §2 Out of scope above.
  throw err;
}
```

For the overwhelming majority of checkouts (quote is seconds-to-minutes old, well under the backend's 24h window), this succeeds immediately at the exact price already shown on the summary step — one price, no second fetch, no flicker. A quote fetch only happens again if the backend actually rejects the attempt — see §4.6 for what the customer sees when that happens. `quoteRentalPlan()`'s dedup wrapper (`CustomerPortal.tsx`, backed by a `useRef<Promise<RentalPlanResponse> | null>`, added 2026-08-17 per `postal-code-validation-execution-plan.md` §"Bugs found during Phase 2") is unchanged and still required — it's just invoked far less often now, only on a confirmed stale rejection rather than on every "Continue to Payment" click.

**Now done** (previously listed as "Not done" here, and as "Out of scope" in §2): branching on `quote_not_ready`/`quote_expired` — see §4.6. `conflict` (rare double-submit race) remains unbranched by design — it surfaces as a generic error via the existing `beginError` UI, since it isn't a pricing issue and the pre-existing dedup guard (`quoteRentalPlan()`, and `handleContinue`'s `apiPayment` check) already makes it rare.

### 4.6 "Price Updated" confirmation step (`DepositCheckout.tsx`, new 2026-08-20, HR-205)

When `onBeginPayment` rejects with a `QuoteStaleError` (`src/features/checkout/quoteStaleness.ts`), `DepositCheckout`'s step machine (`"summary" | "price_changed" | "payment" | "processing" | "failed"`) moves to a new `"price_changed"` step instead of surfacing the rejection through the generic `beginError` text. This step shows the previous Subtotal/Deposit (from the `quote` state already on screen) side by side with the updated Subtotal/Deposit (from `err.refreshedQuote`, the plan the backend just re-quoted), with body copy that differs for the two reasons (`"Your quote has expired — here's the current price."` for `quote_expired`, a plan-not-yet-quoted message for `quote_not_ready`).

The customer must explicitly click **"Confirm New Price & Continue"** before anything is retried — declining (**"← Back to Summary"**) returns to the original summary screen with the original, unchanged price, and does not call `onBeginPayment` again. This is the deliberate design choice from this feature's planning discussion: a second price is only ever shown with a stated reason and requires explicit consent, never a silent swap. Confirming syncs the component's `quote` state to the refreshed plan *before* retrying `onBeginPayment`, so every other figure that derives from `quote` (GST, Total Payable, Balance Due — see §4.4) updates in lockstep with the deposit, not just the deposit alone.

Covered by `src/features/checkout/DepositCheckout.test.tsx` ("DepositCheckout — booking conversion retry" describe block) and `src/features/checkout/quoteStaleness.test.ts`.

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
- [ ] **(2026-08-20, HR-205)** `npm run dev:api`, dynamic pricing on — proceed to deposit, wait a few seconds without editing anything, click "Continue to Payment": lands directly on the Stripe payment step with the *same* deposit figure shown on the summary step (no intermediate "Price Updated" screen), and `POST /rentalPlans/{id}/quote` fires exactly once in the network tab (the mount-time quote), not twice.
- [ ] Force a `quote_not_ready`/`quote_expired` rejection (e.g. a plan that's genuinely never been quoted, or wait out the backend's 24h window on a `QUOTED` plan) and click "Continue to Payment" — the "Price Updated" step appears with distinct old/new Subtotal and Deposit figures and reason-specific copy; clicking "Confirm New Price & Continue" retries and lands on the Stripe step with the new deposit; clicking "← Back to Summary" instead returns to the original, unchanged summary price without retrying.
- [ ] Confirm a `409 conflict` (unrelated to pricing) still surfaces via the existing generic `beginError` message on the summary step, not the "Price Updated" step.
- [ ] **Spot-check the live/staging backend** (not just the mock/local contract): confirm `POST /api/bookings` actually returns the distinct `quote_not_ready`/`quote_expired` error codes rather than the older generic `conflict` (`api-contract-for-frontend.md` §6 notes these codes "did not exist before" a backend change) — if the backend hasn't shipped them yet, a stale quote will fall through to the generic `beginError` path instead of the new confirmation step, silently disabling this feature rather than breaking anything.

## 7. Change Log

- 2026-08-15: Initial implementation — `rentalPlanCartApi.quote()`, quote fetch + loading state + "Smart Priced" badge in `DepositCheckout.tsx`, wired from `App.tsx`.
- 2026-08-15: Follow-up — summary dollar figures (`displayDailyRate`/`displayTotal`) now reflect the resolved quote instead of only the badge; previously the badge could sit next to numbers still computed from the base rate.
- 2026-08-15: Follow-up — closed the charge-vs-display gap: `onBeginPayment` now re-quotes and converts via `rentalPlanId` (`createBookingFromPlan`) instead of `createDepositBooking()`'s raw `items`/dates, which priced the booking independently of anything shown at checkout. Removed the now-unused `createDepositBooking`/`CreateBookingRequest`.
- 2026-08-15: Bug fix (§5) — emptying a cart via item removal left a stale, date-locked, still-"active" plan blocking new date ranges; `removeFromCartApi` now auto-cancels an emptied plan, and `CartDrawer` offers "Cancel rental plan" as a recovery path even with an empty cart.
- 2026-08-15: Automated coverage — `src/features/checkout/DepositCheckout.test.tsx` (new: mode gating, loading indicator, badge shown/not-shown, summary figures switching to the quoted total, checkout never blocked on a pending quote) and two new cases in `src/features/checkout/CartDrawer.test.tsx` (empty-cart cancel-link shown/hidden). `tsc --noEmit`, `eslint .`, and the full suite verified green throughout. Manually driven in a real browser (Playwright) for the mock-mode regression path (login → cart → checkout → payment → confirmation, zero console errors); the API-mode dynamic-pricing path itself could not be exercised live in that environment — no Spring backend was available to connect to.
- 2026-08-20 (HR-205): **Fixed the checkout double-quote/mismatched-price bug** this spec's original design left open (§3, §4.5 above superseded in place; §2 Out-of-scope items resolved). Root cause: `onBeginPayment`'s unconditional pre-conversion re-quote (added 2026-08-15 to close the charge-vs-display gap) itself produced a second, independent quote snapshot whenever dynamic pricing shifted between mount and click, and nothing reconciled it against the Subtotal already on screen — customers could see e.g. "30% of $X" pre-payment and a visibly different deposit on the Stripe step for the same displayed $X. Fixed by removing the forced re-quote (`onBeginPayment` now attempts `createBookingFromPlan` directly) and adding a new, explicit `"price_changed"` step (§4.6) that only appears — and only re-quotes — on an actual `409 quote_not_ready`/`quote_expired` rejection, requiring the customer's confirmation before retrying. New: `src/features/checkout/quoteStaleness.ts` (`QuoteStaleError`, `isQuoteStaleCode`), `src/features/checkout/quoteStaleness.test.ts`. Modified: `src/features/customer/CustomerPortal.tsx` (`onBeginPayment`), `src/features/checkout/DepositCheckout.tsx` (step machine, `attemptBeginPayment`/`handleConfirmStalePrice`/`handleDeclineStalePrice`, new step render), `src/features/checkout/DepositCheckout.test.tsx` (new "booking conversion retry" describe block: happy path, `quote_expired`, `quote_not_ready`, decline-and-return, generic-error-unchanged). `tsc --noEmit`, `eslint .`, and the full suite (95/95) verified green. **Not yet verified**: whether the live/staging Spring backend actually returns the distinct `quote_not_ready`/`quote_expired` codes (vs. the older generic `conflict`) — see the new Manual Validation Checklist item above; until spot-checked, this fix's reactive path may not trigger in practice even though the happy-path fix (no more forced double-quote) is unconditional and doesn't depend on it.
