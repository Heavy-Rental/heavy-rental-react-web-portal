# Specification: Admin Overview — Real Data Wiring

| Field | Value |
|-------|--------|
| **Feature** | Admin Dashboard Overview Tab — Replacing Fake/Round-Robin Data With Real Backend Data |
| **Status** | Implemented — CHANGE-01 through CHANGE-04 completed and verified against the real backend |
| **Module** | `heavy-rental-web-portal` |
| **Primary surface** | Admin dashboard Overview tab (`src/features/admin/overview/OverviewTab.tsx`) and the Fleet Board (`src/features/admin/fleet/FleetTab.tsx`), which shares the same underlying data |
| **Method** | Live verification against the real Spring Boot backend (`heavy-rental-rest-api`) in `npm run dev:api` mode — a headless Playwright script logged in as admin and screenshotted each panel after every change |
| **Related code** | `src/features/admin/overview/OverviewTab.tsx`, `src/features/admin/AdminDashboard.tsx`, `src/features/admin/AdminDataContext.tsx`, `src/features/admin/adminFormat.ts`, `src/features/admin/bookings/BookingsTab.tsx` |
| **Environment context** | [`Spec-admin-dashboard-api-mode-fixes.md`](./Spec-admin-dashboard-api-mode-fixes.md) (prior admin-dashboard-vs-real-backend fixes; this document continues that thread but is scoped to data that was silently fake rather than crashing) |

This document records four changes that replaced hardcoded/round-robin placeholder data on the Admin Overview tab with data derived from the real backend. Unlike `Spec-admin-dashboard-api-mode-fixes.md`'s fixes (which were crashes or wrong values surfaced only in API mode), the issues here were silent — the dashboard rendered without error in both mock and API mode, but several panels showed numbers with no real relationship to the underlying booking/asset data. Each change was verified live against the real backend (`heavy-rental-rest-api:8080`), not just the mock server.

---

## 1. Outcomes

When these changes are correct:

1. The Overview tab's "Alerts" panel is replaced by a "Top Customers" panel ranking real customers by real total spend (CHANGE-01).
2. The Overview tab's "Recent Activity" panel shows real recent bookings instead of a hardcoded, fictional activity feed (CHANGE-02).
3. Fleet Health, the Fleet Board, and the Asset Health Snapshot table all reflect each asset's real deployment status — derived from real bookings and real condition data — instead of a repeating 4-value round-robin unrelated to actual booking state (CHANGE-03).
4. The Overview tab's "Booking Status" panel groups statuses identically to the Bookings tab ("Pending Payments" combining `PENDING_DEPOSIT`+`PENDING_CONFIRMED`), and every tile has a correct status-color dot (CHANGE-04).

---

## 2. Scope

### 2.1 In scope

