# Specification: Customer Portal Bugfixes — Checkout Subtotal, Equipment Images, Login Auth, Stale Rental Plans

| Field | Value |
|-------|--------|
| **Feature** | Customer Portal — Deposit Checkout Subtotal Desync, Unsplash Image Requests, `/api/users` 403 on Non-Admin Login, and Post-Conversion Rental Plan Recovery |
| **Status** | Implemented — CHANGE-01 through CHANGE-04 completed |
| **Module** | `heavy-rental-web-portal` |
| **Primary surfaces** | Deposit checkout summary (`src/features/checkout/DepositCheckout.tsx`); equipment catalog/detail images (`src/features/browse/equipmentImageSrc.ts`, `EquipmentGrid.tsx`, `src/features/customer/EquipmentDetailPage.tsx`, `src/app/assetRecord.ts`); login (`src/App.tsx`); checkout/cart (`src/features/customer/CustomerPortal.tsx`) |
| **Method** | Manual bug reports (screenshots of the live app / browser console) reproduced against the real Spring Boot backend (`heavy-rental-rest-api`) in `npm run dev:api` mode; each fix verified with `npx tsc --noEmit` and `npx eslint` |
| **Environment context** | [`Spec-dynamic-pricing-e2e.md`](./Spec-dynamic-pricing-e2e.md) and [`features/Spec-rental-plan-cart-checkout.md`](./features/Spec-rental-plan-cart-checkout.md) (the quote/`totalAmount` and `RentalPlan` → `Booking` conversion model CHANGE-01 and CHANGE-04 patch); [`Spec-rest-api-reference.md`](./Spec-rest-api-reference.md) §2.7 (documents `/api/users` as `ROLE_ADMIN`-only, source for CHANGE-03) |

This document records four unrelated bugs found via manual testing across one session, bundled into a single document at the user's request rather than filed separately: a pricing-display desync in the deposit checkout summary, a malformed-URL bug in equipment image rendering, a guaranteed-403 network call on every non-admin login, and a stuck-checkout bug where a customer's local cart/plan state survives past the point their rental plan converts to a real booking.

---

## 1. Outcomes

When these changes are correct:

1. The Subtotal shown in the Booking Summary modal (Step 1 of 2) always equals the sum of the "Reserved Equipment" line items directly above it — GST, Total Payable, Deposit Due Now, and Balance Due all stay internally consistent with what the customer can see on the same screen (CHANGE-01).
2. Equipment images (catalog grid, detail page, admin asset records) never send a malformed request to Unsplash — an `img` value that isn't a recognizable Unsplash photo id, a `data:` URI, or an absolute URL is treated as "no photo" instead of being concatenated into the request path (CHANGE-02).
3. Logging in as a customer or employee (API mode) no longer fires a doomed `GET /api/users` call that always 403s — only admin logins attempt it (CHANGE-03).
4. Once a rental plan has converted to a booking (deposit paid, or an interrupted/retried checkout already converted it server-side), the customer is never stuck: retrying checkout or "Cancel rental plan" against that dead plan self-heals the local cart, and a successful payment proactively clears the plan reference so the very next item added starts a fresh plan instead of failing against the old one (CHANGE-04).

---

## 2. Scope

### 2.1 In scope

- `DepositCheckout.tsx`'s `displayTotal` calculation and its now-unused `totalCost` prop.
- `equipmentImageSrc.ts`'s photo-id validation and its use (or lack of use) in `EquipmentGrid.tsx`, `EquipmentDetailPage.tsx`, and `assetRecord.ts`.
- `App.tsx`'s `handleLogin` → `resolveUserId()` call site.
- `CustomerPortal.tsx`'s `onBeginPayment`, `cancelPlanApi`, and `onPaid` handlers, specifically their handling of `planId`/`planItemIds`/`cart` around plan conversion.

### 2.2 Out of scope

