# Specification: Cart Hydration & Duplicate-Add Fixes

| Field | Value |
|-------|--------|
| **Feature** | Customer Portal — Rental Plan Cart Hydration Gaps and Duplicate-Item Bug |
| **Status** | Implemented — CHANGE-01 through CHANGE-03 completed |
| **Module** | `heavy-rental-web-portal` |
| **Primary surface** | Customer Portal equipment browsing/cart flow (`src/features/customer/CustomerPortal.tsx`, `src/features/browse/EquipmentGrid.tsx`, `src/features/customer/EquipmentDetailPage.tsx`) |
| **Method** | Manual bug reports reproduced against the real Spring Boot backend (`heavy-rental-rest-api`) in `npm run dev:api` mode; each fix verified with `npx tsc --noEmit` and `npx eslint` |
| **Related code** | `src/features/customer/CustomerPortal.tsx`, `src/features/browse/EquipmentGrid.tsx`, `src/features/customer/EquipmentDetailPage.tsx` |
| **Environment context** | [`Spec-rental-plan-cart-checkout.md`](./features/Spec-rental-plan-cart-checkout.md) (the feature this document patches — establishes the server-persisted `RentalPlan` cart model these bugs live in) |

This document records three bugs found in the persisted-cart flow introduced by `Spec-rental-plan-cart-checkout.md`. All three share one shape: local component state (`useState`) that isn't rehydrated from — or checked against — the server-persisted `RentalPlan` on reload/re-render, so the UI drifts out of sync with what the backend actually has on record.

---

## 1. Outcomes

When these changes are correct:

1. Reloading or re-entering the Customer Portal with an existing non-empty rental plan restores the shared start/end dates from that plan, instead of leaving them stuck at "Select date" with every "Select" button disabled (CHANGE-01).
2. The same reload/re-entry also restores the plan's saved delivery address, instead of re-prompting for it on the next add-to-cart action (CHANGE-02).
3. Clicking "Select" on a piece of equipment already in the cart is a no-op — both when clicked rapidly (double-click) and when clicked again after the first request has already completed — instead of adding duplicate `RentalPlanItem`s for the same asset (CHANGE-03).

---

## 2. Scope

### 2.1 In scope

- The cart-hydration `useEffect` in `CustomerPortal.tsx` that restores `cart`/`planId`/`planItemIds` from the customer's persisted `RentalPlan` on mount.
- `addToCart`'s guard conditions in `CustomerPortal.tsx`.
- The "Select" button's disabled/label state in `EquipmentGrid.tsx` (catalog grid) and `EquipmentDetailPage.tsx` (detail page) — both render a "Select" CTA against the same `onAddToCart`/`addToCart` path.

### 2.2 Out of scope

- The site-address postal-code validation bug (`siteAddress` not ending in a 6-digit postal code) — being fixed separately on a teammate's branch; not touched here.
- Restoring `sitePostalCode`/`deliveryNotes` independently after reload — the backend's `RentalPlanResponse` only persists the combined `siteAddress` string (`Spec-rental-plan-cart-checkout.md` §B8), so these two fields cannot be recovered separately from the plan alone. A reload therefore still shows a blank postal-code/notes field if the customer re-opens the "Edit" delivery modal, even though the full address line itself is correctly restored (CHANGE-02). Flagged, not fixed here.
- Cleaning up rental-plan-item rows already duplicated server-side by CHANGE-03's bug before this fix shipped — those must be removed manually (trash icon in the cart panel) per plan; no bulk-delete tooling was built.
- The earlier, separate login-ordering 401 bug (`/api/users` called before the bearer token was set) — already fixed prior to this document, unrelated code path.

---

## 3. Changes

### CHANGE-01: Shared start/end dates not restored on cart hydration

**GIVEN** a customer has an existing non-empty `RentalPlan` (e.g. from a prior session)
**WHEN** they reload the page or re-enter the Customer Portal
**THEN** the cart-hydration effect restored `cart`, `planItemIds`, and `planId` from the persisted plan, but never restored `sharedStartDate`/`sharedEndDate` from that same plan's `startDate`/`endDate` fields.

