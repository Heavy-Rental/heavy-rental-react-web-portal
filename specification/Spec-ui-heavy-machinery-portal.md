# Specification: HeavyWeight Rental UI (Singapore)

## 1. Document Purpose

This specification defines the UI behaviors and business rules for the HeavyWeight Rental portal in the Singapore market. It is intended to guide implementation of the React frontend so that customer onboarding, booking flow, quotes, and admin views reflect the required business model.

## 2. Business Rules

The following rules are mandatory for this UI implementation:

1. Equipment catalog must contain only 4 equipment types:
   - Boom Lift
   - Scissors Lift
   - Fork Lift
   - Excavator

2. One booking represents exactly one delivery and one return.
   - Singapore-only operation
   - Same-day pickup / delivery / return

3. All equipment in one booking must share the same start date and end date.

4. Deposit calculation is fixed at 30% of the total rental value.

5. Full payment is required 2 days before delivery.

6. Each user may have only one rental plan.

## 3. UI Scope

### In scope

- Customer onboarding experience
- Equipment selection and rental plan creation
- Booking summary and payment guidance
- Admin dashboard views for booking and plan oversight
- Supporting informational pages such as safety and company information
- Depot selection and service-area messaging for Singapore locations

### Out of scope

- Real payment gateway integration
- Backend persistence
- Live inventory synchronization
- Multi-country operations

## 4. Functional Requirements

### 4.1 Equipment catalog

- The UI must display only the 4 approved equipment types listed above.
- Equipment cards and filters should not expose other categories such as crane, bulldozer, or dump truck.
- The catalog should be consistent across the portal, onboarding flow, and admin dashboard.

### 4.2 Booking model

- A booking must be treated as a single rental transaction with:
  - one delivery event
  - one return event
  - one shared rental window
- The UI should clearly state that the booking is Singapore-only and follows same-day pickup / delivery / return handling.

### 4.3 Shared dates

- If multiple items are selected in one booking, they must share the same start and end date.
- The UI should prevent or clearly warn against mismatched dates across items.
- When the customer reaches the catalog via Instant Quote **Add All to Rental Plan**, the shared date bar SHOULD be prefilled from the quote's `tentativeStartDate` / `tentativeEndDate` (or `days` when a bound is missing). The user can still clear or change dates before adding items. Know / Browse MUST leave the bar empty.

### 4.4 Pricing and deposits

- The deposit shown to the user must always be 30% of the rental total.
- The balance due should be clearly separated from the deposit amount.
- The summary should make the payment timing explicit:
  - deposit due at booking creation
  - full payment required 2 days before delivery

### 4.5 Rental plans

- The UI must support one active rental plan per user.
- If a user already has a plan, the interface should indicate that a new plan cannot be created until the existing plan is completed or replaced.

### 4.6 Depots

- The approved Singapore depot locations for this UI are:
  - Jurong Port
  - Pioneer
  - Tuas
  - Marina South
- Depot information should be presented clearly in the customer-facing booking and admin views where location context is relevant.

## 5. UI Behavior Expectations

### Customer onboarding

- Present the Singapore-specific rental flow clearly.
- Explain the 4 equipment types and the single-booking model.
- Show the deposit and payment timeline in a simple, understandable way.

### Booking / quote summary

- Display a booking summary showing:
  - selected equipment
  - shared rental dates
  - delivery and return expectation
  - deposit amount (30%)
  - final payment deadline (2 days before delivery)

### Admin dashboard

- Show bookings in a way that aligns with the one-delivery / one-return rule.
- Present plan status such that each user has at most one active rental plan.
- Display Singapore-specific operational notes where relevant, including depot context for Jurong Port, Pioneer, Tuas, and Marina South.

## 6. Pages / Views

The app is a single-page shell (`src/App.tsx`) driven by a `View` state union — no router library. Pages by audience:

### Folder structure