- Whether the backend's `POST /rentalPlans/{id}/quote` response itself ever returns a `totalAmount` inconsistent with the sum of its own items' `subtotal` fields — per contract, `totalAmount` is defined as exactly that sum, so if the backend response disagrees with its own items that's a backend defect, outside this (frontend-only) repo. CHANGE-01 makes the frontend internally consistent regardless.
- Whether `GET /api/users` should be restricted to `ROLE_ADMIN` at all — that's an existing, confirmed backend decision (`Spec-rest-api-reference.md` §2.7), not something this frontend-only repo can or should change.
- Wiring "My Rental Plans" to the real backend's `RentalPlanResponse` shape — customer `userId` staying `null` in API mode (a consequence of CHANGE-03, but not a regression it introduces) leaves that view non-functional in API mode, which it already was for unrelated reasons (`buildRentalPlanViews` parses the mock server's `RentalPlan` shape, not the real backend's).
- Whatever is causing intermittent `net::ERR_INCOMPLETE_CHUNKED_ENCODING` / `Failed to fetch` / Unsplash `502`s observed separately in the same session — investigated live (backend and Unsplash both responded normally on retest), inconclusive, not a frontend code change. Flagged for separate follow-up once/if it reproduces again.

---

## 3. Changes

### CHANGE-01: Deposit checkout Subtotal desynced from the displayed line item

**GIVEN** a customer opens the Booking Summary modal for a cart whose active quote has resolved (API mode, `pricing.dynamic-enabled` on)
**WHEN** the quoted per-unit rate differs from the flat listed rate (the "Smart Priced" case)
**THEN** the "Reserved Equipment" line item correctly showed `days × quoted dailyRate` (e.g. S$858.12 for a 2-day rental), but the Subtotal below it was read directly off `quote.totalAmount` — which, observed live, came back equal to a single item's `dailyRate` rather than `dailyRate × days` (S$429.06, exactly half of the line item above it).

**Symptom**: Subtotal, GST (9% of Subtotal), Total Payable, Deposit Due Now, and Balance Due were all computed from the wrong base and so were all off by the same factor — visibly contradicting the "Reserved Equipment" line item shown two lines above them on the same screen.

**Change**: `displayTotal` (`DepositCheckout.tsx`) no longer reads `quote?.totalAmount ?? totalCost`. It's summed directly from the same per-item `days × displayDailyRate(...)` expression already used to render each "Reserved Equipment" line:

```ts
const displayTotal = cart.reduce(
  (s, c) =>
    s +
    daysBetweenISO(c.startDate, c.endDate) *
      displayDailyRate(c.equipment.id, c.equipment.baseDailyRate),
  0,
);
```

`displayDailyRate` itself is unchanged — it already falls back from the quoted `dailyRate` to the cart's client-side `baseDailyRate` while the quote is loading, failed, or outside API mode. Because `totalCost` (the plan-level client-side estimate previously used as the `quote`-unresolved fallback) became unused once `displayTotal` was self-sufficient, the now-dead `totalCost` prop was removed from `DepositCheckout`'s props and from its call site in `CustomerPortal.tsx`.

### CHANGE-02: Equipment images sent malformed requests to Unsplash (414 / 502)

**GIVEN** an `Asset.img` value that is neither a `data:` URI nor a recognizable Unsplash photo id (e.g. a `data:` URI that lost its prefix, a stray/oversized string, a raw base64 blob)
**WHEN** the equipment catalog grid, equipment detail page, or admin asset records rendered its image
**THEN** `EquipmentGrid.tsx` and `EquipmentDetailPage.tsx` built the `<img src>` by checking only `img.startsWith("data:")` — anything else was concatenated directly onto `https://images.unsplash.com/${img}?...`, and `assetRecord.ts`'s `resolvePhoto()` additionally prepended a second `"photo-"` prefix onto a value that already had one (confirmed against `mock/db.json`, whose `img` values already read `"photo-<id>"`).

