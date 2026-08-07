# Specification: Browse Equipment & Shared Date Validation

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-07
**Status**: Draft / Live Verification
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

- Payment gateway integration
- Production deployment behavior
- Non-browse/admin workflows unless they directly affect the same booking dates

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

## 5. Manual Validation Checklist

Use this checklist during local verification.

- [ ] Start the app with the expected backend configuration.
- [ ] Open the browse/equipment view.
- [ ] Confirm equipment loads successfully.
- [ ] Confirm only the approved equipment set is displayed.
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
- [Add new entries here whenever behavior changes, bugs are fixed, or the implementation diverges from this spec.]

## 7. Notes for Future Updates

- If the implementation changes, update this document alongside the code change.
- If a behavior is found to be inaccurate or incomplete compared with the current UI, add a note here with the date, symptom, and fix.
- This file should be treated as the authoritative lightweight spec for the browse/date validation work while the broader product/API specs remain the reference for end-to-end business rules.
