# Specification: Customer Portal Bugfixes — Checkout Subtotal, Equipment Images, Login Auth, Stale Rental Plans, AI-Recommendation Cart Sync

| Field | Value |
|-------|--------|
| **Feature** | Customer Portal — Deposit Checkout Subtotal Desync, Unsplash Image Requests, `/api/users` 403 on Non-Admin Login, Post-Conversion Rental Plan Recovery, and AI-Recommendation "Add All" Cart/Sync Corruption |
| **Status** | Implemented — CHANGE-01 through CHANGE-07 completed |
| **Module** | `heavy-rental-web-portal` |
| **Primary surfaces** | Deposit checkout summary (`src/features/checkout/DepositCheckout.tsx`); equipment catalog/detail images (`src/features/browse/equipmentImageSrc.ts`, `EquipmentGrid.tsx`, `src/features/customer/EquipmentDetailPage.tsx`, `src/app/assetRecord.ts`); login (`src/App.tsx`); checkout/cart (`src/features/customer/CustomerPortal.tsx`); AI recommendation review (`src/features/browse/onboarding/QuoteResultScreen.tsx`, `src/features/checkout/specsPlan.ts`); customer profile page (`src/features/customer/CustomerProfilePage.tsx`, new `src/features/customer/myBookings.ts`); onboarding mode selection (`src/features/browse/onboarding/ChooseModeScreen.tsx`, `src/app/types.ts`) |
| **Method** | Manual bug reports (screenshots of the live app / browser console) reproduced against the real Spring Boot backend (`heavy-rental-rest-api`) in `npm run dev:api` mode; each fix verified with `npx tsc -b --pretty false` (see note below) and `npx eslint .`; CHANGE-05 additionally covered by a new automated test in `specsPlan.test.ts` |
| **Environment context** | [`Spec-dynamic-pricing-e2e.md`](./Spec-dynamic-pricing-e2e.md) and [`features/Spec-rental-plan-cart-checkout.md`](./features/Spec-rental-plan-cart-checkout.md) (the quote/`totalAmount` and `RentalPlan` → `Booking` conversion model CHANGE-01, CHANGE-04, and CHANGE-05 patch); [`Spec-rest-api-reference.md`](./Spec-rest-api-reference.md) §2.7 (documents `/api/users` as `ROLE_ADMIN`-only, source for CHANGE-03) |

This document records five unrelated bugs found via manual testing across one session, bundled into a single document at the user's request rather than filed separately: a pricing-display desync in the deposit checkout summary, a malformed-URL bug in equipment image rendering, a guaranteed-403 network call on every non-admin login, a stuck-checkout bug where a customer's local cart/plan state survives past the point their rental plan converts to a real booking, and a cart-corruption/missing-sync bug in the AI-recommendation "Add All to Rental Plan" flow.

**Verification command correction (relevant from CHANGE-05 onward):** CHANGE-01 through CHANGE-04 above were verified with plain `npx tsc --noEmit`, which — discovered partway through this session — is a silent no-op against this repo's root `tsconfig.json` (`files: []` with project references; plain `tsc --noEmit` doesn't build referenced projects). That gap let a real regression through: CHANGE-01's removal of `DepositCheckout`'s `totalCost` prop broke `DepositCheckout.test.tsx`, which still passed that prop in six `render()` calls, and no `tsc` run in this document caught it until the project-references-aware command below was used. Fixed at that point (test file updated to drop the removed prop) and confirmed via `npx tsc -b --pretty false`, the command CI's own "Quality Control" job actually runs (`.github/workflows/integration-pipeline.yml`) — this is also the command used to verify CHANGE-05.

---

## 1. Outcomes

When these changes are correct:

