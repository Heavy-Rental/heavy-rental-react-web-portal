# Execution Plan: Postal Code Validation (Frontend)

| Field | Value |
|-------|--------|
| **Implements** | [`postal-code-validation.md`](./postal-code-validation.md) — the Spring team's handoff contract for `GET /api/postalCodes/{postalCode}` |
| **Status** | In progress — Sub-tasks 1-3 done (persisted plan, `postalCodeApi` client, `SiteAddressModal` validation wiring); Sub-tasks 4-5 (cart/checkout UX fix) remaining |
| **Branch** | `HR-158-postal-code-validation-via-one-map-api-and-distance-calculation` |

This document is the frontend-side execution plan for consuming the new endpoint, plus a related UX bug fix
in the same area of the codebase. It exists so the work can be picked up/reviewed without relying on chat
history — each numbered sub-task below is intended to be exactly one git commit, so there's a manual
human-review checkpoint between each.

## Why this work, and what's bundled with it

Today the frontend only has two weaker postal-code signals: a plain `/^\d{6}$/` format check
(`isSingaporePostal` in `src/lib/sgPostal.ts`), and an unauthenticated client-side call to the public OneMap
search API (`lookupSingaporePostal`, same file) that auto-fills a plausible code from a typed address but
never confirms the final value is real. `postal-code-validation.md` adds a real, authoritative,
backend-side check — this plan wires it into the one place the frontend collects a site address:
`src/features/checkout/SiteAddressModal.tsx`.

While scoping that, we also found (and are fixing here, since it's the same component/state) a live bug: in
API mode, clicking "Skip for now" on the address modal silently drops whatever equipment the customer was
adding — nothing shows up in the cart, no error. Root cause: `addToCart`/`handleSharedEndDateSelected` in
`src/features/customer/CustomerPortal.tsx` only update local `cart` state after a server-side `RentalPlan`
exists, and creating that plan requires `siteAddress` (backend `@NotBlank`). Skipping the modal never sets
`siteAddress`, so the item sits in a single-slot `pendingCartItem`/`pendingAutoAdd` ref that only retries on a
`siteAddress` blank→non-blank transition — a transition Skip never produces.

**Agreed behavior** (see sub-tasks 4-5 for the mechanics):
- "Skip for now" stays available. An item added while skipping shows up in the cart immediately (locally) —
  address to follow later.
- If the customer *doesn't* skip and engages with the address modal instead, a valid postal code (per the new
  endpoint) is required before that item is actually synced into the backend `RentalPlan` — Save is hard-gated
  on validation passing.
- At checkout, the address modal always reopens — even when a valid address is already saved — so the
  customer explicitly confirms or edits it, and either way a fresh validation pass runs before checkout is
  allowed to proceed. A previously-valid address is never trusted as still-good without being re-confirmed
  through the same Save/validate path.

## Explicitly out of scope

- **`PUT /api/bookings/{id}` (booking update)** — named as a call site in `postal-code-validation.md`, but
  there is no edit-booking-address UI anywhere in the frontend today (admin's `BookingsTab` only does status
  updates, via a different endpoint entirely). Wiring validation into it would mean building that whole
  feature from scratch, not adding validation to an existing form. Separate future request once that form
  exists.
- **Distance calculation** — also named in this feature's branch, but needs no frontend work. Per
  `postal-code-validation.md`: "the backend's own quote flow already tolerates an unresolved postal code
  (falls back to a default distance for pricing)" — this is entirely internal to the backend's
  `POST /rentalPlans/{id}/quote` pricing logic, with no frontend-facing surface.

## Sub-task 1 (commit 1): This document + affected spec updates — docs only

- This file.
- Add a row for `GET /api/postalCodes/{postalCode}` to `specification/Spec-rest-api-reference.md` (§2, it has
  no row for this route today), initially `⏳ Backend live, frontend not wired`.
- `specification/features/postal-code-validation.md` itself is **not** edited — it's the Spring team's
  handoff artifact; this document and the `Spec-rest-api-reference.md` row above are where frontend
  consumption status is tracked instead.
- No `src/` changes in this commit.

## Sub-task 2 (commit 2): `postalCodeApi` client

Add to `src/app/api.ts`, alongside the other real-backend-only exports (near `rentalPlanCartApi`):

```ts
export interface PostalCodeLookupResponse {
  status: "VALID" | "INVALID";
  postalCode: string;
  address?: string;
  message?: string;
}

export const postalCodeApi = {
  lookup: (postalCode: string, signal?: AbortSignal) =>
    request<PostalCodeLookupResponse>(`/postalCodes/${postalCode}`, { signal }),
};
```

`request()` already attaches `Authorization: Bearer` and parses the `{error, message}` envelope into a typed
`ApiError` — the endpoint's `400 bad_request` case falls out of that for free. The `503 UNAVAILABLE` body
doesn't match that envelope shape (no `error` field), so it lands as a generic thrown `Error` — intentional,
since sub-task 3 treats any thrown error other than a confirmed `ApiError("bad_request", ...)` as the
soft-fail "unavailable" case, per the doc's guidance not to hard-block on it.