- `src/app/` — shared data layer: API types, the fetch client, auth/session, generic hooks (`useApiResource`)
- `src/lib/` — shared style constants (`mono`/`display`/`sans`) and ISO date-formatting helpers
- `src/components/` — shared presentational components used by more than one feature (e.g. `DateRangeBar`)
- `src/features/browse/` — equipment discovery: `CustomerOnboarding`, `EquipmentGrid`, `Chatbot`
- `src/features/cart/` — `CartContext`, the cart state shared between browse and checkout
- `src/features/checkout/` — payment: `CartDrawer`, `DepositCheckout`, `ConfirmationScreen`, `RentalPlanDetail`
- `src/features/admin/` — admin dashboard, split one folder per tab (`overview/`, `assets/`, `fleet/`, `bookings/`, `users/`, `pricing/`) around a shared `AdminDataContext`
- `App.tsx` — thin composition shell: the `view` state switch, login, and top-level page wiring

**Public / unauthenticated**
- **Landing / Catalog** (`App.tsx`, `view: "portal"`) — hero and live equipment catalog; default view for anyone without a session.
- **Sign-in modal** (`LoginModal`, `App.tsx`) — email/password login that routes to the correct role-based view on success.
- **Safety** (`src/app/SafetyPage.tsx`) — safety policies and certifications.
- **About** (`src/app/AboutPage.tsx`) — company information.
- **Projects** (`src/app/ProjectsPage.tsx`) — showcase of completed projects.

**Customer**
- **Customer onboarding** (`src/features/browse/CustomerOnboarding.tsx`) — first-run flow shown right after customer login; lets the user choose to browse directly, get an AI recommendation from uploaded specs, or state they already know what they need.
- **Customer portal / equipment catalog** (`CustomerPortal` in `App.tsx`, rendering `src/features/browse/EquipmentGrid.tsx`, `view: "customer"`) — browse/filter equipment, pick the shared rental date range, add items to cart.
- **Equipment detail** (modal within `CustomerPortal`) — single-item spec view with add-to-cart.
- **Cart / rental plan** (`src/features/checkout/CartDrawer.tsx`) — review selected items, shared dates, and site address before checkout.
- **Checkout / deposit flow** (`src/features/checkout/DepositCheckout.tsx`) — multi-step simulated payment (summary → payment → processing) computing the 30% deposit and full-payment deadline.
- **Booking confirmation** (`src/features/checkout/ConfirmationScreen.tsx`) — shown automatically after successful payment; displays the reservation ID and order summary.
- **Customer profile** (modal within `CustomerPortal`) — view/edit account profile.
- **Rental plan detail / invoice** (`src/features/checkout/RentalPlanDetail.tsx`) — itemized invoice view reached from the customer profile.

**Admin / employee**
- **Admin dashboard** (`src/features/admin/AdminDashboard.tsx`, `view: "admin"`) — fleet and reservation oversight for admin users, composed from per-tab components in `src/features/admin/{overview,assets,fleet,bookings,users,pricing}/`.
- **Employee dashboard** (`EmployeeDashboard`, `App.tsx`, `view: "dashboard"`) — operations view for employee-role users.

## 7. Implementation Checklist

- [x] Replace non-approved equipment categories with the 4 Singapore-approved types
- [x] Update customer onboarding copy to reflect Singapore-only same-day rental flow
- [x] Ensure booking UI uses one shared start/end date across all selected equipment
- [x] Implement deposit calculation as 30% of total rental value
- [x] Display full-payment deadline of 2 days before delivery
- [x] Enforce or clearly model one rental plan per user (implemented: checkout and onboarding block new plan creation when an active plan exists)
- [x] Update admin dashboard labels and summaries to match the business rules
- [x] Review supporting pages for Singapore-specific wording and consistency
- [x] Add depot references for Jurong Port, Pioneer, Tuas, and Marina South where relevant

## 8. Change Log