1. The Subtotal shown in the Booking Summary modal (Step 1 of 2) always equals the sum of the "Reserved Equipment" line items directly above it — GST, Total Payable, Deposit Due Now, and Balance Due all stay internally consistent with what the customer can see on the same screen (CHANGE-01).
2. Equipment images (catalog grid, detail page, admin asset records) never send a malformed request to Unsplash — an `img` value that isn't a recognizable Unsplash photo id, a `data:` URI, or an absolute URL is treated as "no photo" instead of being concatenated into the request path (CHANGE-02).
3. Logging in as a customer or employee (API mode) no longer fires a doomed `GET /api/users` call that always 403s — only admin logins attempt it (CHANGE-03).
4. Once a rental plan has converted to a booking (deposit paid, or an interrupted/retried checkout already converted it server-side), the customer is never stuck: retrying checkout or "Cancel rental plan" against that dead plan self-heals the local cart, and a successful payment proactively clears the plan reference so the very next item added starts a fresh plan instead of failing against the old one (CHANGE-04).
5. Adding equipment via the AI-recommendation "Add All to Rental Plan" screen never puts two lines for the same equipment into the cart, the Include/Add controls on that screen respond reliably even when two recommendations resolve to the same equipment, and the resulting cart is actually synced to a real backend `RentalPlan` in API mode — so checkout no longer fails with "Your rental plan couldn't be found" (CHANGE-05).
6. The customer profile page shows the signed-in customer's real booking history ("My Bookings," sourced from `GET /bookings`) instead of a permanently-empty "Rental Plan" panel — and, since the real backend already scopes that route to the caller, this works even though a customer's `userId` is always `null` in API mode (CHANGE-06).
7. The onboarding "How can we help you today?" screen only offers two paths — "I Know What I Want" and "I Have Specs, Need a Recommendation" — with the "I'm Just Browsing" option and its now-dead `OnboardingMode` value removed entirely (CHANGE-07).

---

## 2. Scope

### 2.1 In scope

- `DepositCheckout.tsx`'s `displayTotal` calculation and its now-unused `totalCost` prop.
- `equipmentImageSrc.ts`'s photo-id validation and its use (or lack of use) in `EquipmentGrid.tsx`, `EquipmentDetailPage.tsx`, and `assetRecord.ts`.
- `App.tsx`'s `handleLogin` → `resolveUserId()` call site.
- `CustomerPortal.tsx`'s `onBeginPayment`, `cancelPlanApi`, and `onPaid` handlers, specifically their handling of `planId`/`planItemIds`/`cart` around plan conversion.
- `specsPlan.ts`'s `buildQuoteCartItems`; `QuoteResultScreen.tsx`'s recommendation list rendering; `CustomerPortal.tsx`'s `applySpecsRecsToPlan`.
- New `myBookings.ts` (`buildMyBookings`); `CustomerProfilePage.tsx`'s "Rental Plan" panel, Account Stats tiles, and the now-removed `RentalPlanDetail.tsx`/`rentalPlan.ts` files; `CustomerPortal.tsx`'s `rentalPlans`/`selectedPlan` state and the `bookingsRes` fetch feeding the profile page — CHANGE-06.
- `ChooseModeScreen.tsx`'s option list; `OnboardingMode` (`app/types.ts`); every call site branching on `"browse"` (`CustomerPortal.tsx`'s catalog header, `specsPlan.test.ts`) — CHANGE-07.

### 2.2 Out of scope