**Symptom**: `DateRangeBar` shows "Select date" for both fields, and — because it also locks itself (`locked={cart.length > 0}`) the moment the cart is non-empty — the customer has no way to set them manually either. Since every "Select" button across the catalog is gated on `sharedStartDate && sharedEndDate` being non-null, this disabled *every* equipment card's "Select" button, not just the ones for equipment other than what's already in the cart, with no error message — clicks simply did nothing.

**Change**: the hydration effect (`CustomerPortal.tsx:153-183`) now also calls `setSharedStartDate(active.startDate)` and `setSharedEndDate(active.endDate)` right after restoring `cart`/`planItemIds`/`planId`, reading from the same `active: RentalPlanResponse` already fetched for that purpose.

### CHANGE-02: Delivery address not restored on cart hydration

**GIVEN** a customer has already supplied a delivery address for their active rental plan (persisted server-side on `RentalPlanResponse.siteAddress`)
**WHEN** they reload the page or re-enter the Customer Portal, then click "Select" to add another item
**THEN** the local `siteAddress`/`siteAddressPrompted` state (reset to `""`/`false` on every remount, never rehydrated) caused `addToCart`'s `!siteAddressPrompted` check to re-fire, popping the delivery-address modal open again — even though the backend already had a saved address for this exact plan.

**Change**: the same hydration effect (`CustomerPortal.tsx:172-180`) now also does, immediately after restoring the dates:
```ts
if (active.siteAddress) {
  setSiteAddress(active.siteAddress);
  setSiteAddressPrompted(true);
}
```
`siteAddressPrompted` is set alongside `siteAddress` (not left for the `!siteAddress.trim()` guards to infer) because `addToCart`'s prompt-on-first-add branch (`CustomerPortal.tsx:325-327` era logic) is keyed on `siteAddressPrompted`, not directly on `siteAddress` being non-empty — restoring only `siteAddress` without also marking the plan as already-prompted would have left that branch mis-firing on the next add regardless.

### CHANGE-03: Duplicate cart items from repeated "Select" clicks

**GIVEN** a customer clicks "Select" on an equipment card
**WHEN** they click "Select" again — either as a fast double-click before the first request resolves, or as a separate deliberate click after the item is already in the cart
**THEN** `addToCart` had no guard against either case: a fast double-click fired two concurrent `rentalPlanCartApi.addItem()` POSTs for the same `assetId` before `cart` re-rendered to reflect the first one, and — separately, more commonly — the "Select" button remained enabled and labeled "Select" even after the item was already in the cart, so repeated clicks kept adding duplicate `RentalPlanItem` rows with no guard or user feedback at all.

**Change**, three parts, all in `CustomerPortal.tsx` / the two "Select" button call sites:
1. **In-flight guard** (`CustomerPortal.tsx:84`, `310`, `353`, `370`): a `useRef<Set<number>>` (`pendingAddIds`), not `useState`, tracks equipment ids with an `addItem` request currently in flight. A `ref` was used specifically because a fast double-click can happen before React re-renders — a `useState`-backed guard would still let both clicks through, since neither click's `setState` has taken effect yet when the second one fires. `addToCart` bails immediately if the clicked equipment id is already pending, and clears it in a `finally` regardless of success/failure.
2. **Already-in-cart guard** (`CustomerPortal.tsx:315`): `addToCart` now also bails immediately if `cart.some((c) => c.equipment.id === item.equipment.id)` — this is the fix for the more common, non-double-click case, where the in-flight guard alone doesn't help because the first request has already completed by the time of the second click.
3. **Button state** (`EquipmentGrid.tsx:172-173,188,196`; `EquipmentDetailPage.tsx:394-395,406,414`): both "Select" buttons now also disable when `inCart` is true (an existing `inCart` boolean both files already computed for the "In Cart" badge, previously unused by the button itself) and relabel to "Added", giving explicit visual feedback instead of staying clickable with no visible effect.

Mock mode (`npm run dev:mock`) was not separately guarded — its `addToCart` branch (`CustomerPortal.tsx`, `!isApiMode` branch) already replaces any existing entry for that equipment id via `filter` + push before appending, so it was already idempotent against repeated calls; the new guards are a no-op there, not a behavior change.

---

## 4. Known approximations & follow-ups

