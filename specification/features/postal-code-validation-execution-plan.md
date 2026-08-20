# Execution Plan: Postal Code Validation (Frontend)

| Field | Value |
|-------|--------|
| **Implements** | [`postal-code-validation.md`](./spring%20contract/postal-code-validation.md) — the Spring team's handoff contract for `GET /api/postalCodes/{postalCode}` — and [`spring contract/rental-plan-site-address.md`](./spring%20contract/rental-plan-site-address.md) — Spring's accepted contract for making `siteAddress` optional at plan creation, per our [`ask-rental-plan-optional-site-address.md`](./ask-rental-plan-optional-site-address.md) |
| **Builds on** | [`../Spec-site-address-postal-code-validation.md`](../Spec-site-address-postal-code-validation.md) — the earlier, client-side-only auto-derivation work (now marked historical/superseded there) that gave `SiteAddressModal` its `extractPostalCode`/OneMap-lookup foundation; this plan adds the backend-authoritative check on top of it |
| **Status** | **Phase 1** (Sub-tasks 1-5) — done, committed, merged with `develop`. **Phase 2** (Sub-tasks 6-8) — all three done, code-complete. Spring has confirmed both `POST /rentalPlans` (optional `siteAddress`) and `PATCH /rentalPlans/{id}` are now live. Manual `npm run dev:api` verification (Phase 2 Verification, below) still outstanding. |
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
- `specification/features/spring contract/postal-code-validation.md` itself is **not** edited — it's the Spring team's
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

**Implementation note:** these are covered by manual verification (below), not automated tests —
`CustomerPortal.tsx` has no existing test scaffold of any kind (unlike the smaller checkout components, which
all have focused test files), and building one from scratch to cover this sub-task would be a materially
larger, separate effort than the code change itself. Decided with the user 2026-08-17: manual `npm run dev:api`
verification is sufficient for this sub-task; a dedicated `CustomerPortal.test.tsx` harness is a possible
future follow-up, not part of this plan.

**Additional correctness fix beyond the original plan, required by this change:** `removeFromCartApi`'s
"plan emptied → cancel it" branch used to `setCart([])` unconditionally. Once items can be local-only/unsynced
(this sub-task), that would wrongly wipe out any such items still sitting in `cart` alongside the
now-removed-and-cancelled synced ones. Fixed to `setCart((prev) => prev.filter((c) => !(c.equipment.id in
planItemIds)))` instead, keeping anything that was never part of the cancelled plan. `syncCartItems`/
`syncUnsyncedCartItems` were also written to take the items-to-sync and date range as explicit arguments
rather than reading `cart`/`siteAddress` from closure, to avoid a stale-closure bug: calling them synchronously
right after `setCart(...)` (or, for the address-save case, right after `setSiteAddress(...)`) in the same
function would otherwise still see the pre-update value until the next render. For the address-save case
specifically, this is why `syncUnsyncedCartItems()` is invoked from a `useEffect` keyed on `siteAddress`
(declared right after `addToCart`) rather than called directly inside `SiteAddressModal`'s `onSave` handler —
the effect body runs after the state update commits, so it sees the fresh `siteAddress`/`cart`/`planItemIds`.

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

## Phase 1 Verification (after sub-task 5, not its own commit)

- `npm test` — full suite green, including all new/updated cases above.
- `npm run dev:api` (real backend): select equipment → "Skip for now" → item visibly in cart → "Proceed to
  Deposit" → address modal reopens (forced) → enter an address with an invalid/nonexistent postal code →
  Save blocked with the backend's message → fix to a real address → Save enables once validation resolves →
  checkout proceeds with the previously-skipped item synced into the created `RentalPlan`.
- `npm run dev:mock`: confirm mock mode is unaffected — no calls to `/api/postalCodes/...`, "Skip for now"
  behavior unchanged (mock mode already treats `cart` as fully local).

---

# Phase 2: `siteAddress` becomes optional at plan creation

Spring has agreed to both changes we asked for in
[`ask-rental-plan-optional-site-address.md`](./ask-rental-plan-optional-site-address.md), documented in
[`spring contract/rental-plan-site-address.md`](./spring%20contract/rental-plan-site-address.md):