- Whether the backend's `POST /rentalPlans/{id}/quote` response itself ever returns a `totalAmount` inconsistent with the sum of its own items' `subtotal` fields — per contract, `totalAmount` is defined as exactly that sum, so if the backend response disagrees with its own items that's a backend defect, outside this (frontend-only) repo. CHANGE-01 makes the frontend internally consistent regardless.
- Whether `GET /api/users` should be restricted to `ROLE_ADMIN` at all — that's an existing, confirmed backend decision (`Spec-rest-api-reference.md` §2.7), not something this frontend-only repo can or should change.
- ~~Wiring "My Rental Plans" to the real backend's `RentalPlanResponse` shape — customer `userId` staying `null` in API mode (a consequence of CHANGE-03, but not a regression it introduces) leaves that view non-functional in API mode, which it already was for unrelated reasons (`buildRentalPlanViews` parses the mock server's `RentalPlan` shape, not the real backend's).~~ **SUPERSEDED (CHANGE-06)**: rather than fix the type mismatch, the "Rental Plan" panel it described was removed entirely and replaced with a real "My Bookings" panel sourced from `GET /bookings`, which needs no client-side `userId` at all (see CHANGE-06).
- Whatever is causing intermittent `net::ERR_INCOMPLETE_CHUNKED_ENCODING` / `Failed to fetch` / Unsplash `502`s observed separately in the same session — investigated live (backend and Unsplash both responded normally on retest), inconclusive, not a frontend code change. Flagged for separate follow-up once/if it reproduces again.
- Whether the recommendation engine (`POST /api/recommendations/project-spec`) *should* return two separate recommendation entries resolving to the same catalog equipment at all — that's a backend/AI behavior this frontend-only repo doesn't control. CHANGE-05 makes the frontend handle that response correctly (dedupe, don't corrupt the cart) regardless of whether the backend's doing so is itself intentional.
- A `GET /api/postalCodes/619094 → 503 (Service Unavailable)` observed in the same console session as CHANGE-05's repro — a separate backend service outage, unrelated to the cart/sync bugs and not a frontend code change.

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
1. **`onBeginPayment` self-heal** (`CustomerPortal.tsx:1019-1038`) — wraps the `createBookingFromPlan` call in a `try`/`catch`; on `ApiError` with `code === "already_converted"`, clears `cart`/`planItemIds`/`planId` and rethrows a clearer message pointing the customer at My Rental Plans, instead of leaving the stale state in place for the next retry to fail against again. (**Note, 2026-08-20 HR-205:** the same `try`/`catch` also gained a `quote_not_ready`/`quote_expired` branch alongside this one — see `Spec-dynamic-pricing-e2e.md` §4.5. This `already_converted` branch itself is unchanged; the "re-quote +" phrasing above described the 2026-08-18-era code, which unconditionally re-quoted before every conversion attempt — that unconditional re-quote was later removed.)
2. **`cancelPlanApi` self-heal** (`CustomerPortal.tsx:528-538`) — same detection and same local-state clear in the "Cancel rental plan" catch path, since that call fails against a `CONVERTED` plan for the identical reason.
3. **`onPaid` proactive reset** (`CustomerPortal.tsx:1052-1064`) — the *successful*-payment branch now also resets `planId`/`planItemIds` alongside the fields it already cleared (`cart`, `siteAddress`, `sitePostalCode`, `deliveryNotes`, `siteAddressPrompted`, `sharedStartDate`, `sharedEndDate`), so the very next `addToCart` creates a brand-new plan instead of retrying the one that just converted.

`ApiError` (already defined in `app/api.ts` for exactly this `{code, message}` envelope) is now imported into `CustomerPortal.tsx` to support the `code === "already_converted"` checks in parts 1 and 2.

### CHANGE-05: AI-recommendation "Add All to Rental Plan" corrupts the cart and skips the backend sync

**GIVEN** the recommendation engine returns two or more recommendation entries that resolve to the same catalog equipment (e.g. two "Hyster H4.2FT Forklift" rows matched against two different project-spec lines) on the AI-recommendation review screen (`QuoteResultScreen.tsx`)
**WHEN** the customer reviews and adds equipment from that screen
**THEN** three compounding failures occurred:
1. Each recommendation row was rendered with `key={r.eq.id}` — React logged "Encountered two children with the same key" for the shared equipment id, and its reconciliation of that list became unreliable: the per-row Include checkbox and Add button (both indexed by array position `i` in local `checked` state) could end up wired to the wrong row's DOM node after a re-render, so clicking Add on one duplicate-keyed row could silently do nothing or affect the other one instead.
2. `buildQuoteCartItems` (`specsPlan.ts`) — the function that turns the checked recommendations into cart items — did a plain `.map()` with no dedup by equipment id, unlike every other cart-mutation function in the app (`addToCart`, `toggleEquipmentInPlan`). So once duplicate-equipment rows got checked, the cart ended up with literal duplicate lines (e.g. the same forklift three times), which then broke every other piece of code that assumes one cart line per equipment id: `planItemIds` (a plain object keyed by equipment id, so it can only ever track *one* backend line-item id per equipment id — the second duplicate has nowhere to be tracked), the cart's own React key (`CartDrawer.tsx:69`, `CustomerPortal.tsx:873`, `DepositCheckout.tsx:357` all warned the same way as point 1), and removal (`removeFromCartApi`'s local-only branch filters out *all* matching-equipment-id entries at once, so an individual duplicate could never be discarded on its own — the customer could only remove all copies together, not just the extra one).
3. Separately and more severely, `applySpecsRecsToPlan` (`CustomerPortal.tsx`) — the handler behind this entire screen's "Add All to Rental Plan" button — only ever called `setCart(buildQuoteCartItems(...))` locally. It never called `syncCartItems`/`ensureApiRentalPlanId`, the code every *other* add-to-cart path in the app uses to create/attach the backend `RentalPlan` in API mode. So `planId` stayed `null` for any customer who added equipment this way, regardless of whether duplicates were involved — and `onBeginPayment` unconditionally throws when `planId === null`.