1. **Pre-existing duplicate rows are not auto-cleaned.** CHANGE-03 stops *new* duplicates from being created; any `RentalPlanItem` rows already duplicated server-side by this bug before the fix shipped remain on affected plans and must be removed manually via the trash icon in the cart panel.
2. **`sitePostalCode`/`deliveryNotes` still don't survive a reload independently** — see §2.2. Only the combined `siteAddress` string is restorable, since that's the only one of the three fields the backend persists on `RentalPlanResponse`.
3. Both CHANGE-01 and CHANGE-02 only run in API mode (`isApiMode` gate on the hydration effect) — mock mode has no server-persisted plan to hydrate from and is unaffected by either bug or fix.

---

## 5. Design

- Both CHANGE-01 and CHANGE-02 follow the same pattern: the hydration effect already fetches the full `active: RentalPlanResponse` to rebuild `cart`; the fix is reading two more fields (`startDate`/`endDate`, `siteAddress`) off an object already in hand, rather than adding a new request.
- CHANGE-03's in-flight guard deliberately uses a `ref`, not `state` — this is a case where React's batched/async state updates are the wrong tool for a same-tick double-click race, and a synchronously-read-and-set `ref` is the correct primitive.
- CHANGE-03's "already in cart" guard and the button's `disabled={inCart}` are deliberately both present rather than either alone: the button state prevents the click from firing in the common case (good UX, immediate feedback), while the guard inside `addToCart` is the actual correctness backstop for any call path that doesn't go through the button's `disabled` prop (e.g. `handleSharedEndDateSelected`'s "Add All" flow shares `addToCart`'s underlying safety by living in the same component, though it has its own separate per-item `cart.some(...)` skip already).

---

## 6. Verification

### 6.1 Checklist

- [x] CHANGE-01: `npx tsc --noEmit` and `npx eslint` clean; manually verified that reloading with a non-empty active plan shows the plan's real dates in the date bar and re-enables "Select" on other equipment
- [x] CHANGE-02: `npx tsc --noEmit` and `npx eslint` clean; manually verified that reloading with a saved delivery address does not re-open the address modal on the next "Select" click
- [x] CHANGE-03: `npx tsc --noEmit` and `npx eslint` clean; manually verified that rapid double-clicking "Select" adds only one line item, and that clicking "Select" again on an already-added card is disabled and labeled "Added"

### 6.2 Manual smoke test

1. Run `npm run dev:api`, log in, add an item to the cart, and set a delivery address.
2. Reload the page. Confirm the date bar shows the real dates (not "Select date") and other equipment cards' "Select" buttons are clickable.
3. Click "Select" on a different equipment card. Confirm the delivery-address modal does **not** reopen.
4. Rapidly double-click "Select" on an equipment card not yet in the cart. Confirm only one line item appears in the Rental Plan panel.
5. Click "Select" again on a card already in the cart. Confirm the button is disabled and reads "Added" rather than adding a second line item.

---

## 7. Key decisions

| Decision | Rationale |
|----------|-----------|
| Restore dates/address by reading fields off the already-fetched `RentalPlanResponse`, not a new API call | The hydration effect already fetches the full plan to rebuild `cart`; both bugs were a matter of not reading two more fields off an object already in hand. |
| Use a `ref`, not `state`, for the in-flight add guard | A double-click can fire before React re-renders; a `state`-backed guard wouldn't reliably block the second click in time, whereas a `ref` is read and set synchronously. |
| Keep both the button-level `disabled={inCart}` and the `addToCart`-level `cart.some(...)` guard | The button state is the primary UX fix (visible, immediate); the guard inside `addToCart` is the correctness backstop for any call path that doesn't route through that specific button. |
| Don't attempt to restore `sitePostalCode`/`deliveryNotes` after reload | The backend doesn't persist them separately from the combined `siteAddress` string on `RentalPlanResponse` — there's nothing to read back. Flagged as a known gap rather than worked around. |

---

## 8. Change control

| Version | Date | Notes |
|---------|------|--------|
| 0.1.0 | 2026-08-17 | Initial draft, documenting CHANGE-01 (shared dates not restored on cart hydration), CHANGE-02 (delivery address not restored on cart hydration), and CHANGE-03 (duplicate cart items from repeated "Select" clicks — missing in-flight guard and missing already-in-cart guard). All verified with `npx tsc --noEmit` / `npx eslint`; CHANGE-01/02 additionally verified by manual reload testing. |
