# Ask: Allow `RentalPlan` Creation Without a Site Address Yet

| Field | Value |
|-------|--------|
| **Direction** | Frontend → Spring backend team (this is a request, not a description of built behavior) |
| **Status** | Proposed — not yet built on either side |
| **Related** | [`postal-code-validation.md`](./spring%20contract/postal-code-validation.md) (backend handoff for `GET /api/postalCodes/{postalCode}`), [`postal-code-validation-execution-plan.md`](./postal-code-validation-execution-plan.md) (frontend work this ask grew out of), [`api-contract-for-frontend.md`](./api-contract-for-frontend.md) (current `RentalPlanCreateRequest` contract) |

## Problem

Today, `RentalPlanCreateRequest.siteAddress` on `POST /rentalPlans` is `@NotBlank` and must end in a
6-digit postal code — a blank/missing value 400s as `validation_failed`. Since a `RentalPlan` can't exist
server-side without one, and items can only be added to a plan that already exists
(`POST /rentalPlans/{id}/items`), **a customer can't have anything persisted to the backend at all until
they've provided a delivery address.**

On the frontend, we deliberately support letting a customer add equipment to their cart before providing an
address (a "Skip for now" option on the address prompt — added because forcing the address up front, before
the customer has even decided what they're renting, was poor UX). Given the current constraint, those items
can only be staged in browser state (React) — nothing is written to the database until an address is
eventually saved. If the customer's session ends first (closed tab, lost connection, different device) before
that happens, the cart is silently gone. A cart that already has an address survives a reload fine (hydrated
from the persisted plan); one added via "Skip for now" does not, purely because of when the address happens
to get attached.

## Ask

**Relax `RentalPlanCreateRequest.siteAddress` from required to optional at creation time** — let
`POST /rentalPlans` succeed with `{startDate, endDate}` alone, `siteAddress` omitted or `null`.

This is consistent with how the rest of the system already treats a missing/unresolved address: per
`postal-code-validation.md`, the quote flow (`POST /rentalPlans/{id}/quote`) already tolerates an unresolved
postal code by falling back to a default distance for pricing, rather than hard-failing. We're asking for the
same tolerance one step earlier, at creation.

### What does *not* change

- **Validation strictness is unchanged wherever `siteAddress` is provided** — still `@NotBlank` (when present)
  and still must end in a 6-digit postal code. This is only about *when* it's required, not how strictly it's
  checked.
- **`POST /rentalPlans/{id}/items`** — no change needed. Adding items already doesn't touch `siteAddress` at
  all; it's blocked today only as a side effect of the plan itself not existing yet.
- **`POST /rentalPlans/{id}/quote`** — no change needed, per the tolerance already described above.
- **`POST /api/bookings` (checkout/conversion)** — no change, and this is the important part: this route
  already requires and validates its own `siteAddress` independently of `rentalPlanId`
  (`api-contract-for-frontend.md` §5: "`siteAddress` stays required (`@NotBlank` + 6-digit-postal-code
  pattern), independent of `rentalPlanId`"). A customer still cannot check out without a valid address —
  this ask only removes the *early* gate at cart-creation time, not the one that actually matters at the
  point money changes hands.

### Secondary/optional: a way to attach the address to the plan later

Once creation no longer requires `siteAddress`, it'd be useful (though not strictly required for the core
frontend fix above) to have a way to set it on an already-created plan once the customer does provide one —
e.g. `PATCH /rentalPlans/{id}` accepting `{siteAddress}` — so the plan's own record reflects the address
before conversion, rather than the address only ever appearing via the booking. Worth noting this overlaps
with an existing tracked gap: generic `PUT`/`PATCH`/`DELETE /api/rentalPlans/{id}` are already listed as
"frontend calls it, backend doesn't have it" in `Spec-rest-api-reference.md` §5 — this could piggyback on
that work rather than needing a fully separate route, if/when it's picked up.

If this secondary piece isn't picked up, the frontend workaround (keep `siteAddress` as client-side state
until checkout, and only send it once on `POST /api/bookings`) still works — it just means the `RentalPlan`
record itself stays addressless until conversion, which is a display-only limitation (e.g. an admin view
listing in-progress plans wouldn't show a delivery address for one that hasn't provided it yet), not a
functional one.

## What changes on the frontend once this lands

`ensureApiRentalPlanId()` (`src/features/customer/CustomerPortal.tsx`) currently blocks plan creation
entirely on a blank `siteAddress`, precisely because of this constraint. Once relaxed, that function's
early-return guard goes away, and a `RentalPlan` (with items) gets created as soon as the customer adds their
first item — regardless of whether an address exists yet — closing the "lost on reload" gap described above.
Existing checkout-time enforcement (`SiteAddressModal`'s Save button hard-gated on postal-code validation,
the forced re-confirm-at-checkout flow) is unaffected either way.
