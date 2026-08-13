# Specification: Site Address — Postal Code Auto-Detection & Validation

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-13
**Status**: Draft / Live Verification
**Purpose**: Capture the change to how the delivery-site postal code is captured at checkout — from a separate, independently-validated input to a value auto-derived from the site address itself — and its knock-on effect on the cart summary display.

## 1. Overview

`SiteAddressModal` (`src/features/checkout/SiteAddressModal.tsx`) is the modal used at checkout to collect `Booking.siteAddress`/`sitePostalCode`/`deliveryNotes` (captured once per cart, right after the first successful "Select"). It previously asked for the site address and its postal code as two independent free-text inputs, each with its own validation. Postal code is now derived automatically from the end of the address the user types, removing the second input and the class of bugs where the two values disagreed or the postal code was entered inconsistently (e.g. `"S(619094)"` vs `"619094"`).

## 2. Scope

### In scope

- `src/features/checkout/SiteAddressModal.tsx` — the postal-code derivation, updated validation/error copy, and the read-only postal code field.
- `src/features/checkout/CartDrawer.tsx` — the delivery-site summary line, which used to append the postal code separately and now shows the (already-combined) address as-is.

### Out of scope

- `src/App.tsx`'s `sitePostalCode` state and its use in the mock-mode `bookingApi.create()` payload — unchanged; still populated from the modal's `onSave(address, postalCode, notes)` callback, just now sourced from the derived value instead of a second input.
- The real-backend booking contract (`CreateBookingRequest`, `src/app/api.ts`) — it only ever carried `siteAddress` (no separate postal field); already covered by `Spec-stripe-payment-checkout.md`.
- `mock/db.json`'s seed `sitePostalCode` values (e.g. `"S(619094)"`) — pre-existing seed data, not produced by this flow.

## 3. Changes

### 3.1 Postal code is now derived from the address, not entered separately

New helper in `SiteAddressModal.tsx`:

```ts
function derivePostalCode(address: string): string {
  const last6 = address.trim().slice(-6);
  return /^\d{6}$/.test(last6) ? last6 : "";
}
```

The modal's local form state no longer holds a `postalCode` field — only `{ address, notes }`. `derivedPostalCode` is computed via `useMemo(() => derivePostalCode(form.address), [form.address])` on every keystroke of the address input, so it updates live as the user types.

### 3.2 Postal Code field is now read-only

The "Postal Code" input is no longer an editable, independently-required field with its own asterisk. It's now `readOnly`, always mirrors `derivedPostalCode`, and its label reads "Postal Code (auto-detected from address)" instead of carrying the required-field marker. Placeholder text is `"Will appear once typed above"` when empty.

### 3.3 Validation moved onto the combined address

`handleSave`'s postal-code check now runs against the derived value instead of a second field:

- Site address is still required (unchanged: `"Site address is required."` if blank).
- The postal-code regex (`/^\d{6}$/`) now tests `derivedPostalCode` rather than a separate `form.postalCode`. The error copy changed accordingly, from `"Postal code must be a 6-digit number, e.g. 619094."` to:

  > `Address must end with a 6-digit postal code, e.g. "...Jurong Port Road, 619094".`

- `onSave(address, postalCode, notes)`'s signature is unchanged — callers still receive address and postal code as two separate strings; only where the postal code comes from changed (`derivedPostalCode` instead of a second input's value).

### 3.4 Copy updates guiding the new input shape

- Placeholder for the address field: `"e.g. 20 Jurong Port Road, 619094"` (previously `"e.g. 20 Jurong Port Road"`, with no postal code hint).
- Modal intro copy: `"...One address covers the whole booking — include the postal code at the end."` (previously stopped at "One address covers the whole booking.").

### 3.5 `CartDrawer` — removed the now-duplicated postal code

Since `siteAddress` now already ends with the postal code, `CartDrawer.tsx`'s delivery-site summary line no longer appends it separately:

- Before: `{siteAddress ? \`${siteAddress}, ${sitePostalCode}\` : "No delivery address set yet."}`
- After: `{siteAddress || "No delivery address set yet."}`

The `sitePostalCode` prop was dropped from `CartDrawer`'s props entirely, and its call site in `App.tsx` (`<CartDrawer siteAddress={siteAddress} ... />`) no longer passes it.

## 4. Manual Validation Checklist

- [ ] Type an address with no trailing 6-digit number (e.g. `"20 Jurong Port Road"`) — Postal Code field stays empty, and clicking Save shows the "Address must end with a 6-digit postal code..." error.
- [ ] Type an address ending in 6 digits (e.g. `"20 Jurong Port Road, 619094"`) — Postal Code field auto-populates with `619094` and Save succeeds.
- [ ] Confirm the Postal Code input cannot be typed into directly (read-only).
- [ ] Confirm leaving the address blank still shows "Site address is required." before the postal-code check runs.
- [ ] Open the cart drawer after saving a valid address — confirm the delivery-site line shows the full address once, with no duplicated or re-appended postal code.
- [ ] Complete a mock-mode booking (`npm run dev:mock`) and confirm `sitePostalCode` is still recorded on the created rental plan/booking, sourced from the derived value.

## 5. Change Log

- 2026-08-12: Postal code auto-derivation and updated validation added to `SiteAddressModal.tsx` (`derivePostalCode()`, read-only Postal Code field, updated error/help copy). Commit `130cd65`.
- 2026-08-13: Removed the now-duplicate postal code from `CartDrawer.tsx`'s delivery-site summary line (previously `${siteAddress}, ${sitePostalCode}`, now `siteAddress` alone) and dropped the unused `sitePostalCode` prop. Commit `80d4077`.
- 2026-08-13: Created this document to capture both changes above; see `Spec-equipment-card-detail-changes.md` and `Spec-browse-equipment-date-validation.md` for the sibling docs this follows in structure.
