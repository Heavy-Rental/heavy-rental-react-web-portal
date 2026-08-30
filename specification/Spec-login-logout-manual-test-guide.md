# Test Guide: Manual Verification of Login & Logout

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-04
**Status**: Current (mock-mode click-through)
**Relates to**: `Spec-frontend-authentication.md` (feature under test), `Spec-mock-api-server.md` (mock server this guide starts)

## Purpose

This is the copy-pasteable mock-mode login/logout walkthrough. Session persist and overlay *render* are also covered by `npm test` (`src/app/auth.test.ts`, `src/components/AuthLoadingOverlay.test.tsx`); this guide is still required for the click-through (including the 500ms overlay). Start the mock server with **Mock Server: Start / Restart Server** (`thinker.mock-server`).

## Prerequisites

- Thinker "Mock Server" VS Code extension installed (`thinker.mock-server`). Verify with:
  ```bash
  code --list-extensions --show-versions | grep mock-server
  ```
- Working tree on a current `develop`/`master` checkout of this portal (the original implementation branch name is historical).
- Two things must run **simultaneously**, in two separate places — the mock API and the web app are started completely differently:

| Component | How it's started | Where |
|---|---|---|
| Mock server | VS Code Command Palette | Not a terminal command |
| Web portal | `npm run dev` | Terminal, inside `heavy-rental-react-web-portal/` |

## Step 1 — Start the mock server (VS Code, not the terminal)

1. Click into the VS Code window so it has focus.
2. Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (Mac) to open the Command Palette.
3. Type `Start / Restart Server`.
4. Select **"Mock Server: Start / Restart Server"** from the dropdown.

   > The extension command title is **"Start / Restart Server"** (command id `mock-server.startServer`). Older docs called this **"Mock it"**; that label is not in v21.2.1.

5. The workspace's `.vscode/settings.json` / `.mockserverrc.cjs` are preconfigured to point the extension at `mock/db.json`, host `127.0.0.1`, port `4010`, base path `/api` — no manual config needed.

**Verify it's running:**
```bash
curl http://127.0.0.1:4010/api/assets
```
Expect a JSON array of 4 catalog items. `curl: (7) Failed to connect` means the server did not actually start — repeat step 1–4 and watch for a notification or output panel from the extension.

## Step 2 — Start the web portal (terminal)

Run from the **`heavy-rental-react-web-portal/` folder**, not the repo root (`package.json` only exists here):

```bash
cd /workspaces/heavy-rental-web-portal/heavy-rental-react-web-portal
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`) in a browser.

## Step 3 — Log in (happy path)

1. Click **"Sign In"** in the top nav.
2. Enter `alex.tan@example.sg` / `customer123`.
3. Submit.
4. ✅ Expect: a full-screen overlay with a centered Material 3 spinner, then the customer view (not the marketing homepage). The overlay must not appear on a later reload of an existing session.

## Step 4 — Confirm the mock API call and auth header

1. DevTools (F12) → **Network** tab.
2. Filter `users` → confirm a `GET /api/users` request fired during login (this resolves the real numeric `userId` — see `Spec-frontend-api-integration.md`).
3. Filter `api` generally → open any later `/api/...` request → **Headers** → confirm `Authorization: Bearer <token>` is present.

## Step 5 — Confirm the stored session

1. DevTools → **Application** tab → **Session Storage** → the `localhost:5173` origin.
2. Find key `heavy-rental.session`.
3. ✅ Expect: JSON containing `token`, `issuedAt`, `expiresAt`, with `expiresAt - issuedAt === 3600000`.

## Step 6 — Confirm reload persistence

1. Reload the page.
2. ✅ Expect: still on the customer view, still logged in, `heavy-rental.session` unchanged.

## Step 7 — Log out

1. Click **"Sign out"** in the customer view's nav.
2. ✅ Expect: returned to the logged-out marketing homepage.
3. Session Storage → `heavy-rental.session` key is gone.
4. Network tab → any subsequent `/api/...` request has **no** `Authorization` header.

## Step 8 — Wrong password rejected

