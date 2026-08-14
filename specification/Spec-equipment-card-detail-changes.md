# Specification: Equipment Card & Detail Page — Media, Tags, and Availability Display

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-08
**Status**: Draft / Live Verification
**Purpose**: Capture the changes made to the equipment catalog card (`EquipmentGrid.tsx`) and the equipment detail page (`App.tsx`) around uploaded-photo display, the "Ideal For" / "Features & Tags" sections, and the availability badge.

## 1. Overview

This document records a set of related changes to how an equipment item's image, tags, and availability status are displayed on the browse catalog card and the equipment detail page.

## 2. Scope

### In scope

- `src/features/browse/EquipmentGrid.tsx` — the equipment catalog card
- `src/App.tsx` — the equipment detail page (hero image, thumbnail strip, "Ideal For", "Features & Tags", availability badge/spec row)

### Out of scope

- The mock/live API contract for `Equipment` (`Spec-mock-api-server.md`)
- Date selection and checkout behavior (`Spec-browse-equipment-date-validation.md`)
- REST API integration itself — `login()`, `equipmentApi.list()`'s date query params, mode-aware `handleLogin`, and other `src/app/api.ts`/backend-wiring changes are tracked in `Spec-frontend-api-integration.md`, not here. This doc only covers how the card/detail UI displays what it's given.

## 3. Changes

### 3.1 Uploaded-photo support (`data:` URI images)

`item.img` / `detailItem.img` can now be either an Unsplash photo id (existing behavior — built into a `https://images.unsplash.com/...` URL) **or** a `data:` URI (an admin-uploaded photo). Every image render site now checks `img.startsWith("data:")` and, if true, uses it directly as the `src` instead of building an Unsplash URL:

- `EquipmentGrid.tsx` — catalog card image
- `App.tsx` — detail page hero image
- `App.tsx` — detail page thumbnail strip (see 3.2)

### 3.2 Thumbnail strip — simulated crops for uploaded photos

The detail page's 3-thumbnail strip previously relied on Unsplash's crop query params (`crop=entropy`, `crop=center`, `crop=faces,edges`) to show 3 different crops of the same source photo. That trick doesn't work for a `data:` URI (no server-side cropping available), so for uploaded photos each thumbnail instead applies a CSS transform to simulate a distinct crop/pan of the same image:

- `transform: scale(1.7)`
- `transformOrigin` per thumbnail index: `10% 10%`, `50% 50%`, `90% 90%`

Unsplash-sourced images are unaffected and keep using the original crop-query-param behavior.

### 3.3 "Ideal For" section (unchanged behavior, noted for reference)

Detail page shows `detailItem.idealFor` if the item carries it, otherwise falls back to `IDEAL_FOR_BY_CATEGORY[detailItem.category]`.

### 3.4 "Features & Tags" section (unchanged behavior, noted for reference)

Detail page shows `detailItem.tags` if the item carries it, otherwise falls back to `deriveTags(detailItem)`, which auto-generates tags such as `"{platformHeight}m Reach"`, `"{capacity}kg Capacity"`, and `"Like New"` (for `condition === "EXCELLENT"`) from the item's own fields.

### 3.5 Availability badge — hidden until dates are picked (grid + detail page, 3 spots)

Previously the "Available"/"Booked" (catalog card) and "● Available"/"● On Rent" (detail page) badges always rendered, defaulting to the "not available" styling whenever `available` was falsy — including `null`/`undefined`. All three spots are now gated on a `typeof ... === "boolean"` check, so nothing renders when availability isn't known:

```jsx
{typeof item.available === "boolean" && ( ... )}
```

In practice this means the badge is **hidden until the user picks a rental date range**: with no dates selected, `available` comes back `undefined` for each item, so the `typeof` check hides the badge; once dates are picked, the equipment list refetches and `available` becomes a real boolean per item. (How the date range gets fetched is a REST API concern — see `Spec-frontend-api-integration.md` — not covered here.)

The three spots:
- `EquipmentGrid.tsx:105` — catalog card badge, gated on `typeof item.available === "boolean"`.
- `App.tsx:995` — detail page hero badge, gated on `typeof liveAvailable === "boolean"`.
- `App.tsx:876` — the `SPEC_ROWS` "Availability" row: `typeof liveAvailable === "boolean" ? (liveAvailable ? "Available Now" : "Currently On Rent") : "—"`.