**Symptom**: duplicate cart lines for the same equipment that couldn't be individually removed (deleting one removed all copies, or nothing visibly happened, due to point 1's key collision); and, independent of duplicates, checkout for *any* AI-recommendation-onboarding customer failed at "Continue to Payment" with `Your rental plan couldn't be found — please refresh and try again.`, because no real rental plan had ever been created server-side.

**Change**, three parts:
1. **`specsPlan.ts:5-25`** — `buildQuoteCartItems` now dedupes its input by equipment id (first occurrence wins) before mapping to `CartItem[]`, so a cart built from this path can never contain two lines for the same equipment — restoring the invariant every other cart-mutation function already enforces.
2. **`QuoteResultScreen.tsx:120-129`** — the recommendation list is now keyed by array index (`key={i}`) instead of `r.eq.id`, so two recommendation rows for the same equipment no longer collide as React keys and the Include/Add controls respond reliably regardless of whether the underlying recommendations repeat an equipment id.
3. **`CustomerPortal.tsx:399-406`** — `applySpecsRecsToPlan` now calls `void syncCartItems(items, quoteDates.startDate, quoteDates.endDate)` immediately after building and setting the cart (mirroring how `handleSharedEndDateSelected` already does this for its own auto-add path), so a real `RentalPlan` gets created/synced in API mode and `planId` is populated — fixing "Your rental plan couldn't be found" for this entire onboarding path.

A regression test was added to `specsPlan.test.ts` covering `buildQuoteCartItems`'s new dedup behavior (same equipment id appearing twice in the input, first occurrence kept, no duplicate in the output).

### CHANGE-06: Customer profile had no real booking history; "Rental Plan" panel was permanently empty

**GIVEN** the customer profile page's "Rental Plan" panel and Account Stats tiles (Total Plans, Days Rented, Total Spent) were built entirely from `rentalPlanApi.list()`, typed and consumed as the mock server's `RentalPlan` shape (`buildRentalPlanViews` filters `p.userId === userId`)
**AND** the real backend's `/rentalPlans` route actually returns the `RentalPlanResponse` shape at runtime in API mode — no `userId` field at all
**AND** separately, the customer-facing UI had no view of the customer's real `Booking` records anywhere, despite `GET /bookings` already existing and already being wired up for the admin Bookings tab
**WHEN** a customer with real, live activity on the real backend (e.g. `alex.tan@example.sg`, confirmed via a direct authenticated `GET /bookings` call to have 66 real bookings) opened their profile page in API mode
**THEN** the "Rental Plan" panel always showed "No rental plans yet," and all three Account Stats tiles always read 0 — `p.userId` was `undefined` on every real-shape plan, so the filter never matched anything, regardless of actual account activity. There was no other way to see booking history in the customer-facing UI at all.

**Symptom**: profile page showing "0 plans" / "S$0 total spent" for a customer with substantial real order history.