1. `POST /rentalPlans` — `siteAddress` becomes optional. Omitting it creates the plan with
   `siteAddress: null`; this is what "Skip for now" should now actually do server-side, instead of the
   Phase 1 workaround of staging items client-side until an address exists. Validation is unchanged
   whenever `siteAddress` *is* provided (still `@NotBlank` + must end in a 6-digit postal code), and nothing
   changes at `POST /rentalPlans/{id}/items`, `POST /rentalPlans/{id}/quote`, or `POST /api/bookings` (the
   last of which still independently requires and validates its own `siteAddress` at checkout, regardless of
   what the plan has).
2. **New** `PATCH /rentalPlans/{id}` — accepts `{siteAddress}` only (not a general update), lets an
   already-created plan get an address set/changed on its own record. **⚠️ Load-bearing detail from the
   contract:** PATCHing `siteAddress` on a `QUOTED` plan silently reverts it to `DRAFT` and clears
   `totalAmount` — same rule as adding/removing a line item on a quoted plan. Any code path that PATCHes the
   address must not assume a previously-displayed price is still valid afterward.

Both are **not yet implemented on the Spring side either** (contract doc's own Status field: "not yet
implemented" for both) — this phase's sub-tasks below should not start until Spring confirms the routes are
actually live, since building against an unimplemented contract risks the same kind of drift the Phase 1
postal-code-validation doc warned about.

## Sub-task 6 (commit 6): Spec/doc updates for the new contract — docs only, no code

Do this first, mirroring Phase 1's Sub-task 1 pattern — get the paper trail right before touching code.

- **`ask-rental-plan-optional-site-address.md`** — flip `Status` from "Proposed — not yet built on either
  side" to "Accepted — see `spring contract/rental-plan-site-address.md`", so the ask doc reads as resolved
  rather than looking like an open, unanswered request.
- **`specification/Spec-rest-api-reference.md`** (§2.4 Rental Plans table):
  - Update the `POST /api/rentalPlans` row's notes to reflect `siteAddress` now being optional (currently
    documents it as required).
  - Add a new row for `PATCH /api/rentalPlans/{id}` — careful to describe it accurately as **siteAddress-only**,
    not a general update, so it isn't confused with the still-missing generic `PATCH` full-update capability.
  - §2.4.1's field-level bullet for `POST /rentalPlans` ("Confirmed. Request body is `RentalPlanCreateRequest
    { startDate, endDate, siteAddress }`... `siteAddress` is `@NotBlank`...") needs updating — `siteAddress`
    is no longer `@NotBlank` at creation; note the still-applies-when-provided validation instead.
  - §5 (Backend implementation gaps) currently lists generic `PUT`/`PATCH`/`DELETE /api/rentalPlans/{id}` as
    a gap ("frontend calls it, backend doesn't have it"). Narrow this entry once `PATCH` for `siteAddress`
    specifically exists — it's no longer a full gap, just a partial one (`PATCH` exists but is
    siteAddress-only; `PUT`/`DELETE` remain missing).
- **`specification/features/api-contract-for-frontend.md`** — this doc's §2 (`RentalPlanResponse` shape) and
  its request-contract prose still describe `siteAddress` as always required at creation. Add a cross-reference
  to `spring contract/rental-plan-site-address.md` as the authoritative source for the updated behavior rather
  than duplicating it, consistent with how this doc already points to `postal-code-validation.md` for the
  postal-code-lookup endpoint.
- **`specification/features/Spec-rental-plan-cart-checkout.md`** and
  **`specification/Spec-cart-hydration-and-duplicate-add-fixes.md`** — skim both for any "siteAddress is
  required to create a plan" assumptions baked into their prose (both predate this change) and add a
  pointer to `spring contract/rental-plan-site-address.md` wherever that assumption shows up, rather than
  rewriting their historical narrative — same "flag forward, don't retroactively rewrite" convention already
  used for `Spec-site-address-postal-code-validation.md` in Phase 1.
- This document (already being updated as part of writing this plan).

## Sub-task 7 (commit 7): `api.ts` — optional `siteAddress` + new PATCH client

- `CreateRentalPlanRequest.siteAddress` — change from `string` to `siteAddress?: string`; update its
  inline comment (currently says `@NotBlank` unconditionally) to reflect that it's only validated when
  present.
- New client function, alongside `rentalPlanCartApi`'s existing methods:
  ```ts
  export interface UpdateRentalPlanSiteAddressRequest {
    siteAddress: string;
  }

  // ...inside rentalPlanCartApi:
  updateSiteAddress: (planId: number, siteAddress: string) =>
    request<RentalPlanResponse>(`/rentalPlans/${planId}`, {
      method: "PATCH",
      body: JSON.stringify({ siteAddress }),
    }),
  ```
  Name TBD at implementation time if something reads better (e.g. `setSiteAddress`) — `updateSiteAddress`
  avoids colliding with the component-level `setSiteAddress` state setter already in `CustomerPortal.tsx`.
- Unit tests in `api.test.ts`, same pattern as existing `rentalPlanCartApi` coverage: URL
  (`/api/rentalPlans/55`), method (`PATCH`), body (`{siteAddress: "..."}`), `Authorization` header: and a
  case asserting the response's `status`/`totalAmount` pass through as-is when the backend reverts a
  `QUOTED` plan to `DRAFT` (this API-client layer just needs to return what the backend sends — the
  revert-handling logic itself belongs in the caller, Sub-task 8).

## Sub-task 8 (commit 8): Let "Skip for now" actually persist, and PATCH the address once saved

All in `src/features/customer/CustomerPortal.tsx`.

1. **`ensureApiRentalPlanId`** — remove the `if (!siteAddress.trim()) { ...; return null; }` guard entirely.
   Always create the plan: `rentalPlanCartApi.create({ startDate, endDate, ...(resolvedSiteAddress ?
   { siteAddress: resolvedSiteAddress } : {}) })` — omit the field when blank instead of blocking, now that
   the backend accepts its absence.
2. **Phase 1's local-staging machinery becomes obsolete and should be removed**, not just relaxed: with plan
   creation no longer gated on an address, `syncCartItems`'s `!siteAddress.trim()` early-return, the
   `syncUnsyncedCartItems()` helper, and the `useEffect` keyed on `[siteAddress]` that calls it (added in
   Sub-task 4) no longer serve a purpose — there's no more "waiting for an address" phase for items to be
   unsynced *during*. `addToCart`/`handleSharedEndDateSelected` go back to always syncing immediately
   (mirroring how mock mode already behaves), the same way they did before Phase 1's fix was needed. Keep
   the "always update local cart immediately" pattern itself (still correct for responsive UI regardless of
   API latency) — only the address-gating around the sync call goes away. The one remaining unsynced-item
   case (an individual `addItem` call failing mid-flight, e.g. network error) is the same already-accepted
   edge case noted in Sub-task 4/5 — not specially handled.
3. **PATCH the address once it's saved or changed.** `SiteAddressModal`'s `onSave` handler (in
   `CustomerPortal.tsx`, not the modal itself) should call `rentalPlanCartApi.updateSiteAddress(planId,
   resolvedAddress)` whenever `planId !== null` (a plan already exists to attach it to) and the address is
   new or changed. If `planId === null` (nothing added to the cart yet), there's nothing to PATCH — the
   address will just be included the normal way the next time `ensureApiRentalPlanId` creates the plan.
   **Sequencing note, not just an implementation detail — get this order right:** this PATCH must complete
   *before* any subsequent `rentalPlanCartApi.quote()` call, since the contract's revert-to-`DRAFT`
   side effect on a `QUOTED` plan means quoting-then-patching would silently discard the fresh quote. The
   existing checkout flow already satisfies this by construction — `onSave` (where the PATCH would fire)
   always runs before `onBeginPayment`'s `await rentalPlanCartApi.quote(planId)` (which runs right before
   `createBookingFromPlan`, per Sub-task 5's checkout-gate flow) — so no new ordering code should be needed,
   just confirm this during manual verification (below) rather than assuming it silently.
   No new defensive/loading UI is needed for the revert-to-`DRAFT` itself: `onBeginPayment` already
   unconditionally re-quotes immediately before charging regardless of the plan's current status, which
   already covers "the price shown might be stale" the same way it already covers the existing
   item-add/remove revert case.

   **Correction (2026-08-20, HR-205):** the unconditional re-quote this point relies on was removed —
   it was itself the cause of a separate bug (a silently different price could get charged than the one
   displayed; see `Spec-dynamic-pricing-e2e.md` §4.5's 2026-08-20 entry). The revert-to-`DRAFT` case this
   point describes is still covered, but reactively now: `createBookingFromPlan` gets a `409
   quote_not_ready` against a plan that reverted to `DRAFT`, which is caught and turned into an explicit
   "Price Updated" confirmation step (`Spec-dynamic-pricing-e2e.md` §4.6) rather than a silent re-quote.
   The sequencing claim above (PATCH-before-quote is satisfied by construction, since `onSave` always
   precedes `DepositCheckout`) still holds — it just now applies to the *reactive* re-quote inside
   `onBeginPayment`'s catch branch instead of an unconditional one before every attempt.

**Tests:** same call as Phase 1's Sub-task 4/5 — `CustomerPortal.tsx` has no automated test harness, so this
is manual-verification territory (below), not new automated coverage. `api.test.ts` coverage for the new
`updateSiteAddress` client function (Sub-task 7) is the automated piece.

## Phase 2 Verification (after sub-task 8, not its own commit)

- `npm test` — full suite green.
- `npm run dev:api`:
  - Select equipment, click **"Skip for now"** on the address modal. Refresh the page immediately (before
    ever saving an address). **Expected, the actual point of Phase 2:** the item survives the reload — unlike
    Phase 1, where a Skip-for-now item was lost on reload since nothing was ever persisted.
  - With that same item still in the cart (address still unset), open the address modal and Save a valid
    address. Confirm it's reflected both in the cart drawer and (if inspectable, e.g. via a follow-up
    `GET /rentalPlans` call in devtools) on the plan's own record, not only appearing later via the booking.
  - Get a plan to `QUOTED` (proceed far enough into checkout to trigger a quote, without completing payment),
    back out, then edit the address to a different valid one and save. Confirm the total price shown
    afterward reflects a fresh quote (not the stale pre-edit one) once you proceed to checkout again —
    this is the manual check for the sequencing note in Sub-task 8.3.
- `npm run dev:mock`: unaffected — mock mode never touches `rentalPlanCartApi` at all.

## Bugs found during Phase 2 manual verification (fixed, not their own numbered sub-tasks)

Two real issues surfaced while manually verifying Phase 2 end-to-end (`npm run dev:api`, automated browser
repro to isolate each), both fixed directly rather than filed as separate future sub-tasks since they're
small, self-contained, and in the same files this phase already touches.

**1. `SiteAddressModal`'s Save/Confirm button wasn't disabled while OneMap was still resolving a postal
code.** `postalChecking` only accounted for the backend-validation phase (`isSingaporePostal(postalCode) &&
!postalResolved`) — if the address required an OneMap round-trip (no digits typed inline) and the user
clicked Save/Confirm before that lookup settled, `postalCode` was still `""`, and `handleSave` rejected it
with "Couldn't find a Singapore postal code for this address" — a confusing false negative for an address
that was often about to resolve successfully a moment later. Fixed by also disabling while `lookupStatus ===
"loading"`. Covered by a new regression test in `SiteAddressModal.test.tsx`.

**2. `POST /rentalPlans/{id}/quote` could be called twice concurrently for the same plan, and one call would
409.** Confirmed by the Spring team (not a server bug — their optimistic-lock `@Version` check working as
designed; root cause is client-side duplication): `quote()` is split server-side into a short read, an
un-transacted pricing call that can take up to ~20s, then a short write that reloads the plan and saves
against its current `@Version` — two concurrent calls both attempting that final save race, and whichever
loses gets `409 {"error":"conflict",...}`. This repo has two independent call sites that can legitimately
overlap given that ~20s window: `DepositCheckout`'s own mount-time display-only quote (`onGetQuote`, for the
"Smart Priced" badge) and `onBeginPayment`'s pre-charge re-quote (fired on "Continue to Payment"). If the
`onBeginPayment` call was the one that lost the race, `handleContinue` would surface the 409 as a checkout
failure — not just a cosmetic issue. Fixed with a shared in-flight-dedup wrapper,
`quoteRentalPlan()` (`CustomerPortal.tsx`, backed by a `useRef<Promise<RentalPlanResponse> | null>`) — every
caller goes through it instead of calling `rentalPlanCartApi.quote()` directly; a call already in flight is
awaited and shared instead of duplicated, and a fresh one only starts once the previous has settled. Verified
live: before the fix, every checkout attempt showed one `200` and one `409` on `/quote` (order
nondeterministic, matching the race); after, exactly one call.

**Update (2026-08-20, HR-205):** `onBeginPayment`'s trigger for calling `quoteRentalPlan()` changed — it no
longer fires on every "Continue to Payment" click, only reactively on a `409 quote_not_ready`/`quote_expired`
rejection from `createBookingFromPlan` (`Spec-dynamic-pricing-e2e.md` §4.5). This makes the race window
described above much narrower in practice (the two call sites overlap far less often now), but the
`quoteRentalPlan()` dedup wrapper documented here remains in place and is still the correct mechanism should
they ever overlap — nothing about this fix removed the need for it.
