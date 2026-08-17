# Specification: Site Address — Postal Code Auto-Detection & Validation

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-13
**Status**: Historical — superseded, see note below
**Purpose**: Capture the change to how the delivery-site postal code is captured at checkout — from a separate, independently-validated input to a value auto-derived from the site address itself — and its knock-on effect on the cart summary display.

> **Superseded.** This document captures the *original* client-side-only auto-derivation change (§3.1's
> `derivePostalCode()`/`.slice(-6)` snippet is no longer accurate — it was replaced by `extractPostalCode()`
> + an OneMap fallback lookup, per this doc's own §5 2026-08-13 entry, though §3.1's body was never updated
> to match). §3.3's unconditional Save-blocking and its exact error copy are also stale — validation was
> later removed from Save entirely, then reintroduced scoped to API mode only, now backed by a real backend
> check. For current behavior and the backend-authoritative validation built on top of this, see
> [`specification/features/spring contract/postal-code-validation.md`](./features/spring%20contract/postal-code-validation.md) (Spring team's
> handoff contract for `GET /api/postalCodes/{postalCode}`) and
> [`specification/features/postal-code-validation-execution-plan.md`](./features/postal-code-validation-execution-plan.md)
> (frontend execution plan / current status). This document is kept as the historical record of the original
> design decision, not as a description of current behavior.

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

**Stale as of the OneMap addition (§5, 2026-08-13) — kept for historical context only.** The snippet below
was replaced by `extractPostalCode()` (regex match anywhere in the address) plus `lookupSingaporePostal()`
(OneMap fallback when no digits are typed) — see `src/lib/sgPostal.ts` for the current implementation.

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

**Stale — see `postal-code-validation-execution-plan.md` for current behavior.** The exact error copy below
no longer exists in the code, and Save no longer blocks unconditionally on a missing postal code: that check
was removed entirely at one point, then reintroduced scoped to API mode only (mock mode still allows saving
with a blank postal code), and is now backed by a real backend validation call rather than just a client-side
regex.

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

- [ ] Type an address with no postal code (e.g. `"20 Jurong Port Road"`) — after a short pause, Postal Code fills with `619094` from OneMap and Save succeeds.
- [ ] Type an address containing 6 digits (e.g. `"20 Jurong Port Road, 619094"`) — Postal Code fills immediately from the typed digits, without waiting on OneMap.
- [ ] Type a non-Singapore / unmatched address — Postal Code stays empty and Save explains that no postal code was found.
- [ ] Confirm the Postal Code input cannot be typed into directly (read-only).
- [ ] Confirm leaving the address blank still shows "Site address is required." before the postal-code check runs.
- [ ] Open the cart drawer after saving a valid address — confirm the delivery-site line shows the full address once, with no duplicated or re-appended postal code.
- [ ] Complete a mock-mode booking (`npm run dev:mock`) and confirm `sitePostalCode` is still recorded on the created rental plan/booking, sourced from the derived value.

## 5. Change Log

- 2026-08-12: Postal code auto-derivation and updated validation added to `SiteAddressModal.tsx` (`derivePostalCode()`, read-only Postal Code field, updated error/help copy). Commit `130cd65`.
- 2026-08-13: Specs-banner Select no longer opens Delivery Details. `CartDrawer` **Proceed to Deposit** is disabled until `siteAddress` is saved; the **Add** control is highlighted (same amber ring as the date bar) when the rental plan has items and no address yet.
- 2026-08-13: Removed the now-duplicate postal code from `CartDrawer.tsx`'s delivery-site summary line (previously `${siteAddress}, ${sitePostalCode}`, now `siteAddress` alone) and dropped the unused `sitePostalCode` prop. Commit `80d4077`.
- 2026-08-13: Created this document to capture both changes above; see `Spec-equipment-card-detail-changes.md` and `Spec-browse-equipment-date-validation.md` for the sibling docs this follows in structure.
- 2026-08-13: Delivery Details now looks up a Singapore 6-digit postal code from the typed address via OneMap (`lookupSingaporePostal` in `src/lib/sgPostal.ts`). A 6-digit code already in the address still wins; otherwise the first OneMap hit's `POSTAL` fills the read-only field. Save no longer requires the address to end with the postal code.
- 2026-08-13: Automated coverage — `src/lib/sgPostal.test.ts` and `src/features/checkout/SiteAddressModal.test.tsx` (typed postal, mocked OneMap lookup, save blocked on miss). Run with `npm test`.