**Change**, several parts:
1. **New `myBookings.ts`** — `buildMyBookings(apiBookings, rentalPlans, equipment, userId)`, mirroring the same real/mock shape-guard pattern `AdminDataContext.tsx`'s `isApiBookingRecord()` already uses for the admin Bookings tab. The real-shape (`CreateBookingResponse`) branch needs no `userId` filtering at all — verified live that the real backend's `GET /bookings` already scopes results to the authenticated caller (a customer-role token returns only that customer's own records). The mock-shape branch joins `Booking.rentalPlanId → RentalPlan.userId` instead, since the mock server has no such server-side scoping.
2. **`CustomerPortal.tsx`** — added a `bookingsRes = useApiResource(bookingApi.list)` fetch and a `myBookings` view-model, passed to `CustomerProfilePage` as a new `bookings` prop. Also added `bookingsRes.reload()` alongside the existing `rentalPlansRes.reload()` after a mock-mode checkout completes, so a freshly-created booking appears immediately instead of requiring a refresh.
3. **`CustomerProfilePage.tsx`** — the "Rental Plan" panel, its `rentalPlans`/`onSelectPlan` props, and the Account Stats tiles' rental-plan-based calculations were removed. A new "My Bookings" panel replaces it (booking id, equipment, dates, a status badge reusing `formatBookingStatus`/`bookingStatusColor` from `../admin/adminFormat`, deposit, total). Account Stats now reads **Total Bookings** (`bookings.length`), **Days Rented** (`Σ b.days`), and **Total Spent** (`Σ b.deposit`) off the new `bookings` prop instead.
4. **Dead-code removal**: `RentalPlanDetail.tsx` and `checkout/rentalPlan.ts` (`buildRentalPlanViews`) had no other call site once the "Rental Plan" panel — their only entry point — was removed, so both files were deleted outright, along with `CustomerPortal.tsx`'s `selectedPlan` state and its render branch.
5. **Follow-up bug found and fixed in the same pass**: the first version of this change still required `userId !== null` before calling `buildMyBookings` at all, which meant "My Bookings" stayed permanently empty for every real customer anyway — `App.tsx`'s `handleLogin` (CHANGE-03, above) intentionally leaves `userId` `null` for every non-admin role in API mode, since resolving it needs the admin-only `/api/users` route. Fixed by loosening `buildMyBookings`'s `userId` parameter to `number | null` and dropping the outer `userId !== null` guard in `CustomerPortal.tsx` — the real-shape branch never needed it (already backend-scoped), and the mock-shape branch now just returns nothing when `userId` is `null` instead of the whole feature refusing to run.

### CHANGE-07: Removed the "I'm Just Browsing" onboarding option

**GIVEN** the onboarding "How can we help you today?" screen (`ChooseModeScreen.tsx`) offered three paths — "I Know What I Want," "I'm Just Browsing," and "I Have Specs, Need a Recommendation"
**AND** "I'm Just Browsing" led to the exact same equipment catalog as "I Know What I Want," differing only in one header line ("Browsing · No pressure" vs. "Welcome back, {name}")
**WHEN** the user asked to remove the option as a product simplification (no bug involved)
**THEN** the button, its `onBrowse` prop, the `OnboardingMode` value `"browse"` it produced, and every remaining branch on that value (the catalog header string in `CustomerPortal.tsx`, an assertion in `specsPlan.test.ts`) needed removing together, or the value would become dead/unreachable rather than actually gone.

**Change**: removed the "I'm Just Browsing" entry from `ChooseModeScreen.tsx`'s option list and its `onBrowse`/`Search`-icon plumbing; removed the matching `onBrowse={() => onDone("browse")}` call in `CustomerOnboarding.tsx`; narrowed `OnboardingMode` (`app/types.ts`) from `"know" | "browse" | "specs" | null` to `"know" | "specs" | null`; simplified the now-two-way header ternary in `CustomerPortal.tsx` (`onboardingMode === "specs" ? ... : ...`, dropping the `"browse"` case); updated `specsPlan.test.ts`'s `shouldPromptDeliveryDetails` test to drop its `"browse"` assertion (renamed to "still prompts on Know / unset").

---

## 4. Known approximations & follow-ups

1. **CHANGE-01** doesn't investigate *why* the backend's `quote.totalAmount` didn't match `dailyRate × days` server-side — see §2.2. Per-item `subtotal` (already present on `RentalPlanItemResponse`) is also still not read directly by either the line item or `displayTotal`, both of which recompute `days × dailyRate` client-side instead — pre-existing behavior, left as-is since it wasn't the source of the desync.
2. **CHANGE-02** doesn't change what happens once an admin *does* upload a real `data:` URI photo that's valid but very large — that path already worked (browsers render large `data:` URIs directly, no network request involved) and wasn't touched.
3. **CHANGE-03** leaves customer/employee `userId` permanently `null` in API mode, same as before this fix — "My Rental Plans" was already non-functional against the real backend for the unrelated reason noted in §2.2, so this fix doesn't make that better or worse.
4. **CHANGE-04** doesn't address *why* a booking's payment can be interrupted after the booking is already created (e.g. a declined Stripe card, or the customer closing the tab between `onBeginPayment` succeeding and `onPaid` firing) — that gap is inherent to the two-step booking-then-pay flow (`STRIPE_INTEGRATION_HANDOFF.md`) and out of scope here; this fix only ensures the *next* attempt recovers cleanly rather than getting permanently stuck.
5. The separate connectivity symptoms noticed in the same session (`net::ERR_INCOMPLETE_CHUNKED_ENCODING` on `/api/assets`, a "Couldn't reach the equipment catalog — Failed to fetch" error, and a batch of Unsplash `502`s) did not reproduce on manual retest (backend and Unsplash both responded normally, repeatedly, when checked directly) — left uninvestigated further pending a live reproduction; not a code change in this document.
6. **CHANGE-05** doesn't address *why* the recommendation engine can return duplicate-equipment recommendation entries in the first place — see §2.2. The fix makes the frontend robust to that response shape rather than assuming it won't happen. It also doesn't retroactively repair any `RentalPlanItem` rows already duplicated server-side by a customer who hit this bug before the fix shipped (same caveat as `Spec-cart-hydration-and-duplicate-add-fixes.md`'s CHANGE-03) — those still need manual removal via the cart drawer's trash icon.
7. **CHANGE-06** was not verified in-browser against a live customer session — verification is `tsc -b --noEmit` / `eslint` clean, plus a live, out-of-band `curl` confirmation (login as `alex.tan@example.sg`, call `GET /bookings` directly) that the real backend does scope results to the caller. An actual click-through of the profile page in `npm run dev:api` mode is still owed.
8. **CHANGE-06** leaves `myBookings.ts`'s mock-mode join (`Booking.rentalPlanId → RentalPlan.userId`) essentially unverified beyond a read of `mock/db.json`'s two seed bookings — the mock server has too little seed data to meaningfully exercise it further.