Add a unit test in `src/app/api.test.ts` (same `jsonResponse()` helper pattern already used there): assert
URL (`/api/postalCodes/619094`), method, and `Authorization` header on a `VALID` response. Self-contained, no
UI changes — a clean, low-risk checkpoint.

## Sub-task 3 (commit 3): Wire real-time validation into `SiteAddressModal`

The postal-code `<input>` in `SiteAddressModal.tsx` is read-only/derived (from `extractPostalCode` or the
OneMap lookup) — there's no literal "blur" target for a user-typed field. Trigger validation off the
*derived* `postalCode` value instead (the same value already shown in the read-only field), once it's a
well-formed 6-digit string (reuse `isSingaporePostal`, currently unimported in this file).

- Gate behind `const isApiMode = import.meta.env.MODE === "api";` computed inline — same convention already
  used in `CustomerPortal.tsx`/`DepositCheckout.tsx`. Mock mode has no such endpoint.
- New state:
  ```ts
  const [validation, setValidation] = useState<{
    postalCode: string;
    status: "checking" | "valid" | "invalid" | "unavailable";
    message?: string;
  } | null>(null);
  ```
- New `useEffect`, modeled on the existing OneMap-lookup effect (debounce + `AbortController` + cleanup):
  fires when `isApiMode && isSingaporePostal(postalCode)` and `validation` doesn't already cover this exact
  `postalCode`. Calls `postalCodeApi.lookup(postalCode, signal)`:
  - `"VALID"` → `status: "valid"`.
  - `"INVALID"` → `status: "invalid"`, carry `message`.
  - Thrown `ApiError` with `code === "bad_request"` → treat as `"invalid"` (defensive — shouldn't normally
    trigger since we only call with a confirmed 6-digit value).
  - Any other thrown error (network failure, the `503` body, any other `ApiError` code) → `"unavailable"` —
    never block on this.
  - Ignore `AbortError`.
- `handleSave`:
  - Keep the existing blank-address check.
  - If `postalCode` is non-blank but fails `isSingaporePostal` → block Save, same tier as "invalid".
  - `validation` for the current `postalCode` is `"invalid"` → block Save, show `validation.message`
    (fallback: "This postal code doesn't look right — check the address.").
  - `validation` for the current `postalCode` is `"checking"` → **disable the Save button**, show "Verifying
    postal code…".
  - `"valid"` or `"unavailable"` → Save proceeds as today.
- UI: reuse the existing `error` slot for the invalid-postal message; add a small inline status note near the
  postal-code field for "Verifying…" (mirrors the existing loading/found/miss caption already there for
  OneMap).

**Tests** (`SiteAddressModal.test.tsx`) — two call sites now share the global `fetch` mock:
`sgPostal.ts`'s raw call to OneMap, and `api.ts`'s `request()` to `/api/postalCodes/...`. New tests need a
mock that branches on request URL rather than one blanket `mockResolvedValue`. Cover: `VALID` clears error and
allows Save; `INVALID` blocks Save and shows the backend's `message`; a thrown/`503` response does not block
Save; mock mode (`vi.stubEnv("MODE", "mock")`) never calls the new endpoint.

Flip the `Spec-rest-api-reference.md` row added in sub-task 1 from `⏳` to `✅ Backend live, frontend wired`
in this same commit.

## Sub-task 4 (commit 4): Cart becomes optimistic/local-first in API mode

All in `src/features/customer/CustomerPortal.tsx`. Fixes the "item disappears after Skip" symptom on its own
(item now visibly appears in the cart), independent of sub-task 5's checkout gate.

`cart` becomes the same kind of optimistic local state it already is in mock mode — updated immediately on
add/remove regardless of whether a server-side `RentalPlan` exists yet. `planItemIds: Record<number, number>`
(equipment id → `RentalPlanItem` id) already distinguishes "synced to the backend" (present) from "local-only"
(absent) — no new state needed.

1. `addToCart` — remove the `if (!siteAddress.trim()) { ...; setPendingCartItem(item); return; }` branch.
   Always merge the item into local `cart` immediately (same list-merge logic mock mode uses). If
   `siteAddress` is already set, keep firing the existing sync call right away as today; if not, the item
   just stays local/unsynced.
2. `handleSharedEndDateSelected` (the "Add All" bulk path) — same change: drop the address early-return,
   always merge into local `cart` once both dates are picked; only fire the sync call when `siteAddress` is
   already set.