- The Overview tab's Alerts panel, Recent Activity panel, and Booking Status panel (`OverviewTab.tsx`).
- Fleet deployment-status derivation feeding Fleet Health (Overview), the Fleet Board (kanban + table views), and the Asset Health Snapshot table (`AdminDataContext.tsx`'s `buildFleetAssets`).
- Shared status-grouping/coloring helpers used by both the Overview tab and the Bookings tab (`adminFormat.ts`).

### 2.2 Out of scope

- Live/reactive updates to Fleet/Users/Bookings data after the dashboard has loaded (see §4 item 1) — this was already the app's existing architecture (fetch once per session, then locally mutable), not something introduced or changed here.
- Backend changes of any kind — everything here is a frontend-only re-derivation of data the backend already returns via `/api/assets`, `/api/bookings`, `/api/users`, `/api/rentalPlans`.

---

## 3. Changes

### CHANGE-01: "Alerts" panel replaced with "Top Customers" panel

**GIVEN** the Overview tab's Alerts panel listed maintenance/payment/in-transit notices derived from live fleet and booking state
**WHEN** the product decision was made to show customer value instead of operational alerts on this panel
**THEN** the panel needed a different data source and layout, without duplicating any other panel already on the page.

**Change**: `AdminDataContext.tsx`'s `buildUserRows()` already computed `UserRow.spent` (sum of `totalAmount` across each customer's real bookings) — it just wasn't passed into `OverviewTab`. `AdminDashboard.tsx` now passes `users={data.users}` through. `OverviewTab.tsx` replaced the `ALERTS` computed array and its `alertColors`/`alertDot`/`alertText` style maps with `topCustomers = [...users].sort((a, b) => b.spent - a.spent).slice(0, 3)`, and replaced the Alerts panel's JSX with a ranked list (rank, name, rental count, `S$` spend formatted identically to the Users tab's "Total Spent" column) plus a "View all →" link to the Users tab. Top-N count was set to 3 per product direction (initially built as top 5, changed to top 3 on request).

### CHANGE-02: "Recent Activity" wired to real bookings; fake lifecycle data removed entirely

**GIVEN** the Overview tab's "Recent Activity" panel read from `AdminDataContext.tsx`'s `INITIAL_LIFECYCLES` — a hardcoded, static seed array of fictional booking events (fictional customers like "Sarah Mitchell"/"Carlos Vega" that don't exist in the real user list, and a US-style address, "4820 Main St", despite the app being Singapore-only)
**AND** this array never changed at runtime (`useState` with no setter) and had no relationship to the real `bookings` data already loaded elsewhere on the same tab
**WHEN** an admin viewed "Recent Activity"
**THEN** the panel showed a plausible-looking but entirely fabricated feed, unrelated to any real booking in the system.

**Change**: `OverviewTab.tsx`'s `recentActivity` is now derived directly from the real `bookings: BookingRow[]` prop (already used elsewhere on the same tab for KPIs and the Booking Status panel): `[...bookings].sort((a, b) => b.apiId - a.apiId).slice(0, 5)` — booking ids are server-assigned and increase with creation, used as a "most recent first" proxy since bookings carry no `createdAt` timestamp. Each row now shows a real status badge, real customer, real equipment, real booking id, and the real rental start date. Because this made the fake lifecycle data fully unused anywhere in the app, it was removed rather than left as dead code: `INITIAL_LIFECYCLES`, the `RentalLifecycle`/`LifecycleEvent` interfaces, `LifecycleStatus`/`LIFECYCLE_META` (`adminFormat.ts`), and the `lifecycles` state/prop threaded through `AdminDataContext.tsx` → `AdminDashboard.tsx` → `OverviewTab.tsx`. `bookingStatusColor()` (previously defined privately inside `BookingsTab.tsx`) was extracted as a shared export in `adminFormat.ts` so both the Recent Activity row's status badge and the Bookings tab's status badge use the same color mapping.

### CHANGE-03: Fleet deployment status, assignment, and location wired to real bookings + condition

**GIVEN** `AdminDataContext.tsx`'s `buildFleetAssets` assigned each asset's `deploymentStatus` (`Available`/`Booked`/`In-Transit`/`Maintenance`), `assignedBooking`, `assignedCustomer`, `currentSite`, `notes`, `lastUpdated`, and `updatedBy` via `i % 4` — a pure round-robin over the asset's position in the fetched list, picking from four-item hardcoded arrays
**AND** this was completely disconnected from any real booking or condition data — every asset showed one of exactly four fake site/customer/note combinations regardless of its actual state
**WHEN** an admin viewed Fleet Health (Overview), the Fleet Board (kanban or table view), or the Overview tab's Asset Health Snapshot table
**THEN** the counts and per-asset detail were cosmetic — always a suspiciously even split (e.g. 7/7/7/6 across 27 assets) with no relationship to what was actually booked, in transit, or under repair.

**Change**: added `buildAssetDeployments()` (`AdminDataContext.tsx`), which derives each asset's current deployment from real bookings covering today's date: a booking with status `MOBILISED` → `In-Transit`; `CONFIRMED` → `Booked`; carrying the real booking id, real customer name (resolved the same way `buildUserRows`/`buildBookingRows` already do — direct field in API mode, `rentalPlan` → `user` join in mock mode), the real `siteAddress`, and a status-appropriate note built from the booking's real dates (e.g. `"Confirmed — delivery due Aug 19."`). `Maintenance` is now derived from the asset's real `condition === "NEEDS_REPAIR"` field (independent of any booking, matching the status's existing documented meaning in `DEPLOYMENT_META`) rather than 1-in-4 chance. Everything else defaults to `Available`, with `currentSite` falling back to the asset's real home depot (`${asset.location} Depot`). `lastUpdated` now comes from the asset's real `lastConditionUpdatedAt` field instead of an identical hardcoded string for every asset. Fleet seeding in `AdminDataProvider` changed from a one-time seed gated only on equipment loading, to a one-time seed gated on equipment **and** bookings **and** rental plans **and** users all being loaded (needed since deployment derivation now requires all four). The Fleet Board's existing manual "Update Status" action (`FleetUpdateModal`/`handleFleetUpdate`) is unchanged — it remains the mechanism for an admin to override an asset's status client-side after the real baseline loads.

### CHANGE-04: "Booking Status" panel grouped to match the Bookings tab; missing dot-color bug fixed

**GIVEN** the Overview tab's "Booking Status" panel rendered one tile per raw `BookingStatus` value (6 tiles: `PENDING_DEPOSIT`, `PENDING_CONFIRMED`, `CONFIRMED`, `MOBILISED`, `COMPLETED`, `CANCELLED`), each with a colored dot from a lookup object keyed `{PENDING, CONFIRMED, MOBILISED, COMPLETED, CANCELLED}`
**AND** the Bookings tab's own stats row instead groups the two pending statuses into a single "Pending Payments" tile (5 tiles total), via a locally-defined `BOOKING_STAT_GROUPS` array
**WHEN** an admin compared the two panels
**THEN** they disagreed on how bookings were grouped, and — separately — the Overview panel's `PENDING_DEPOSIT`/`PENDING_CONFIRMED` tiles rendered with no colored dot at all, since neither key matched the lookup object's `PENDING` key.

**Change**: `BOOKING_STAT_GROUPS` (label + which `BookingStatus` values it covers) was extracted from `BookingsTab.tsx` into a shared export in `adminFormat.ts`, so both tabs agree on the grouping definition. Each tab keeps its own color representation matching how it already renders color (`BookingsTab.tsx` needs Tailwind text-color classes for its stat cards; `OverviewTab.tsx` needs raw hex values for its dot's inline `style`), via a small `label → color` map local to each file. `OverviewTab.tsx`'s `bookingBreakdown` now reads `BOOKING_STAT_GROUPS` instead of the raw 6-status list, producing the same 5 tiles, same counts, and same colors as the Bookings tab — verified live against the real backend (both panels showed Pending Payments 15 / Confirmed 24 / Mobilised 20 / Completed 24 / Cancelled 7).

---

## 4. Known approximations & follow-ups

1. **Fleet/Users/Bookings data is a session-load snapshot, not live-polling.** All of it — including the newly-real Fleet deployment status — is fetched once when the Admin Dashboard mounts and held in local React state (`useApiResource`, no websocket/polling anywhere in the app). If an admin changes a booking's status in the Bookings tab, Fleet's derived `deploymentStatus` will not automatically re-derive; a browser refresh (which remounts everything and re-fetches) or a manual "Update Status" on the affected asset in the Fleet Board is needed to see it reflected. This is pre-existing app architecture, not introduced by CHANGE-03.
2. **"Most recent" bookings are ordered by id, not a real timestamp.** Neither the mock nor the real `Booking` type carries a `createdAt` field, so CHANGE-02's Recent Activity panel (and CHANGE-03's per-asset "confirmed/return due" dates) use booking id ordering / the booking's own `startDate`/`endDate` as the closest available proxies.
3. **`utilization`/`monthly-utilization` are real fields but their internal computation is unverified.** CHANGE-03 and the pre-existing Utilization Rate chart both consume `Asset.utilization`, which is genuinely present in the real backend's response (confirmed live, e.g. `0`, `19.35%`, `25.8%`) — but this document can only confirm the frontend isn't fabricating it, not how the backend computes it, since the backend's source isn't in this workspace (same caveat `Spec-admin-dashboard-api-mode-fixes.md` notes for its own backend-adjacent items).

---

## 5. Design

- **CHANGE-01/CHANGE-02** both follow the same pattern: find real data the dashboard already fetches for another panel, and reuse it rather than adding a new API call — `UserRow.spent` and `BookingRow[]` were both already computed in `AdminDataContext.tsx` for other tabs.
- **CHANGE-03** reuses the existing "on-rent today" date-window pattern already established by `buildOnRentAssetIds` (added in prior work, `Spec-admin-dashboard-api-mode-fixes.md`), extending it to also distinguish `CONFIRMED` vs `MOBILISED` and to carry richer per-asset detail, rather than introducing a new derivation approach.
- **CHANGE-04** shares one grouping definition (`BOOKING_STAT_GROUPS`) but deliberately keeps color representation per-consumer (Tailwind classes vs. hex), since forcing one format onto both panels' already-different rendering techniques (className vs. inline `style`) would have meant a larger, unrelated refactor of one of the two panels.
- All four changes were verified against the **real backend**, not just the mock server, using a disposable Playwright script (logged in as `ravi.kumar@example.sg`, screenshotted the relevant panel, deleted after each verification) — consistent with this app having no automated E2E coverage of the Admin Dashboard's real-backend behavior.

---

## 6. Verification

### 6.1 Checklist

- [x] CHANGE-01: `npx tsc --noEmit` and `npx eslint .` clean; Top Customers panel verified live against the real backend, ranking matches the Users tab's "Total Spent" column exactly, "View all →" navigates to Users
- [x] CHANGE-02: `npx tsc --noEmit` and `npx eslint .` clean; Recent Activity verified live, showing real booking ids/customers/statuses/dates sorted most-recent-first; confirmed no remaining references to `RentalLifecycle`/`LifecycleEvent`/`LIFECYCLE_META`/`LifecycleStatus`/`INITIAL_LIFECYCLES` anywhere in `src/`
- [x] CHANGE-03: `npx tsc --noEmit` and `npx eslint .` clean; verified live that Fleet Health's counts match the Fleet Board's column counts, and that every Fleet Board card/row's status, booking id, customer, and location are mutually consistent (no fake customer next to a real status)
- [x] CHANGE-04: `npx tsc --noEmit` and `npx eslint .` clean; verified live that the Overview "Booking Status" panel and the Bookings tab's stat row show identical labels, groupings, and counts, and that every tile (including "Pending Payments") has a colored dot

### 6.2 Manual smoke test

1. Run `npm run dev:api`, log in as admin (`ravi.kumar@example.sg` / `admin123`).
2. On the Overview tab, confirm "Top Customers" (not "Alerts") shows up to 3 ranked customers with real `S$` spend.
3. Confirm "Recent Activity" shows real booking ids (`RNT-xxxx`) with real customer names and statuses, not generic equipment-lifecycle text.
4. Confirm the "Fleet Health" donut's counts match the Fleet Board's per-column counts (Available/Booked/In-Transit/Maintenance).
5. Open the Fleet Board (kanban and table views) and confirm every Booked/In-Transit card shows a real booking id and customer, and every Maintenance card corresponds to an asset with condition "Needs Repair".
6. Confirm the Overview "Booking Status" panel's five tiles (Pending Payments/Confirmed/Mobilised/Completed/Cancelled) match the Bookings tab's stat row exactly, including colors.

---

## 7. Key decisions

| Decision | Rationale |
|----------|-----------|
| Reuse already-fetched data rather than add new API calls | `UserRow.spent` and `BookingRow[]` were already computed for other tabs; CHANGE-01/02 only needed to pass/read them, keeping the change surface small. |
| Remove the fake lifecycle data layer entirely rather than leave it unused | Once Recent Activity no longer read `lifecycles`, nothing else in the app did either — leaving ~200 lines of fictional seed data and its supporting types around would be dead code inviting future confusion. |
| Derive Fleet deployment from today's real bookings, not a live-syncing subscription | Matches the app's existing "fetch once per session" architecture (no websockets/polling anywhere); the Fleet Board's existing manual "Update Status" action remains the intended way to reflect changes after load. |
| Keep booking-status color representation separate per panel | `BookingsTab.tsx` and `OverviewTab.tsx` render color two different ways (Tailwind class vs. inline hex); sharing only the grouping/label data avoided forcing an unrelated rendering refactor onto either panel. |

---

## 8. Change control

| Version | Date | Notes |
|---------|------|--------|
| 0.1.0 | 2026-08-14 | Initial draft, documenting CHANGE-01 (Alerts → Top Customers), CHANGE-02 (Recent Activity wired to real bookings, fake lifecycle data removed), CHANGE-03 (Fleet deployment status/assignment/location wired to real bookings + condition), and CHANGE-04 (Booking Status panel grouping unified with the Bookings tab, missing dot-color bug fixed). All verified live against the real backend (`heavy-rental-rest-api`) in `npm run dev:api` mode. |
