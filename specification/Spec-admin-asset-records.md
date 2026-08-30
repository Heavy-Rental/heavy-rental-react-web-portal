# Guide: Admin Asset Records — Frontend Integration with the Asset API

| Field | Value |
|-------|--------|
| **Purpose** | Reference for how `heavy-rental-react-web-portal`'s Admin Asset Records tab integrates with the backend's Asset API — the data model, the photo-upload flow, auth, and error-handling contract |
| **Backend context** | Consumes the backend changes made in [`CHANGES-admin-asset-records.md`](./CHANGES-admin-asset-records.md) / [`SPEC-admin-portal.md`](./SPEC-admin-portal.md) |
| **Backend contract** | [`SPEC-equipment-browse-api.md`](./SPEC-equipment-browse-api.md) §7 (full request/response shapes, error codes) |
| **Status** | Implemented in `heavy-rental-react-web-portal`. This document describes the current integration, not pending work — see the frontend repo's own history for how it got here. |

This file lives in **this** portal repository (`specification/Spec-admin-asset-records.md`) even though it describes a backend-originated contract. Linked `CHANGES-admin-asset-records.md` / `SPEC-admin-portal.md` / `SPEC-equipment-browse-api.md` are backend-repo documents and are **not** present in this tree — treat `assetApi` + `src/app/types.ts` `Asset` as the in-repo source of truth if those links 404.

---

## 1. API surface

The Admin Asset Records tab talks to the backend entirely through `assetApi`, defined in `src/app/api.ts` as a `resource<Asset>("/assets")` (list/get/create/replace/update/remove) plus one hand-written extension:

- `assetApi.list(params?, signal?)` — supports optional `startDate`/`endDate` query params for availability-aware listing.
- `assetApi.uploadImage(id, dataUri)` — see §3.

The frontend's `Asset` type (`src/app/types.ts`) mirrors the backend's `AssetResponse` field-for-field. Both the type and the API export were renamed from `Equipment`/`equipmentApi` to `Asset`/`assetApi` to match the backend's `AssetController`/`AssetRequest`/`AssetResponse`/`/api/assets` naming — there is no legacy `Equipment` naming left in the frontend to cause "two names for one thing" confusion.

---

## 2. Data model: fields owned by the backend, not synthesized

`Asset` carries four fields that the frontend used to fake client-side before this integration existed, and now reads straight from the API response:

| Field | Type | Notes |
|---|---|---|
| `serialno` | `string` | Backend-assigned on create; the admin form's "Serial Number" input is sent on create/update and can influence it, but display always reflects the server's value. |
| `condition` | `ConditionType \| null` | `"EXCELLENT" \| "GOOD" \| "FAIR" \| "NEEDS_REPAIR"`. Editable via the admin form's Condition dropdown; sent on both create and update. |
| `lastConditionUpdatedAt` | `string \| null` | ISO timestamp. Server-owned — the backend bumps it whenever `condition` changes; the frontend never computes or sends this value. |
| `img` | `string` | Overloaded: an Unsplash photo-id fragment (seed/placeholder data) until an admin uploads a real photo, after which the backend returns a `data:image/...;base64,...` URI in the same field. |

