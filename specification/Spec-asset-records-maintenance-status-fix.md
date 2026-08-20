# Specification: Asset Records — Maintenance Status Double-Counting Fix

| Field | Value |
|-------|--------|
| **Feature** | Admin Asset Records Tab — Fixing Incorrect Stat Counts Caused by Overlapping On-Rent/Maintenance Status |
| **Status** | Implemented — CHANGE-01 completed, `tsc`/`eslint` clean |
| **Module** | `heavy-rental-web-portal` |
| **Primary surface** | Admin dashboard Asset Records tab (`src/features/admin/assets/AssetsTab.tsx`) |
| **Branch** | `207-fix-dashboard-incorrect-number` |
| **Related code** | `src/features/admin/assets/AssetsTab.tsx`, `src/features/admin/AdminDataContext.tsx` (`buildFleetAssets`, source of the mutually-exclusive-status convention this change now matches) |
| **Related spec** | [`Spec-admin-overview-real-data-wiring.md`](./Spec-admin-overview-real-data-wiring.md) — CHANGE-03 of that document established `Maintenance` (derived from `Asset.condition === "NEEDS_REPAIR"`) as an override that takes priority over booking-derived status on the Overview/Fleet Board tabs; this document extends the same convention to the Asset Records tab, which had been left out of that pass |

This document records one change that fixed the Asset Records tab's stat row and status badges showing counts inconsistent with the rest of the admin dashboard, because an asset that was both on-rent and flagged `NEEDS_REPAIR` was counted in two overlapping buckets instead of one.

---

## 1. Outcomes

When this change is correct:

1. On the Asset Records tab, every asset falls into exactly one of three mutually exclusive states — Available, On Rent, or Maintenance — so the four stat tiles (Total Assets / Available / On Rent / Need Service) sum consistently instead of double-counting.
2. An asset flagged `NEEDS_REPAIR` always displays a "Maintenance" badge, even if it also has an active booking today — matching how the Overview tab and Fleet Board already treat the same asset via `buildFleetAssets`.

---

## 2. Scope

### 2.1 In scope

- The Asset Records tab's header subtitle, stats row, and per-row status badge (`AssetsTab.tsx`).

### 2.2 Out of scope

- `buildFleetAssets`/`AdminDataContext.tsx` — already implements this priority correctly (CHANGE-03 of `Spec-admin-overview-real-data-wiring.md`); this change only brings the Asset Records tab's own, separately-computed status logic in line with it.
- Backend changes of any kind — this is a frontend-only correction of how the already-fetched `AssetRecord.condition` and `onRentAssetIds` are combined for display.

---

## 3. Changes

### CHANGE-01: `isMaintenance` given priority over `isOnRent`/`isAvailable`

**GIVEN** the Asset Records tab computed status from `onRentAssetIds.has(a.id)` alone (`isOnRent`) and treated "Need Service" as a fully independent filter on `a.condition === "NEEDS_REPAIR"`, so `isAvailable` was simply `!isOnRent(a)`
**AND** these checks were not mutually exclusive — an asset flagged `NEEDS_REPAIR` but not currently booked satisfied `!isOnRent(a)` and so was counted as "Available," and an asset that was both on-rent today and flagged `NEEDS_REPAIR` satisfied both `isOnRent` and the service filter
**AND** the Overview tab / Fleet Board's `buildFleetAssets` (`AdminDataContext.tsx:354`) already excluded `NEEDS_REPAIR` assets from `Available` (`inMaintenance ? "Maintenance" : (link?.deploymentStatus ?? "Available")`)
**WHEN** an admin compared the "Available" count on the Asset Records tab against the "Available" count on the Overview tab's Fleet Health panel or the Fleet Board
**THEN** the two numbers disagreed — every needs-repair-but-not-booked asset was counted as Available on Asset Records but as Maintenance (not Available) on Overview/Fleet Board — and separately, an on-rent-and-needs-repair asset was double-counted (into both "On Rent" and "Need Service") so the Asset Records tab's own four stat tiles could sum to more than `assets.length`. The row badge for such an asset also showed "On Rent" (amber) on Asset Records while the same asset showed "Maintenance" on the other two tabs.