1. Click **"Sign In"** again.
2. Enter `alex.tan@example.sg` with an incorrect password.
3. ✅ Expect: generic error **"Invalid email or password."**, modal stays open, no redirect.
4. Session Storage → confirm `heavy-rental.session` was **not** created.

## Bugs Found & Fixed

### 2026-08-04 — Step 6 (reload persistence) failed: session survived, but the view didn't

**Symptom**: Logged in as `alex.tan@example.sg` (customer), landed correctly on the customer view (Step 3 ✅), confirmed the `Authorization: Bearer <token>` header on later `/api/...` requests (Step 4 ✅), confirmed `heavy-rental.session` in Session Storage with the correct token/`issuedAt`/`expiresAt` and exactly `3600000` ms TTL (Step 5 ✅). Reloaded the page (Step 6) — expected to remain on the customer view per `Spec-frontend-authentication.md` Acceptance Scenario 2 ("I remain signed in to the same role/view"). Instead, the app bounced back to the logged-out-looking marketing homepage.

**Root cause isolation**: re-checked Session Storage immediately after the reload — `heavy-rental.session` was still present, unchanged, and still unexpired (`expiresAt - issuedAt` still `3600000`). This ruled out a session-clearing bug. The actual cause was in `src/App.tsx`: on mount, `user` state was correctly restored from the stored session via `restoreSession()`, but `view` state was hardcoded to always initialize to `"portal"`, with nothing to route it back to `"customer"`/`"dashboard"`/`"admin"` based on the restored user's role. So the app was technically still authenticated after reload, but visually indistinguishable from a logged-out state, because it rendered the marketing homepage instead of the customer view.

**Fix applied** (`src/App.tsx`):
- Added a small `viewForRole(role: Role): View` helper (`customer` → `"customer"`, `admin` → `"admin"`, else → `"dashboard"`), extracted from the inline ternary that `handleLogin` already used.
- Changed the `view` state's initializer from a hardcoded `"portal"` to `initialSession.user ? viewForRole(initialSession.user.role) : "portal"`, so a restored session now also restores the correct view.
- Updated `handleLogin` to call `viewForRole(role)` instead of duplicating the ternary, so the login-time and reload-time view-selection logic can't drift out of sync again.

**Verification after fix**: type-checked cleanly (`npx tsc -b --noEmit`, no errors). Re-tested Step 6 in the browser — reload now shows "Welcome, Alex" and correctly stays on the customer view. **Confirmed fixed.**

**Note — not a bug**: after the fix, a reload resets you to the *first* screen of the customer flow ("How can we help you today?") rather than whichever step you'd navigated to (e.g. "select your equipment"). This is expected: that step/navigation state lives inside the `CustomerOnboarding` component as local React state, which a full page reload always clears regardless of auth. `Spec-frontend-authentication.md` only requires the auth session and top-level role/view survive a reload — not deep in-flow navigation state, which is a separate concern outside this spec's scope.

## Results Log

_Fill in per test run — date, tester, outcome per step._

| Date | Tester | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 | Step 8 | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-08-04 | | Pass | Pass | Pass | Pass (after fix) | Pass | Pass | View-not-restored-on-reload bug found and fixed in `src/App.tsx`; confirmed fixed by re-test. All 8 steps pass as of this run. |

## Change Log

- 2026-08-04: Initial guide written, correcting the mock-server startup command name from `Spec-frontend-authentication.md`'s Appendix ("Mock it" → "Mock Server: Start / Restart Server") and consolidating the full local setup + manual test walkthrough in one place.
- 2026-08-04: First real test run against this guide found and fixed a Step 6 (reload persistence) bug — `view` state wasn't restored alongside `user` on mount, so a valid restored session landed on the marketing homepage instead of the correct role-based view. Fixed in `src/App.tsx` via a shared `viewForRole()` helper used by both `handleLogin` and the initial `view` state. See "Bugs Found & Fixed" above.
- 2026-08-30: Status Current. Curl sanity check is `GET /api/assets`. Intro no longer claims the auth spec still says "Mock it". Branch name is historical.