`src/app/assetRecord.ts`'s `deriveAssetRecord(e: Asset)` maps these straight through (no synthesis), and exposes `resolvePhoto(img)` — a small helper that branches on the `data:` prefix to decide whether `img` is still the Unsplash placeholder or a real uploaded photo. `AdminDataContext.tsx`'s `buildFleetAssets` (Fleet Board's asset view) uses the same real fields and the same `resolvePhoto` helper, rather than maintaining its own parallel fake-data generator.

---

## 3. Photo persistence

`AssetFormModal.tsx` reads a selected file client-side via `FileReader.readAsDataURL` (drag-drop or file picker) and holds it in local form state as a `data:` URI. Persisting it is a separate step from saving the asset record:

1. On submit, `AssetsTab.tsx`'s `handleAssetSave` first creates/updates the asset via `assetApi.create`/`assetApi.update` as normal.
2. If the photo changed (compared against the previously-saved record) and is a `data:` URI, it then calls `assetApi.uploadImage(id, dataUri)` → `PUT /api/assets/{id}/image` with body `{"image": "<base64, no data: prefix>"}` (`SPEC-equipment-browse-api.md` §7.6).
3. The endpoint's response is the full updated `Asset`/`AssetResponse`, whose `img` field is now a `data:image/jpeg;base64,...` URI — that becomes the asset's photo going forward, in place of the Unsplash-derived placeholder.

Because the base asset record and its photo are two separate write calls, `AssetFormModal.tsx` validates the photo's size client-side before ever submitting (`MAX_PHOTO_DATA_URI_LENGTH`, ~7,000,000 characters — the same limit the backend enforces via `413`), so a save never half-succeeds with the record persisted but the photo silently dropped. A server-side `413` is still handled defensively (see §5) in case of client/server limit drift.

---

## 4. Auth

Write routes require `ROLE_ADMIN` server-side. The frontend satisfies this structurally rather than through a per-request check: `setAuthToken()` is populated once at admin login (`src/App.tsx`) and every `request()` call in `api.ts` attaches it automatically — there is no separate or stale token path, and the Asset Records tab is only reachable through the admin dashboard (role-gated client-side, admin-only login).

One nuance: `AssetFormModal` is also rendered from the non-admin `EmployeeDashboard`. That path only mutates local React state and never calls `assetApi`, so no unauthorized write actually reaches the backend from it today — worth re-checking if that dashboard is ever wired to real API calls.

---

## 5. Error handling contract

The backend's error envelope is `{"error": "<code>", "message": "<text>"}` (`bad_request`/`forbidden`/`conflict`/`payload_too_large`/etc.). `src/app/api.ts`'s `request<T>()` parses this on any non-2xx response and throws an `ApiError` (carrying `.code` and `.message`) when the body matches the envelope, falling back to a generic `Error` with the raw response text otherwise. Callers switch on `.code` rather than string-matching `.message`:

| Status | Code | Where handled | UX |
|---|---|---|---|
| `403` | `forbidden` | `AssetsTab.tsx` (save + delete) | Toast: "You don't have permission to do this." |
| `409` | `conflict` | `AssetsTab.tsx` → `AssetFormModal.tsx` | The backend's message (`"Asset name already in use: <name>"`) is surfaced inline under the Name field via a `nameError` prop, not as a toast — the modal stays open. |
| `413` | `payload_too_large` | `AssetFormModal.tsx` (client-side pre-check), `AssetsTab.tsx` (server-side fallback) | Client-side: rejected before submit, error shown under the upload control. Server-side fallback: the asset record still saves; the toast notes the photo specifically failed to upload. |

---

## 6. Mock server (`dev:mock`) behavior and known limitations

`npm run dev:mock` proxies `/api` to a mock server started via the Thinker "Mock Server" VS Code extension (see `Spec-mock-api-server.md`), reading `mock/db.json` directly — there is no custom route/middleware code in this repo backing it. `mock/db.json`'s `assets` collection includes `serialno`/`condition`/`lastConditionUpdatedAt` per item so the mock stays field-compatible with the real contract, and generic `POST`/`PUT`/`PATCH` against the extension's REST-over-JSON behavior already accepts and stores those fields without any custom code.

Two things the real contract has that the mock **cannot** reproduce, because the extension only serves generic CRUD over static JSON with no custom-route support:

- `PUT /api/assets/{id}/image` — there is no nested sub-resource route mechanism available, so the photo-upload flow (§3) cannot be exercised against `dev:mock`, only against `dev:api` (the real backend).
- Synthetic `409`/`413` responses — the mock has no validation logic to produce these on demand, so `409`/`413` handling (§5) can only be exercised against `dev:api` as well.

If exercising these flows without a live backend becomes a recurring need, that requires either extending the mock tooling itself (the previous npm-invokable mock server with custom middleware was removed for a security advisory — see `Spec-mock-api-server.md`'s Change Log) or accepting the gap.

---

## 7. Create-response shape

`api.ts`'s `resource().create()` unwraps `unwrapCreateResponse()` because the mock server wraps `POST` responses in a single-element array (`[T]`) while `PUT`/`PATCH`/`GET` are bare. The real Spring backend's `AssetController.create` returns a bare `AssetResponse`, matching `PUT`/`PATCH` — `unwrapCreateResponse()` handles both shapes transparently (`Array.isArray(body) ? body[0] : body`), so callers always get `T` regardless of which backend answered. This was validated against a disposable local mock replicating both shapes; it has not been independently re-verified against a live `heavy-rental-rest-api` instance.