`liveAvailable` (`App.tsx:872`) is a detail-page-only derived value: `equipment.find((e) => e.id === detailItem.id)?.available ?? detailItem.available` — it looks up the same item in the freshly date-fetched `equipment` list (so the detail page reflects the same per-date availability as the grid it was opened from), falling back to `detailItem.available` if the item isn't in that list.

There's also a related helper at `App.tsx:1229`: when `liveAvailable === false` (a real, known "not available", not just "unknown"), the detail page shows `"This machine is currently on rent. Check back soon."` beneath the Select button.

### 3.6 Missing-field crash fixes

Some equipment fields the UI expects can come back missing/`undefined`/`null` depending on the data source, and several call sites called a method on them (`.split`, `.map`, `.toLocaleString`) without a guard — crashing React with no error boundary and blanking the whole page. Fixed:

| File | What broke | Fix |
|---|---|---|
| `EquipmentGrid.tsx` | `<img src>` assumed `img` was always a bare Unsplash photo id | `item.img.startsWith("data:") ? item.img : \`https://images.unsplash.com/${item.img}?...\`` (see 3.1) |
| `EquipmentGrid.tsx` | `item.location.split(",")[0]` crashed when `location` was missing | `item.location?.split(",")[0]` + `.filter(Boolean)` |
| `App.tsx` `SPEC_ROWS` | Weekly Rate / Location rows crashed or showed nothing useful when missing | Fallback to `"—"` |
| `App.tsx` main image + 3 thumbnails | Same Unsplash-only assumption | Same `data:` conditional, ×4 |
| `App.tsx` Pricing section | `weekly.toLocaleString()` crashed when `weekly` was missing | Guarded; the "Save X% vs daily" line is hidden rather than showing `NaN%` |
| `App.tsx` Ideal For / Tags | `.map()` crashed on missing arrays | `(x ?? []).map(...)`, later replaced by the smarter `IDEAL_FOR_BY_CATEGORY`/`deriveTags` fallbacks (3.3, 3.4) |

## 4. Manual Validation Checklist

- [ ] Confirm the 3 detail-page thumbnails show 3 visually distinct crops/pans of the uploaded photo (not 3 identical copies).
- [ ] Confirm an Unsplash-backed item's thumbnails still show 3 different Unsplash crops as before.
- [ ] Find/seed an equipment item with `available` as `null`/`undefined` and confirm no availability badge renders on the card or the detail page.
- [ ] Confirm items with `available: true`/`false` still show the correct badge and styling.
- [ ] Confirm "Ideal For" and "Features & Tags" sections still render correctly for both API-provided values and the derived fallbacks.
- [ ] With no dates picked, confirm no availability badge shows; pick a date range and confirm it appears once the equipment list refetches.

## 5. Change Log

- 2026-08-08: Created this document to capture the uploaded-photo (`data:` URI) support, the simulated-crop thumbnail strip for uploaded photos, and the availability badge now being conditional on `typeof available === "boolean"`.
- 2026-08-08: Added the missing-field crash-fix table; corrected 3.5 to explain the availability badge is effectively hidden until a date range is picked. Also removed a leftover `console.log("DEBUG availability:", ...)` debug statement from `App.tsx`'s catalog card `.map()`.
- 2026-08-08: Expanded 3.5 to document all 3 availability-badge spots (`EquipmentGrid.tsx` card badge, `App.tsx` detail hero badge, `App.tsx` `SPEC_ROWS` Availability row), the `liveAvailable` derivation on the detail page, and the "currently on rent" helper text shown when `liveAvailable === false`.
- 2026-08-08: Removed the REST API integration section (`login()`, date-aware `equipmentApi.list()`, mode-aware `handleLogin`) and related checklist items — that belongs to `Spec-frontend-api-integration.md`, not this doc, which is scoped to card/detail display behavior only.
- 2026-08-13: Corrected the §3.5 `App.tsx` line references (945→995, 845→876, 836→872, 1169→1229), which had drifted after an unrelated reformat of `App.tsx` on `HR-116-site-address-postal-code-validation`. No behavioral change.

## 6. Notes for Future Updates

- If the API ever models per-item photo uploads more formally (e.g. a dedicated `photoUrl` vs. `unsplashId` field instead of overloading `img`), update this document and the `img.startsWith("data:")` checks accordingly.
- If the real backend starts returning `available` even without dates supplied, section 3.5's "hidden until dates picked" behavior will change — update this document accordingly.