---

## 5. Design

- CHANGE-01 follows the same shape as the equipment line item already on screen: rather than introduce a second source of truth (`quote.totalAmount`) that can silently drift from the first (the per-item `days × dailyRate` figures), `displayTotal` is now derived from the same expression, so the two can't visibly disagree.
- CHANGE-02 consolidates on the one already-tested validation helper (`equipmentImageSrc`/`isUnsplashPhotoId`) instead of leaving each call site to reimplement (and under-implement) its own `data:`-only guard.
- CHANGE-03 is a minimal, behavior-preserving fix: it removes a call that could never succeed for two of the three roles, without changing what any role ends up with.
- CHANGE-04 treats `already_converted` as a recognized, recoverable case rather than a generic error — the fix is deliberately duplicated across three call sites (`onBeginPayment`, `cancelPlanApi`, `onPaid`) rather than pulled into one shared helper, since two are reactive (catch a specific error and recover) and one is proactive (avoid the error in the first place); each needed a different trigger even though the recovery (`clear cart/planId/planItemIds`) is identical.
- CHANGE-05's three parts target three different layers of the same failure chain rather than one broad patch: the dedup fix (`specsPlan.ts`) restores the "one line per equipment id" invariant at its source, the key fix (`QuoteResultScreen.tsx`) makes the *upstream* recommendation-review UI correctly clickable even before that invariant is restored, and the sync fix (`CustomerPortal.tsx`) makes this add-to-cart path consistent with every other one in the app (`addToCart`, `handleSharedEndDateSelected`) by actually calling `syncCartItems`. All three were needed — fixing only the dedup, for example, would still leave AI-recommendation customers unable to check out.

---

## 6. Verification

### 6.1 Checklist