**Symptom**: browser console filled with `Failed to load resource: the server responded with a status of 414` (URI Too Long — the oversized-string case) and `502` (Unsplash's edge rejecting a malformed path) for the catalog/detail images; the admin Fleet/Assets views additionally 404'd on `photo-photo-...` doubled-prefix URLs.

**Change**: `equipmentImageSrc.ts` already validated the photo-id shape correctly (`/^photo-[a-z0-9-]+$/i`, tested in `equipmentImageSrc.test.ts`) but wasn't used everywhere. The fix was to route every call site through it (or its newly-exported shape check) instead of each re-implementing a weaker inline guard:

- `equipmentImageSrc.ts` — extracted the regex check into an exported `isUnsplashPhotoId(img): boolean`, so call sites needing custom query params (below) can still validate before building their own URL.
- `EquipmentGrid.tsx:93-99` — catalog thumbnail now calls `equipmentImageSrc(item.img, 600, 340)`, rendering no `<img>` at all when it returns `null` instead of sending a malformed request.
- `EquipmentDetailPage.tsx:171-176` — main detail image now uses `equipmentImageSrc(detailItem.img, 900, 520)` the same way.
- `EquipmentDetailPage.tsx:206-230` — the three crop-variant thumbnails (which need custom `crop=` query params `equipmentImageSrc` doesn't support) now gate on `detailItem.img.startsWith("data:") || isUnsplashPhotoId(detailItem.img)` before building their own URL, instead of only checking for `data:`.
- `assetRecord.ts:39-48` — `resolvePhoto()` now uses `isUnsplashPhotoId()` and no longer prepends a second `"photo-"` (the value already carries it); falls back to `""` — not `null` — for anything invalid, since the admin/employee views that consume `AssetRecord.photo`/`FleetAsset.photo` (`FleetTab.tsx`, `AssetsTab.tsx`, `EmployeeAssetsTab.tsx`) already do a truthy check (`a.photo && (...)`) for their "no photo" fallback UI, and that field is typed as non-nullable `string`.

### CHANGE-03: `GET /api/users` 403s on every customer/employee login

**GIVEN** a customer or employee logs in against the real backend (API mode)
**WHEN** `App.tsx`'s `handleLogin` runs `resolveUserId()` to look up a numeric `userId` by matching the logged-in email against `GET /api/users`
**THEN** the call always 403'd — confirmed against `Spec-rest-api-reference.md` §2.7, the entire `/api/users` route family is `ROLE_ADMIN`-only server-side, but `resolveUserId()` was called unconditionally for every role. The failure was already caught and silently downgraded to `id: null` (pre-existing behavior, unchanged by this fix), so there was no functional break — only console noise and a wasted round trip on every non-admin login.

**Symptom**: `Failed to load resource: the server responded with a status of 403 (Forbidden)` for `:5173/api/users` on every customer/employee login.

**Change**: `App.tsx:94` — the API-mode branch now only calls `resolveUserId()` for `role === "admin"`; customer/employee logins skip straight to `id: null`, which was already the only possible outcome for them. No functional change for any role — admin logins still resolve normally, and non-admin `userId` was already always `null`.

### CHANGE-04: Customer stuck once a rental plan converts to a booking

**GIVEN** a rental plan has already converted to a `Booking` server-side (a successful checkout, or an earlier attempt whose payment was interrupted/declined after the booking itself was already created)
**WHEN** the customer retries "Continue to Payment" or "Cancel rental plan" against that same plan, or (after a *successful* payment) selects new equipment for what should be a fresh plan
**THEN** every one of those paths failed against the dead plan with no recovery:
  - `quoteRentalPlan()`/`createBookingFromPlan()` and `rentalPlanCartApi.cancel()` all 409 with `already_converted` for a `CONVERTED` plan (backend contract, not new) — but nothing in the frontend detected this specific case, so `beginError`/`cartDateError` just kept re-showing the raw backend error on every retry, with `planId` never cleared.
  - Separately, a **successful** payment's `onPaid` handler (`CustomerPortal.tsx`) cleared `cart`, `siteAddress`, and the shared dates, but never `planId`/`planItemIds`. The next equipment the customer selected routed through `ensureApiRentalPlanId`'s `planId !== null` fast path straight back to the now-CONVERTED plan, so every `addItem` against it 409'd — meaning *any* attempt to start a new booking right after finishing one was broken, not just the retry-after-failure case above.

**Symptom**: "Booking Summary" modal permanently showing `Plan has already been converted to a booking` with no way to proceed; separately, selecting equipment for a new plan immediately after a completed payment threw an error for every item added.

**Change**, three parts, all in `CustomerPortal.tsx`:
1. **`onBeginPayment` self-heal** (`CustomerPortal.tsx:1019-1038`) — wraps the re-quote + `createBookingFromPlan` calls in a `try`/`catch`; on `ApiError` with `code === "already_converted"`, clears `cart`/`planItemIds`/`planId` and rethrows a clearer message pointing the customer at My Rental Plans, instead of leaving the stale state in place for the next retry to fail against again.
2. **`cancelPlanApi` self-heal** (`CustomerPortal.tsx:528-538`) — same detection and same local-state clear in the "Cancel rental plan" catch path, since that call fails against a `CONVERTED` plan for the identical reason.
3. **`onPaid` proactive reset** (`CustomerPortal.tsx:1052-1064`) — the *successful*-payment branch now also resets `planId`/`planItemIds` alongside the fields it already cleared (`cart`, `siteAddress`, `sitePostalCode`, `deliveryNotes`, `siteAddressPrompted`, `sharedStartDate`, `sharedEndDate`), so the very next `addToCart` creates a brand-new plan instead of retrying the one that just converted.

`ApiError` (already defined in `app/api.ts` for exactly this `{code, message}` envelope) is now imported into `CustomerPortal.tsx` to support the `code === "already_converted"` checks in parts 1 and 2.

---

## 4. Known approximations & follow-ups

1. **CHANGE-01** doesn't investigate *why* the backend's `quote.totalAmount` didn't match `dailyRate × days` server-side — see §2.2. Per-item `subtotal` (already present on `RentalPlanItemResponse`) is also still not read directly by either the line item or `displayTotal`, both of which recompute `days × dailyRate` client-side instead — pre-existing behavior, left as-is since it wasn't the source of the desync.
2. **CHANGE-02** doesn't change what happens once an admin *does* upload a real `data:` URI photo that's valid but very large — that path already worked (browsers render large `data:` URIs directly, no network request involved) and wasn't touched.
3. **CHANGE-03** leaves customer/employee `userId` permanently `null` in API mode, same as before this fix — "My Rental Plans" was already non-functional against the real backend for the unrelated reason noted in §2.2, so this fix doesn't make that better or worse.
4. **CHANGE-04** doesn't address *why* a booking's payment can be interrupted after the booking is already created (e.g. a declined Stripe card, or the customer closing the tab between `onBeginPayment` succeeding and `onPaid` firing) — that gap is inherent to the two-step booking-then-pay flow (`STRIPE_INTEGRATION_HANDOFF.md`) and out of scope here; this fix only ensures the *next* attempt recovers cleanly rather than getting permanently stuck.
5. The separate connectivity symptoms noticed in the same session (`net::ERR_INCOMPLETE_CHUNKED_ENCODING` on `/api/assets`, a "Couldn't reach the equipment catalog — Failed to fetch" error, and a batch of Unsplash `502`s) did not reproduce on manual retest (backend and Unsplash both responded normally, repeatedly, when checked directly) — left uninvestigated further pending a live reproduction; not a code change in this document.

---

## 5. Design

- CHANGE-01 follows the same shape as the equipment line item already on screen: rather than introduce a second source of truth (`quote.totalAmount`) that can silently drift from the first (the per-item `days × dailyRate` figures), `displayTotal` is now derived from the same expression, so the two can't visibly disagree.
- CHANGE-02 consolidates on the one already-tested validation helper (`equipmentImageSrc`/`isUnsplashPhotoId`) instead of leaving each call site to reimplement (and under-implement) its own `data:`-only guard.
- CHANGE-03 is a minimal, behavior-preserving fix: it removes a call that could never succeed for two of the three roles, without changing what any role ends up with.
- CHANGE-04 treats `already_converted` as a recognized, recoverable case rather than a generic error — the fix is deliberately duplicated across three call sites (`onBeginPayment`, `cancelPlanApi`, `onPaid`) rather than pulled into one shared helper, since two are reactive (catch a specific error and recover) and one is proactive (avoid the error in the first place); each needed a different trigger even though the recovery (`clear cart/planId/planItemIds`) is identical.

---

## 6. Verification

### 6.1 Checklist

- [x] CHANGE-01: `npx tsc --noEmit` and `npx eslint` clean; manually verified against the screenshot report that Subtotal now equals the sum of the "Reserved Equipment" line items, with GST/Total Payable/Deposit/Balance recalculating consistently off the corrected value
- [x] CHANGE-02: `npx tsc --noEmit` and `npx eslint` clean; `equipmentImageSrc.test.ts` (3 cases) still passes unmodified
- [x] CHANGE-03: `npx tsc --noEmit` and `npx eslint` clean
- [x] CHANGE-04: `npx tsc --noEmit` and `npx eslint` clean

### 6.2 Manual smoke test

1. **CHANGE-01**: Run `npm run dev:api` with `pricing.dynamic-enabled` on, add an item whose quoted rate differs from its flat listed rate (triggers "Smart Priced"), open the Booking Summary modal, and confirm Subtotal/GST/Total Payable/Deposit/Balance are all consistent with the "Reserved Equipment" line items above them. Repeat with 2+ items to confirm the sum, not just a single-item case.
2. **CHANGE-02**: In API mode, browse the equipment catalog and open a detail page for an item whose `img` is a valid photo id — images load normally. (Reproducing the malformed-value case requires an `img` value that violates the expected shape, which isn't producible from the current UI — validated via `equipmentImageSrc.test.ts`'s existing "not-a-photo" case instead.)
3. **CHANGE-03**: Log in as a customer (`alex.tan@example.sg`) and as an admin (`ravi.kumar@example.sg`) in API mode. Confirm no `/api/users` request fires for the customer login, and confirm it still fires (and succeeds) for the admin login.
4. **CHANGE-04**: Complete a full checkout (deposit paid). Immediately select a new piece of equipment for a new booking — confirm it adds without error. Separately, reproduce a stuck `already_converted` state (e.g. retry "Continue to Payment" after a plan has already converted) and confirm the cart clears itself with an actionable message instead of repeating the raw backend error.

---

## 7. Key decisions

| Decision | Rationale |
|----------|-----------|
| Derive `displayTotal` from the same per-item expression as the line items, instead of trusting `quote.totalAmount` | Two independent sources for what should be the same number is exactly what let them drift apart; deriving one from the other closes the gap regardless of whether the backend field itself is later found to be buggy. |
| Route every image call site through `equipmentImageSrc`/`isUnsplashPhotoId` instead of leaving inline guards | Multiple independent, weaker reimplementations of the same check is exactly how CHANGE-02 happened in three different files; one validated helper closes all of them at once. |
| Skip `resolveUserId()` entirely for non-admin roles, rather than catching-and-ignoring more quietly | The call can never succeed for those roles (confirmed backend restriction) — not making a doomed request is strictly better than making one and swallowing its failure. |
| Duplicate the `already_converted` recovery logic across three call sites instead of extracting a shared helper | Two sites are reactive (inside a `catch`) and one is proactive (inside a success branch) — the trigger conditions differ enough that a shared helper would mostly just be the three-line `setCart([]); setPlanItemIds({}); setPlanId(null);` body, which isn't worth abstracting over. |
| `resolvePhoto()` falls back to `""`, not `null` | `FleetAsset.photo`/`AssetRecord.photo` are typed as non-nullable `string`, and existing admin/employee views already treat falsy `photo` as "no photo" — matching that convention avoided touching three more files' render logic. |
| Bundle all four bugs into one document | Not one coherent theme (pricing, images, auth, and cart/plan state are unrelated surfaces), but fixed in the same session — combined at the user's explicit request rather than filed as separate specs. |

---

## 8. Change control

| Version | Date | Notes |
|---------|------|--------|
| 0.1.0 | 2026-08-18 | Combined from two earlier same-session drafts (`Spec-deposit-checkout-subtotal-desync-fix.md` and `Spec-image-auth-and-stale-plan-fixes.md`, both superseded and removed by this document) into one file per user request. Documents CHANGE-01 (Booking Summary Subtotal desynced from the displayed line item), CHANGE-02 (malformed Unsplash image requests from unvalidated `Asset.img` values), CHANGE-03 (`GET /api/users` 403ing on every non-admin login), and CHANGE-04 (customers getting stuck once a rental plan converts to a booking, both on retry and proactively after a successful payment). All verified with `npx tsc --noEmit` / `npx eslint`. |