**Change**: `AssetsTab.tsx` now defines three helpers instead of one — `isMaintenance = (a) => a.condition === "NEEDS_REPAIR"`, `isOnRent = (a) => onRentAssetIds.has(a.id) && !isMaintenance(a)`, `isAvailable = (a) => !onRentAssetIds.has(a.id) && !isMaintenance(a)` — so maintenance status overrides booking status, matching `buildFleetAssets`'s existing `inMaintenance ? "Maintenance" : (link?.deploymentStatus ?? "Available")` convention (`AdminDataContext.tsx`). The header subtitle, the "Available"/"On Rent"/"Need Service" stat tiles, and the per-row status badge (previously binary On Rent/Available, now On Rent/Available/Maintenance with a red badge for the new case) all switched from the old `isOnRent(a)`/inline `a.condition === "NEEDS_REPAIR"` checks to the three new mutually-exclusive helpers.

---

## 4. Known approximations & follow-ups

1. **Still a session-load snapshot, not live-polling** — `onRentAssetIds` and `assets` are fetched once per session like the rest of the admin dashboard (see item 1 of `Spec-admin-overview-real-data-wiring.md` §4); this change doesn't alter that, only how the already-fetched values are combined for display.

---

## 5. Design

- Mirrors the priority rule `buildFleetAssets` already established for the Overview tab and Fleet Board (CHANGE-03, `Spec-admin-overview-real-data-wiring.md`) rather than inventing a new convention — `NEEDS_REPAIR` always wins, independent of booking state.
- Kept the fix local to `AssetsTab.tsx`'s own status helpers rather than routing the tab through `buildFleetAssets`'s `FleetAsset.deploymentStatus`, since the Asset Records tab only needs a 3-way Available/On Rent/Maintenance split (not Fleet's 4-way split with `In-Transit`), and doing so avoided a larger unrelated refactor of the tab's data source.

---

## 6. Verification

### 6.1 Checklist

- [x] CHANGE-01: `npx tsc --noEmit` and `npx eslint .` clean; the four stat tiles are mutually exclusive and sum to `assets.length` for any asset that is both on-rent and `NEEDS_REPAIR`

### 6.2 Manual smoke test

1. Run `npm run dev:api` (or mock mode), log in as admin.
2. Open the Asset Records tab.
3. Find (or temporarily flag) an asset that is both on-rent today and has condition "Needs Repair."
4. Confirm its row badge reads "Maintenance" (red), not "On Rent" (amber).
5. Confirm Available + On Rent + Need Service sums to Total Assets.
6. Confirm the same asset shows "Maintenance" on the Overview tab's Asset Health Snapshot and the Fleet Board — status agrees across all three tabs.
7. Find a separate asset that needs repair but is *not* currently booked. Confirm its Asset Records badge reads "Maintenance," and that the Asset Records "Available" count now matches the Overview tab's Fleet Health "Available" count (previously the Asset Records number was higher, since it wrongly included needs-repair-but-unbooked assets).

---

## 7. Key decisions

| Decision | Rationale |
|----------|-----------|
| Maintenance overrides on-rent/available, not the other way around | Matches the convention already established by `buildFleetAssets` (`Spec-admin-overview-real-data-wiring.md` CHANGE-03) — a needs-repair asset shouldn't read as bookable/available anywhere in the admin dashboard, regardless of whether it also happens to have an active booking today. |
| Local helper functions in `AssetsTab.tsx` rather than reusing `FleetAsset.deploymentStatus` | The tab only needs a 3-way split; adopting Fleet's 4-way `deploymentStatus` would have required an unrelated data-source refactor of the tab for no added benefit. |

---

## 8. Change control

| Version | Date | Notes |
|---------|------|--------|
| 0.1.0 | 2026-08-20 | Initial draft, documenting CHANGE-01 (Asset Records tab's stat tiles and status badge made mutually exclusive by giving `NEEDS_REPAIR` priority over on-rent/available, matching the Overview/Fleet Board convention). |