- [x] CHANGE-01: `npx tsc --noEmit` and `npx eslint` clean; manually verified against the screenshot report that Subtotal now equals the sum of the "Reserved Equipment" line items, with GST/Total Payable/Deposit/Balance recalculating consistently off the corrected value
- [x] CHANGE-02: `npx tsc --noEmit` and `npx eslint` clean; `equipmentImageSrc.test.ts` (3 cases) still passes unmodified
- [x] CHANGE-03: `npx tsc --noEmit` and `npx eslint` clean
- [x] CHANGE-04: `npx tsc --noEmit` and `npx eslint` clean
- [x] CHANGE-05: `npx tsc -b --pretty false` and `npx eslint .` clean; `npm test` — 12 test files, 82 tests, all passed (includes the new `buildQuoteCartItems` dedup regression test)
- [x] CHANGE-06: `npx tsc -b --noEmit` and `npx eslint src/` clean after each of the profile-page/`myBookings.ts` edits and again after the `userId`-null follow-up fix; live `curl` confirmation (admin and customer tokens against the real backend) that `GET /bookings` returns admin-all-110 vs. customer-own-66 records respectively, matching what the admin Bookings tab already showed — see §4 item 7 for what's still owed (an in-browser click-through)
- [x] CHANGE-07: `npx tsc -b --noEmit` and `npx eslint src/` clean; `npx vitest run src/features/checkout/specsPlan.test.ts src/features/customer/` — 7 tests passed

### 6.2 Manual smoke test

1. **CHANGE-01**: Run `npm run dev:api` with `pricing.dynamic-enabled` on, add an item whose quoted rate differs from its flat listed rate (triggers "Smart Priced"), open the Booking Summary modal, and confirm Subtotal/GST/Total Payable/Deposit/Balance are all consistent with the "Reserved Equipment" line items above them. Repeat with 2+ items to confirm the sum, not just a single-item case.
2. **CHANGE-02**: In API mode, browse the equipment catalog and open a detail page for an item whose `img` is a valid photo id — images load normally. (Reproducing the malformed-value case requires an `img` value that violates the expected shape, which isn't producible from the current UI — validated via `equipmentImageSrc.test.ts`'s existing "not-a-photo" case instead.)
3. **CHANGE-03**: Log in as a customer (`alex.tan@example.sg`) and as an admin (`ravi.kumar@example.sg`) in API mode. Confirm no `/api/users` request fires for the customer login, and confirm it still fires (and succeeds) for the admin login.
4. **CHANGE-04**: Complete a full checkout (deposit paid). Immediately select a new piece of equipment for a new booking — confirm it adds without error. Separately, reproduce a stuck `already_converted` state (e.g. retry "Continue to Payment" after a plan has already converted) and confirm the cart clears itself with an actionable message instead of repeating the raw backend error.
5. **CHANGE-05**: In API mode, go through the "Instant Quote" onboarding flow with a project spec likely to produce overlapping equipment recommendations, and confirm no duplicate-key warnings appear on the recommendation review screen and the resulting Rental Plan panel never shows two lines for the same equipment. Click "Add All to Rental Plan," then open the Booking Summary and click "Continue to Payment" — confirm it proceeds instead of showing "Your rental plan couldn't be found."
6. **CHANGE-06**: Log in as a customer with real backend activity (`alex.tan@example.sg`) in API mode and open the profile page. Confirm "My Bookings" lists real bookings (not empty) and Account Stats shows non-zero Total Bookings / Days Rented / Total Spent. Confirm the old "Rental Plan" panel is gone entirely.
7. **CHANGE-07**: Start onboarding as a customer and confirm the "How can we help you today?" screen shows exactly two options (no "I'm Just Browsing"), and that both remaining options still route correctly.

---

## 7. Key decisions

