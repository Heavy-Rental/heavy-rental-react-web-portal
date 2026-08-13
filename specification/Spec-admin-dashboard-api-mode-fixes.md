# Specification: Admin Dashboard — API Mode Fixes

| Field | Value |
|-------|--------|
| **Feature** | Admin Dashboard — Real Backend (API Mode) Compatibility Fixes |
| **Status** | Implemented — FIX-01 through FIX-03 committed; FIX-04 and FIX-05 added in a later pass on this branch, also committed |
| **Module** | `heavy-rental-react-web-portal` |
| **Primary surface** | Admin dashboard (`src/features/admin/`), shared API client (`src/app/api.ts`), shared data-fetch hook (`src/app/useApiResource.ts`) |
| **Method** | Live debugging against the real Spring Boot backend (`heavy-rental-rest-api`) in `npm run dev:api` mode, driven by browser console/network errors |
| **Related code** | `src/app/api.ts`, `src/app/useApiResource.ts`, `src/App.tsx`, `src/features/admin/AdminDataContext.tsx`, `mock/db.json` |
| **Environment context** | [`Spec-frontend-api-integration.md`](./Spec-frontend-api-integration.md), [`Spec-mock-api-server.md`](./Spec-mock-api-server.md) |
| **Linked backend** | `heavy-rental-spring-rest-api`, branch `36-link-rest-api-users-to-front-end` (separate repo, reachable at `heavy-rental-rest-api:8080` from this frontend's `dev:api` mode; not present in this workspace — verified only via live HTTP calls, not by reading its source) |

This document records three bugs found and fixed while getting the Admin Dashboard (and the Asset Records fetch that feeds it) working against the real backend in API mode (`npm run dev:api`), as opposed to the mock server (`npm run dev:mock`). All three bugs were invisible under mock mode and only surfaced once the frontend was pointed at the real backend — each is documented here with its root cause, fix, and any remaining approximation. This work pairs with backend changes on `heavy-rental-spring-rest-api`'s `36-link-rest-api-users-to-front-end` branch (the `UserController` addition referenced in FIX-03's prerequisites, and the `RentalPlanController`/booking-response shapes FIX-01 and FIX-03 adapt to) — that repo is not accessible from this session, so backend-side details here are inferred from live API responses, not source review.

---

## 1. Outcomes

When these fixes are correct:

1. `rentalPlanApi` resolves to the same route the real backend's `RentalPlanController` actually serves, in both `dev:mock` and `dev:api` (FIX-01).
2. Loading the equipment catalog (Asset Records, the customer browse page, the landing page's category tiles) no longer triggers two concurrent multi-megabyte downloads of the same data in development, eliminating the intermittent `net::ERR_INCOMPLETE_CHUNKED_ENCODING` failures this caused (FIX-02).
3. The Admin Dashboard's Bookings and Users tabs render correctly against the real backend's booking response, instead of crashing the entire dashboard with an uncaught `TypeError` (FIX-03).
4. The admin Bookings tab's equipment column and search filter no longer crash the dashboard when the real backend's response shape changes out from under a field the frontend assumed was always present (FIX-04).
5. The admin Bookings tab's status filter, inline status editor, and summary stat cards cover the real backend's full 6-value `BookingStatus` enum instead of a stale 5-value subset, and the "Paid" column/filter (a `PaidStatus` enum the backend has since removed entirely) no longer exists (FIX-05).

---

## 2. Scope

### 2.1 In scope

- The `rentalPlanApi` route path (`src/app/api.ts`), and the mock server's matching data key (`mock/db.json`).
- The shared data-fetching hook (`src/app/useApiResource.ts`) and every one of its call sites in `src/App.tsx` and `src/features/admin/AdminDataContext.tsx`.
- The Admin Dashboard's booking view-model builders (`buildBookingRows`, `buildUserRows` in `AdminDataContext.tsx`) and the `bookingApi.list()` client (`src/app/api.ts`).
- `CreateBookingResponse`'s shape (`src/app/api.ts`), the admin Bookings tab (`src/features/admin/bookings/BookingsTab.tsx`), the shared `BookingStatus` type (`src/app/types.ts`), and status label/list helpers (`src/features/admin/adminFormat.ts`) — FIX-04 and FIX-05.

### 2.2 Out of scope

- The real backend's `/api/equipment` response payload size (~4.5MB per call, due to full base64-encoded photos embedded per item) — this was identified as the underlying reason FIX-02's symptom is possible at all, but shrinking that payload requires a backend change (a dedicated image-serving endpoint) that is not part of this frontend fix. FIX-02 only removes the *duplicate* download; the payload itself is still large.
- Backend changes of any kind — all three fixes here are frontend-only. Where a real backend gap was found (e.g. a missing `UserController`, since resolved separately on the backend), it is noted but not something this spec covers fixing.
- Exact (non-approximated) values for the Admin Bookings tab's `depot` and `paidStatus` columns in API mode — see FIX-03 and §4 below; the real backend's booking response does not carry the data needed to compute these exactly.

---

## 3. Fixes

### FIX-01: `rentalPlans` route naming mismatch

**GIVEN** the real backend's `RentalPlanController` is mapped to `@RequestMapping("/api/rentalPlans")` (camelCase)
**WHEN** the frontend's `rentalPlanApi` requests `/api/rental-plans` (kebab-case, matching the mock server's `db.json` key instead)
**THEN** every rental-plan request in API mode 404s.