- 2026-08-03: Initial specification drafted from the Singapore business rules provided by the user.
- 2026-08-03: Added Singapore depot locations: Jurong Port, Pioneer, Tuas, and Marina South.
- 2026-08-03: Restricted visible equipment catalog to the four approved Singapore types across `src/App.tsx`, `src/app/CustomerOnboarding.tsx`, and `src/app/AdminDashboard.tsx`.
- 2026-08-03: Updated the booking UI copy to reflect the Singapore single-booking model, shared delivery/return dates, and payment timing.
- 2026-08-03: Updated category filters in `src/App.tsx` to show Boom Lift, Scissors Lift, Fork Lift, and Excavator.
- 2026-08-03: Replaced canonical equipment catalog in `src/app/shared.ts` to include only Boom Lift, Scissors Lift, Fork Lift, and Excavator; localized depot locations to Jurong Port, Pioneer, Tuas, and Marina South.
- 2026-08-03: Updated project sample data and `CATEGORIES` in `src/app/ProjectsPage.tsx` to reference approved equipment and adjusted project summaries/challenges.
- 2026-08-03: Normalized admin lifecycle and booking samples in `src/app/AdminDashboard.tsx` to use approved equipment names and generalized transport notes.
- 2026-08-03: Updated onboarding recommendation signals and modal copy in `src/app/CustomerOnboarding.tsx` to avoid crane/bulldozer references and use approved fleet.
- 2026-08-03: Generalized safety/certification wording in `src/app/SafetyPage.tsx` to reference elevated work platforms and excavator operation.
- 2026-08-03: Updated hero copy, footer links, cart/sample items, and global category lists in `src/App.tsx` to reflect Singapore-only fleet and same-day delivery messaging.
- 2026-08-03: Implemented centralized deposit calculation (`calcDeposit`) and updated checkout flows in `src/App.tsx` to compute deposit as 30% of total rental value.
- 2026-08-03: Implemented centralized deposit calculation (`calcDeposit`) and updated checkout flows in `src/App.tsx` to compute deposit as 30% of total rental value.
- 2026-08-03: Implemented full-payment enforcement UI: `src/App.tsx` computes delivery date from cart and sets `requireFullPayment` when delivery is within 2 days; `DepositCheckout` now accepts `requireFullPayment` and will charge the full `totalCost` when required. Parent `onPaid` now receives `(reservationId, amountPaid)` so the recorded `depositPaid` reflects actual payment amount.
- 2026-08-03: Partially enforced one-plan-per-user in the UI: proceed-to-deposit is blocked when an active rental plan exists (see `src/App.tsx`). Further UX gating in onboarding is pending.
- 2026-08-03: Enforced one-plan-per-user in the onboarding UI: `src/app/CustomerOnboarding.tsx` now prevents "Add All to Rental Plan" when a user has an active rental plan and surfaces a clear message to the user. Also added `hasActivePlan` prop wiring in `src/App.tsx`.
- 2026-08-03: Performed a repository sweep for legacy equipment labels. Found remaining narrative references to crane, bulldozing, and dump truck in a small set of files (see notes). These are informational only and do not affect the visible catalog; planned follow-up is to sanitize these narrative strings across docs and non-catalog UI.
- 2026-08-03: Sanitized narrative/UI strings to remove or neutralize non-approved equipment mentions (crane, bulldozer, dump truck) in `src/App.tsx`, `src/app/CustomerOnboarding.tsx`, `src/app/SafetyPage.tsx`, and `src/app/AboutPage.tsx`. Build verified after changes.
- 2026-08-03: Updated admin sample bookings in `src/app/AdminDashboard.tsx` to compute deposit values via `calcDeposit(total)` and replaced legacy equipment mentions with approved fleet names where present. Build verified after changes.
- 2026-08-03: Rebuilt project to validate changes; production build completed successfully (`vite build`).
- 2026-08-05: Added Section 6, "Pages / Views," documenting each public, customer, and admin/employee page, its purpose, and how it's reached.
- 2026-08-06: Added "Folder structure" to Section 6
- 2026-08-13: Instant Quote Add All to Rental Plan prefills the catalog DateRangeBar from quote `tentativeStartDate` / `tentativeEndDate` / `days` via the existing shared-date setters. DateRangeBar is unchanged.
- 2026-08-13: Add All also writes recommended machines into the Rental Plan with those dates. Specs-mode Select does not open Delivery Details; the customer toggles banner cards and saves an address from the highlighted Add control. Covered by `npm test` (`specsPlan`, `CartDrawer`, `dateFormat`).
