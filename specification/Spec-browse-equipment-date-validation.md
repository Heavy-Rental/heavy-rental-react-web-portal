# Specification: Browse Equipment & Shared Date Validation

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-07
**Status**: Implemented (browse + shared-date behavior still current; Know/Browse wording updated 2026-08-30)
**Purpose**: Capture the expected behavior for the browse-equipment experience and the shared date-range flow, and log any changes, fixes, or discrepancies discovered during validation.

## 1. Overview

The browse equipment journey and the shared rental-date workflow are considered critical paths for the portal. This specification complements the broader product and API specs by focusing on the specific behavior that should be validated manually or during later regression checks.

This document is intended to be a living change log for the browse flow, especially around:

- equipment listing and filtering
- shared date selection
- cart behavior and checkout normalization
- error handling when data or dates are invalid

## 2. Scope

### In scope

- Equipment catalog browsing from the landing and customer portal views
- Shared start/end date selection through the date bar
- Add-to-cart behavior for selected equipment
- Checkout normalization of multiple cart items to one booking window
- Loading and error states while equipment/depot data is being fetched

### Out of scope

- Payment gateway integration (see `Spec-stripe-payment-checkout.md`)
- Production deployment behavior
- Non-browse/admin workflows unless they directly affect the same booking dates
- The retired "I'm Just Browsing" onboarding option — catalog browse is the "I Know What I Want" path (`Spec-customer-portal-bugfixes.md` CHANGE-07)

## 3. Expected Behavior

### 3.1 Browse equipment

- The browse view must load equipment data from the configured API-backed source.
- The visible equipment catalog must reflect the approved fleet set used by the app.
- The UI must not show outdated or non-approved categories in the browse view.
- Filters and category tiles must stay consistent with the actual equipment data shown.

### 3.2 Shared date selection

- The user must be able to choose one shared start date and one shared end date.
- Once selected, those dates should be applied consistently to items added to the cart.
- The UI must clearly support the concept of one booking window for the full cart.
- Past dates should appear visually disabled/greyed out in the calendar and should not be selectable.
- The restriction should apply in both the browse equipment flow and the equipment detail flow where the shared date picker is used.

### 3.2.1 Instant Quote → DateRangeBar

After **Add All to Rental Plan** on the Instant Quotation screen, `CustomerOnboarding` resolves a window from the quote DTO and passes it through the existing `onDone` callback. `CustomerPortal` seeds the same `sharedStartDate` / `sharedEndDate` state the `DateRangeBar` already reads (`App.tsx` ~1326). DateRangeBar itself is unchanged.

Resolution uses only:

1. `tentativeStartDate` + `tentativeEndDate` when both are valid ISO `YYYY-MM-DD` and start ≤ end
2. else `tentativeStartDate` + `days` (end = start + days − 1, inclusive)
3. else `days` alone (start = today, end = today + days − 1)

A start in the past is clamped to today, keeping the same duration. Know-what-I-want onboarding still leaves the bar empty. After Add All, recommended machines appear in the specs banner and are added to the Rental Plan with those quote dates (`applySpecsRecsToPlan`). Delivery Details is not opened. Each card **Select** / **Selected** still toggles that machine (`toggleSpecsRecInPlan`). Thumbnails use quote `equipment.img` via `equipmentImageSrc`. Proceed to Deposit stays disabled until a delivery address is saved; the cart **Add** address control is highlighted while the plan has items and no address. This path does **not** set `pendingAutoAdd`. If the quote has no usable dates, the cart stays empty, the bar opens, and Select stays disabled until the user sets dates.

### 3.3 Cart and checkout

- If multiple items are added to the cart, they must be treated as one rental window.
- If a cart contains items with incompatible date ranges, the UI should warn or prevent invalid checkout behavior.
- Checkout should normalize the booking range to the earliest start date and latest end date across the cart.
- The created booking should reflect that normalized date range.

### 3.4 Error and loading states

- If the equipment or depot data is still loading, the UI should show an explicit loading state.
- If the request fails, the UI should show a readable error state rather than a blank screen or crash.

## 4. Acceptance Criteria