**Fix**: renamed the resource path and the mock server's matching data key to camelCase everywhere, so both modes use one consistent path — `src/app/api.ts`'s `rentalPlanApi` now targets `/rentalPlans`, and `mock/db.json`'s top-level key was renamed from `"rental-plans"` to `"rentalPlans"` to match. No mode-branching needed since both sides now agree.

### FIX-02: Duplicate large equipment fetch under React StrictMode

**GIVEN** React `StrictMode` is enabled (`src/main.tsx`), which intentionally mounts every effect, cleans it up, and mounts it again in development
**AND** `useApiResource`'s effect cleanup only set a `cancelled` flag to suppress a late state update, without actually cancelling the underlying `fetch()` call
**WHEN** any component using `equipmentApi.list()` mounts (there are four independent call sites: `App.tsx`'s top-level fetch, `CustomerPortal`, `EmployeeDashboard`, and `AdminDataContext`)
**THEN** two full, concurrent requests for the ~4.5MB equipment payload fire on every mount, and one of them intermittently fails with `net::ERR_INCOMPLETE_CHUNKED_ENCODING`.

**Fix**: `useApiResource` now creates an `AbortController` per effect run, passes its `.signal` into the fetcher, and calls `controller.abort()` in the cleanup function instead of only setting a flag. `src/app/api.ts`'s `resource()`, `readOnlyResource()`, and `equipmentApi.list()` were updated to accept and forward an optional `AbortSignal` through to `request()`'s existing `init.signal` support. All 12 `useApiResource(...)` call sites across `App.tsx` and `AdminDataContext.tsx` were updated to thread the signal through. The discarded first request from `StrictMode`'s double-invoke is now genuinely cancelled at the network level instead of completing in the background, so only one real request happens per mount.

**Verified in-browser (2026-08-12, Network tab, "eq" filter, Preserve log on, 3 consecutive refreshes)**: the cancellation itself works as designed on every refresh — discarded duplicates consistently show as `(canceled)`, `0.0 kB`, ~5ms, instead of completing a second full download. Refresh reliability of the *surviving* request was mixed: refresh 1 — clean (2 canceled + 2× `200`, 4,714 kB each); refresh 2 — both survivors failed with `net::ERR_INCOMPLETE_CHUNKED_ENCODING` at 4,465 kB / 4,583 kB (out of ~4,714 kB expected); refresh 3 — clean again (2 canceled + 2× `200`, 4,714 kB each). So the failure is genuinely intermittent (roughly 1-in-3 in this sample), not constant, and not reintroduced by this fix — it confirms FIX-02 reliably eliminates the *duplicate-transfer* symptom, but does not make the underlying ~4.7MB payload transfer reliably every time; see §4 item 4.

### FIX-03: Admin Dashboard crash on the real backend's booking shape

**GIVEN** the real backend's `GET /api/bookings` returns a flat, denormalized shape (`bookingId`, `customerName`, `assetName`, `siteAddress`, etc. — no `rentalPlanId`/`depotId`/`equipmentIds` join keys)
**AND** `AdminDataContext.tsx`'s `buildBookingRows`/`buildUserRows` assumed the mock server's normalized `Booking` shape unconditionally
**WHEN** the Admin Dashboard loads in API mode
**THEN** `buildBookingRows` throws `Uncaught TypeError: Cannot read properties of undefined (reading 'map')` trying to call `.map()` on the nonexistent `equipmentIds` field, crashing the entire dashboard (no error boundary exists in this app, so the crash renders as a blank page).

**Fix**: `bookingApi.list()` (`src/app/api.ts`) now declares its honest return type — `(Booking | CreateBookingResponse)[]` — since the same `/bookings` path returns different shapes depending on which backend answers it. `AdminDataContext.tsx` adds a type guard, `isApiBookingRecord()`, keyed on the presence of `bookingId` (only the real shape has it), and both `buildBookingRows` and `buildUserRows` branch per-item on that guard to produce the same `BookingRow`/`UserRow` view-models from either shape. See §4 for the two fields this fix approximates rather than computes exactly.

### FIX-04: Admin Bookings equipment column / search crash after backend's `items` shape change

**GIVEN** the real backend's `BookingResponse` originally had flat `assetName`/`serialNumber` fields, matching `CreateBookingResponse`'s original shape here
**AND** the backend later changed `BookingResponse` to carry `items: List<BookingItemLine>` instead (a booking can cover more than one asset), without a corresponding frontend update
**WHEN** the Admin Dashboard loads in API mode
**THEN** `b.assetName` is silently `undefined` (TypeScript didn't catch it — nothing enforces `CreateBookingResponse` against the live JSON, so the stale field just type-checked fine and returned `undefined` at runtime), which renders as a blank equipment cell — no crash yet. **THEN**, the moment the user types into the Bookings search box, the search filter's `b.equipment.toLowerCase()` runs on that `undefined` value and throws, crashing the entire dashboard (still no error boundary anywhere in this app).

**Fix**: `CreateBookingResponse` (`src/app/api.ts`) now declares `items: BookingItemLine[]` (a new exported interface, `{ assetName: string; serialNumber: string }`, matching the backend's `BookingItemLine` DTO) instead of the stale flat fields. `AdminDataContext.tsx`'s `isApiBookingRecord` branch of `buildBookingRows` now derives `equipment` as `(b.items ?? []).map(i => i.assetName).join(", ") || "—"` instead of reading the field that no longer exists.

### FIX-05: `BookingStatus` type only covered 5 of the real backend's 6 values; `PaidStatus` removed entirely

**GIVEN** the real backend's `Booking.BookingStatus` enum has always had 6 values (`PENDING_DEPOSIT`, `PENDING_CONFIRMED`, `CONFIRMED`, `MOBILISED`, `COMPLETED`, `CANCELLED`)
**AND** this portal's `BookingStatus` type (`src/app/types.ts`) only had 5 (a single `"PENDING"`, missing the deposit/confirmed split entirely) — a stale assumption inherited from the mock server, never corrected when API mode was added
**WHEN** a real booking response's `bookingStatus` field is cast (`b.bookingStatus as BookingStatus`) into this narrower type
**THEN** the cast was silently incorrect for `PENDING_DEPOSIT`/`PENDING_CONFIRMED` bookings — TypeScript didn't catch it (an `as` cast doesn't get checked against the source value), and the admin Bookings tab's status color/label lookups (keyed on the 5 known values) would have produced blank/unstyled results for those two statuses.

Separately, the backend has since removed its `PaidStatus` enum entirely, making the admin Bookings tab's "Paid" column and "All Paid Statuses" filter — which read a `paidStatus` field that was already only ever an unverified heuristic approximation, see §4 item 2 (now resolved/removed) — dead UI with nothing real backing it.

**Fix**: `BookingStatus` (`src/app/types.ts`) widened to all 6 real values. `adminFormat.ts`'s `BOOKING_STATUSES` list and `formatBookingStatus` updated to match (the old formatter only capitalized the first letter, which would have produced `"Pending_deposit"` instead of `"Pending Deposit"` for the multi-word values). `BookingsTab.tsx`'s status color map covers both new values (same amber styling as the old single `PENDING`), and its summary stat row groups `PENDING_DEPOSIT` + `PENDING_CONFIRMED` into one "Pending Payments" card rather than showing 6 individual cards — the status filter dropdown and each row's inline editor still expose all 6 individually. The "Paid" column, its filter dropdown, `paidStatusColor()`, and the `PAID_STATUS`/`formatPaidStatus` imports were removed from `BookingsTab.tsx` entirely. `PaidStatus`/`paidStatus` are left in place elsewhere (`types.ts`, `AdminDataContext.tsx`'s `BookingRow.paidStatus` and its derivation logic, `adminFormat.ts`'s now-orphaned `PAID_STATUSES`/`formatPaidStatus`) as harmless dead code — not cleaned up in this pass since it wasn't asked for, but noted here so it isn't mistaken for a currently-used field if picked up later.

---

## 4. Known approximations & follow-ups

Unlike the three Open Questions in `Spec-ui-heavy-machinery-portal.md`, these aren't undecided — they're accepted, working approximations, noted here so they're not mistaken for exact values if revisited later.

1. **Bookings tab `depot` column (API mode only)**: the real backend's booking response has no depot foreign key, only `siteAddress`. The `depot` column shows the raw site address instead of a depot name in API mode. Exact fix would require the backend to add a `depotId`/depot name to its booking response.
2. ~~**Bookings tab `paidStatus` column (API mode only)**: the real backend's booking response has no `paidStatus` field. It's derived heuristically...~~ **RESOLVED (FIX-05)**: the backend has since removed `PaidStatus` entirely, and the "Paid" column/filter this approximation fed were removed from the admin Bookings tab. The underlying heuristic derivation still exists unused in `AdminDataContext.tsx` (`BookingRow.paidStatus`) — harmless dead code, not cleaned up in this pass, see FIX-05.
3. **Users tab `rentals`/`spent` counts (API mode only)**: with no `rentalPlanId` to join bookings to users, the fallback join matches `booking.customerName === user.name` by string equality. This is fragile if two users ever share a display name — there is no user-id foreign key on the real backend's booking response to join on instead.
4. **FIX-02 mitigates, doesn't eliminate, the equipment payload cost**: the ~4.5MB `/api/equipment` response (full base64 photos embedded per item) is still downloaded once per genuine mount, and that single download can still fail on its own — confirmed in-browser 2026-08-12, where a non-duplicated request failed with `net::ERR_INCOMPLETE_CHUNKED_ENCODING` at 4,465–4,583 kB out of ~4,714 kB expected. A backend change — a dedicated `GET /api/equipment/{id}/image` endpoint returning raw JPEG bytes, with the list endpoint switched to a plain image URL instead of an embedded `data:` URI — was scoped in conversation but not implemented; it would remove the root cause rather than just the duplicate-download symptom. Note this would also require a coordinated frontend change: `EquipmentGrid.tsx:93` and `App.tsx:944,979,982` currently branch on `img.startsWith("data:")` to decide how to render it, which would need a third case (and null guards) added for a real image URL.
5. **Two unexplained `502` responses observed alongside the above** — cause not yet root-caused (possibly the dev proxy/backend not being warmed up at the very first request of a session). Not chased further since it wasn't the item being verified; worth a look if it recurs.

---

## 5. Design

- **FIX-01** required no mode-branching once the mock server's own data key was renamed to match — both `dev:mock` and `dev:api` now agree on `/rentalPlans`.
- **FIX-02** is scoped entirely to the shared fetch layer (`useApiResource.ts`, `api.ts`) plus updating every call site's signature — no change to what data is fetched or how it's used once it arrives.
- **FIX-03** uses a runtime type guard rather than a compile-time discriminant, since the response shape is determined by which backend answers the (identical) request URL, not by anything the frontend controls at the call site.

---

## 6. Verification

### 6.1 Checklist

- [x] `rentalPlanApi` requests match the real backend's actual route in API mode
- [x] `mock/db.json`'s rental-plans key matches the renamed route in mock mode
- [x] `npx tsc --noEmit` passes clean after all four files' changes
- [x] No other call site (`App.tsx`'s `.create()`) was broken by widening `bookingApi.list()`'s return type (note: `BookingsTab.tsx`'s status editor no longer calls the generic `.update()` at all as of a later change — see `Spec-rest-api-reference.md` §2.5/§5)
- [~] Manual confirmation in-browser that only one `/api/equipment` request completes per mount — **partially confirmed** 2026-08-12: duplicate requests are now cleanly `(canceled)` as intended, but the single surviving request still failed with `net::ERR_INCOMPLETE_CHUNKED_ENCODING` on a subsequent refresh (see FIX-02 and §4 item 4) — the duplicate-transfer symptom is fixed, the underlying payload-size fragility is not
- [x] Manual confirmation that the Admin Dashboard's Bookings/Users tabs render without crashing in API mode — confirmed 2026-08-12, no crash
- [x] FIX-04: `npx tsc -b --noEmit` and `npx eslint .` clean after `CreateBookingResponse`/`buildBookingRows` changes; manual confirmation typing in the Bookings search box no longer crashes the dashboard in API mode
- [x] FIX-05: `npx tsc -b --noEmit` and `npx eslint .` clean after `BookingStatus`/`adminFormat.ts`/`BookingsTab.tsx` changes; manual confirmation the stat row shows a single "Pending Payments" count summing both pending statuses, the status filter/editor list all 6 values with correct labels, and no "Paid" column/filter remains

### 6.2 Manual smoke test

1. Run `npm run dev:api`, log in as an admin (`ravi.kumar@example.sg`), and open the Admin Dashboard.
2. Confirm the dashboard renders (no blank page, no "Couldn't reach the mock API" banner from a booking-shape crash).
3. Open the Bookings tab and confirm rows render with a customer name, asset name, and a `depot` value (a street address in API mode — expected per §4).
4. Open the browser console filtered on "equipment" and confirm at most one successful `/api/equipment` request per page load, with no `ERR_INCOMPLETE_CHUNKED_ENCODING`.
5. Open the Asset Records tab and confirm equipment loads.

---

## 7. Key decisions

| Decision | Rationale |
|----------|-----------|
| Rename to camelCase everywhere, not mode-branch the path | Simpler than keeping two paths in sync forever; the mock server's data key is trivial to rename, so there's no reason to carry permanent branching logic for a naming difference. |
| Use `AbortController` instead of a request-deduplication/cache layer | Directly targets the actual mechanism causing the failure (a genuinely-abandoned request still completing) without introducing a shared-cache architecture change across every API consumer. |
| Approximate `depot`/`paidStatus`/user-booking join rather than block on backend changes | Gets the Admin Dashboard functional in API mode now; the approximations are documented (§4) so they're revisited if the backend later adds the missing fields, rather than silently trusted as exact. |
| Runtime type guard over a discriminated union with a literal tag | The real backend's response has no explicit "shape" tag — `isApiBookingRecord()` infers it from a field (`bookingId`) that only exists on one shape, which is the only signal available. |

---

## 8. Change control

| Version | Date | Notes |
|---------|------|--------|
| 0.1.0 | 2026-08-12 | Initial draft, documenting FIX-01 (rentalPlans naming mismatch, committed), FIX-02 (StrictMode duplicate equipment fetch via AbortController), and FIX-03 (Admin Dashboard booking-shape crash) — all found and fixed while validating the admin login/dashboard flow against the real backend on the `122-fix-error-admin-login` branch. |
| 0.2.0 | 2026-08-13 | Added FIX-04 (admin Bookings equipment column / search crash, `assetName` → `items: BookingItemLine[]` after a backend shape change) and FIX-05 (`BookingStatus` widened from 5 to the real 6 values; "Paid" column/filter removed after the backend dropped `PaidStatus` entirely) — both found while continuing to exercise the admin Bookings tab against the real backend. §4 item 2 marked resolved by FIX-05 rather than removed, to keep the other items' numbering stable for existing cross-references. |