3. New `syncUnsyncedCartItems()` helper, replacing the narrow `pendingCartItem`/`pendingAutoAdd`
   retry-`useEffect`:
   ```ts
   const syncUnsyncedCartItems = async () => {
     const unsynced = cart.filter((c) => !(c.equipment.id in planItemIds));
     if (unsynced.length === 0) return;
     try {
       const { startDate, endDate } = cartDateRange(cart);
       const id = await ensureApiRentalPlanId(startDate, endDate);
       if (id === null) return;
       let plan = null;
       for (const c of unsynced) plan = await rentalPlanCartApi.addItem(id, c.equipment.id);
       if (plan) {
         const { cart: synced, itemIds } = cartFromRentalPlan(plan, equipment);
         setCart(synced);
         setPlanItemIds(itemIds);
         setPlanId(plan.status === "CONVERTED" || plan.status === "CANCELLED" ? null : plan.id);
       }
     } catch (err) {
       setCartDateError(err instanceof Error ? err.message : "Couldn't sync your rental plan.");
     }
   };
   ```
   Call this from `SiteAddressModal`'s `onSave` handler (after `setSiteAddress`/`setSitePostalCode`/
   `setDeliveryNotes`), so items added while address was missing get flushed the moment a valid address is
   saved — replaces today's `[siteAddress]`-keyed effect, now correctly handling multiple queued items.
4. Remove `pendingCartItem`/`pendingAutoAdd`'s address-blocking role. `pendingAutoAdd` keeps its original,
   unrelated job (waiting for both shared dates before auto-adding); `pendingCartItem` and the
   `siteAddress`-keyed retry effect are deleted, superseded by step 3.
5. `removeFromCartApi` — currently a silent no-op when `itemId === undefined` (unreachable today, but *will*
   happen once steps 1/2 stage local-only items). Add a fallback: if the item isn't in `planItemIds` yet,
   remove it from local `cart` directly — no DELETE call needed, nothing to remove server-side yet.

Tests: adding an item with no address set shows it in the cart immediately (API mode); removing an unsynced
item works without any API call; saving an address afterward flushes multiple queued items in one go.

## Sub-task 5 (commit 5): Force the address modal at checkout — always, even to re-confirm

Checkout must always route through a fresh Save/validate pass — even if `siteAddress` is already set to
something previously valid. `SiteAddressModal` is mounted conditionally
(`{siteAddressModalOpen && <SiteAddressModal .../>}`), so it fully unmounts on close and remounts fresh on
reopen — its internal `validation`/`lookup` state naturally resets each time, which already gives "reopening
re-validates from scratch" for free. What's missing is a way for checkout to *resume* automatically once that
re-confirmation succeeds, instead of gating on `siteAddress` being merely non-blank.

- `CartDrawer.tsx`: drop `disabled={!canCheckout}` / the "Add a delivery address..." title on "Proceed to
  Deposit" (the `canCheckout` computation and its prop wiring go with it) — the button is always clickable.
- `CustomerPortal.tsx`: add `const [checkoutPending, setCheckoutPending] = useState(false);`.
  - `onCheckout` (passed to `CartDrawer`) always opens the modal:
    ```ts
    onCheckout={() => {
      setCheckoutPending(true);
      setSiteAddressModalOpen(true);
    }}
    ```
  - `SiteAddressModal`'s `onSave` handler, after the existing state updates and `syncUnsyncedCartItems()`:
    ```ts
    if (checkoutPending) {
      setCheckoutPending(false);
      setCartOpen(false);
      setCheckoutOpen(true);
      setPaymentIntentId(generateFakePaymentIntentId());
    }
    ```
    Save is already hard-gated on validation passing (sub-task 3), so reaching this point means the address
    just got a fresh, confirmed-valid pass — checkout proceeds straight from here.
  - `SiteAddressModal`'s `onClose` handler (covers both "×" and "Skip for now" today) also resets
    `setCheckoutPending(false)` — closing/skipping mid-checkout just abandons that attempt; "Proceed to
    Deposit" remains clickable to retry.
  - `highlightAddAddress={cart.length > 0 && !siteAddress}` stays as a complementary passive nudge
    pre-checkout.
- Known accepted edge case, not additionally guarded: `syncUnsyncedCartItems()` runs asynchronously inside
  `onSave`; `DepositCheckout`'s existing `onBeginPayment` guard (`if (planId === null) throw new Error(...)`)
  already covers a race here with a "please refresh and try again" message — no extra loading/disabled state
  added for this narrow window.

Update `CartDrawer.test.tsx` for the removed disabled-state assertion. Add/adjust tests confirming: (a)
checkout always opens the address modal, even with a valid address already saved; (b) clicking through Save
on an unchanged, still-valid address proceeds straight to `DepositCheckout`; (c) skip/close mid-checkout
returns to the cart without opening `DepositCheckout`, and "Proceed to Deposit" remains clickable to retry.

## Verification (after sub-task 5, not its own commit)

- `npm test` — full suite green, including all new/updated cases above.
- `npm run dev:api` (real backend): select equipment → "Skip for now" → item visibly in cart → "Proceed to
  Deposit" → address modal reopens (forced) → enter an address with an invalid/nonexistent postal code →
  Save blocked with the backend's message → fix to a real address → Save enables once validation resolves →
  checkout proceeds with the previously-skipped item synced into the created `RentalPlan`.
- `npm run dev:mock`: confirm mock mode is unaffected — no calls to `/api/postalCodes/...`, "Skip for now"
  behavior unchanged (mock mode already treats `cart` as fully local).