1. The browse page loads equipment successfully and displays the expected approved equipment set.
2. The shared date bar works as the single source of truth for cart item selection.
3. Cart items can be added with a shared date range without breaking the booking flow.
4. Checkout uses a normalized booking window based on the cart contents.
5. The UI provides a clear inline error when date/cart data is invalid.
6. The page shows loading and error states correctly when the backend is slow or unavailable.
7. After Add All to Rental Plan, when the quote has `tentativeStartDate` / `tentativeEndDate` (or `days`), the shared date bar shows that window without the user picking dates again, and every specs-banner Select is enabled so the customer can add machines individually.

## 5. Manual Validation Checklist

Use this checklist during local verification.

- [ ] Start the app with the expected backend configuration.
- [ ] Open the browse/equipment view and verify the page loads correctly.
- [ ] Open the equipment detail view and verify the date picker is available there as well.
- [ ] Confirm equipment loads successfully.
- [ ] Confirm only the approved equipment set is displayed.
- [ ] Verify that past dates are greyed out and cannot be selected in the shared date picker.
- [ ] From Instant Quote, click Add All to Rental Plan and confirm the date bar is prefilled from `tentativeStartDate` / `tentativeEndDate` (mock: 2026-09-01 – 2026-09-21).
- [ ] Confirm every specs-banner Select is enabled and clicking one adds only that machine.
- [ ] Confirm Know-what-I-want still leaves the date bar empty.
- [ ] Select a shared start and end date.
- [ ] Add one or more equipment items to the cart.
- [ ] Confirm the cart reflects the shared date range.
- [ ] Try a conflicting date scenario and confirm the UI handles it correctly.
- [ ] Complete checkout and verify the booking uses the normalized date range.
- [ ] Confirm loading and error states behave correctly when the backend is unavailable.

## 6. Change Log / Deviation Log

Use this section to record any change made during validation or implementation.

- 2026-08-07: Created this specification to track browse-equipment and shared-date validation behavior.
- 2026-08-07: Initial review of browse flow and shared date handling completed.
- 2026-08-07: Added validation note for disabling past dates in the shared date picker on both the browse equipment page and the equipment detail page.
- [Add new entries here whenever behavior changes, bugs are fixed, or the implementation diverges from this spec.]

## 7. Notes for Future Updates

- If the implementation changes, update this document alongside the code change.
- If a behavior is found to be inaccurate or incomplete compared with the current UI, add a note here with the date, symptom, and fix.
- This file should be treated as the authoritative lightweight spec for the browse/date validation work while the broader product/API specs remain the reference for end-to-end business rules.
- 2026-08-09: `DateRangeBar.tsx` computes `today`/`todayISO` in two separate places — once inside `handleDayClick`, once in the component's render scope. Cosmetic today (both derive `new Date()` the same way), but a future change to one without the other would desync the past-date-disabling logic from the click handler's own date check. Worth consolidating into a single computed value next time this file is touched.
- 2026-08-13: After Add All to Rental Plan, Instant Quote `tentativeStartDate` / `tentativeEndDate` / `days` seed the existing shared date-bar state (`resolveQuoteDates` → optional `onDone` argument → `setSharedStartDate` / `setSharedEndDate`). DateRangeBar and `handleSharedEndDateSelected` are unchanged.
- 2026-08-13: Add All no longer queues `pendingAutoAdd`. Dates seed the bar so every specs-banner Select is enabled; the customer adds individual machines via existing `addToCart`.
- 2026-08-13: Specs-banner Select toggles Rental Plan membership without opening Delivery Details. Quote `equipment.img` drives the card thumbnail. Cart **Proceed to Deposit** is disabled until a delivery address is saved; **Add** is highlighted when the plan has items and no address.
- 2026-08-13: Add All to Rental Plan seeds quote dates and puts every recommended match into the Rental Plan (`applySpecsRecsToPlan`). Delivery Details is not opened; the customer can still toggle cards off. If quote dates are missing, the cart stays empty until dates are set.
- 2026-08-13: After Add All (`onboardingMode === "specs"`), equipment-card and detail **Select** still use `addToCart` but skip the Delivery Details modal. Know-what-I-want still opens it on first add.
- 2026-08-13: Automated coverage — `src/lib/dateFormat.test.ts` (`resolveQuoteDates`), `src/features/checkout/specsPlan.test.ts` (`buildQuoteCartItems`, `shouldPromptDeliveryDetails`, `toggleEquipmentInPlan`), `src/features/browse/equipmentImageSrc.test.ts`, `src/features/checkout/CartDrawer.test.tsx`. Run with `npm test`.