| Decision | Rationale |
|----------|-----------|
| Derive `displayTotal` from the same per-item expression as the line items, instead of trusting `quote.totalAmount` | Two independent sources for what should be the same number is exactly what let them drift apart; deriving one from the other closes the gap regardless of whether the backend field itself is later found to be buggy. |
| Route every image call site through `equipmentImageSrc`/`isUnsplashPhotoId` instead of leaving inline guards | Multiple independent, weaker reimplementations of the same check is exactly how CHANGE-02 happened in three different files; one validated helper closes all of them at once. |
| Skip `resolveUserId()` entirely for non-admin roles, rather than catching-and-ignoring more quietly | The call can never succeed for those roles (confirmed backend restriction) — not making a doomed request is strictly better than making one and swallowing its failure. |
| Duplicate the `already_converted` recovery logic across three call sites instead of extracting a shared helper | Two sites are reactive (inside a `catch`) and one is proactive (inside a success branch) — the trigger conditions differ enough that a shared helper would mostly just be the three-line `setCart([]); setPlanItemIds({}); setPlanId(null);` body, which isn't worth abstracting over. |
| `resolvePhoto()` falls back to `""`, not `null` | `FleetAsset.photo`/`AssetRecord.photo` are typed as non-nullable `string`, and existing admin/employee views already treat falsy `photo` as "no photo" — matching that convention avoided touching three more files' render logic. |
| Bundle all five bugs into one document | Not one coherent theme (pricing, images, auth, and cart/plan state are unrelated surfaces), but fixed in the same session — combined at the user's explicit request rather than filed as separate specs. |
| `buildQuoteCartItems` dedupes by keeping the *first* occurrence of a repeated equipment id | Arbitrary but deterministic — no signal in the recommendation response about which of two duplicate entries is more "correct," so first-seen is the simplest stable rule. |
| Key the recommendation list by array index instead of `r.eq.id` | The list is static per render (no add/remove/reorder of recommendation rows after the initial render), so an index key is safe here and immediately resolves the duplicate-key collision without needing a synthetic composite key. |
| Fix the dedup, the key, and the missing sync as three separate changes rather than just fixing the sync | The sync fix alone would still let duplicate-equipment cart lines reach the backend (as duplicate `addItem` calls) and still leave the recommendation screen's clicks unreliable — all three were independently necessary, not redundant with each other. |

---

## 8. Change control

| Version | Date | Notes |
|---------|------|--------|
| 0.1.0 | 2026-08-18 | Combined from two earlier same-session drafts (`Spec-deposit-checkout-subtotal-desync-fix.md` and `Spec-image-auth-and-stale-plan-fixes.md`, both superseded and removed by this document) into one file per user request. Documents CHANGE-01 (Booking Summary Subtotal desynced from the displayed line item), CHANGE-02 (malformed Unsplash image requests from unvalidated `Asset.img` values), CHANGE-03 (`GET /api/users` 403ing on every non-admin login), and CHANGE-04 (customers getting stuck once a rental plan converts to a booking, both on retry and proactively after a successful payment). All verified with `npx tsc --noEmit` / `npx eslint`. |
| 0.2.0 | 2026-08-18 | Added CHANGE-05 (AI-recommendation "Add All to Rental Plan" screen: duplicate React keys breaking Include/Add clicks, `buildQuoteCartItems` letting duplicate-equipment cart lines through, and `applySpecsRecsToPlan` never syncing to the backend — causing undiscardable duplicate cart lines and "Your rental plan couldn't be found" at checkout). Also corrected this document's verification methodology going forward: discovered that `npx tsc --noEmit` (used for CHANGE-01–04's verification) silently checks nothing against this repo's root `tsconfig.json`, and had already let a real regression through (CHANGE-01's `totalCost` prop removal broke `DepositCheckout.test.tsx`, fixed once caught). CHANGE-05 and later are verified with `npx tsc -b --pretty false` instead, matching CI's actual Quality Control job. |
| 0.3.0 | 2026-08-20 | Added CHANGE-06 (customer profile page: new "My Bookings" panel sourced from real `GET /bookings` data via new `myBookings.ts`; the permanently-empty "Rental Plan" panel and its dead-end `RentalPlanDetail.tsx`/`rentalPlan.ts` removed outright; Account Stats repointed from rental-plan data to booking data; a follow-up fix in the same pass loosened `buildMyBookings`'s `userId` requirement after discovering the feature was still always empty due to CHANGE-03's customer-`userId`-is-always-`null`-in-API-mode behavior) and CHANGE-07 (removed the "I'm Just Browsing" onboarding option and fully deleted the `OnboardingMode` `"browse"` value it produced, including its now-dead branches in `CustomerPortal.tsx` and `specsPlan.test.ts`). §2.2's stale "My Rental Plans" bullet marked superseded by CHANGE-06 rather than removed, to preserve the cross-reference. |
