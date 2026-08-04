# Feature Specification: Frontend Authentication Session (Bearer Token)

**Feature Area**: heavy-rental-react-web-portal
**Created**: 2026-08-04
**Status**: Implemented
**Input**: "Using Specification Driven Development methodology in this project ... can you help me implement login and logout process in this web portal making sure that the user is able to maintain the authenticated status? The bearer token will last for 3600 seconds after user request is authenticated. Make sure the authenticated status is revoked once the bearer token is expired."

## Overview

`Spec-frontend-api-integration.md` wired the portal's `LoginModal` to resolve a real numeric `userId` from `/api/users` at login, but explicitly scoped out "Authentication and session security beyond the existing local demo-account login gate" — until this feature, a successful login produced only an in-memory `{ name, role, id }` object with no token, no expiry, and no persistence; any page reload silently logged the user out. `Spec-mock-api-server.md` separately lists "Authentication and authorization" as Out of Scope for the mock server itself, and its Change Log records that a prior custom middleware layer was removed after an `npm audit` high-severity finding — so the mock server must not gain any new server-side behavior.

This feature adds a **client-simulated bearer-token session** on top of that same demo-account login gate. Login still resolves the account exactly as before (`ACCOUNTS` map + `userApi.list()` email match, unchanged); what's new is that a successful login now issues an opaque bearer token with a fixed 3600-second time-to-live, persists it across page reloads for the lifetime of the browser tab, attaches it to every subsequent API request, and reliably revokes the authenticated status — both proactively while the tab stays open, and retroactively on reload — once that TTL elapses. No backend ever issues or validates this token; the mock API is unaffected and remains fully unauthenticated, exactly as `Spec-mock-api-server.md` describes.

## Clarifications

### Session 2026-08-04

- Q: There's no real backend, and the mock API explicitly has no auth (with custom mock-server middleware previously removed for a security finding) — how should the bearer token be issued? → A: Client-simulated. Keep the existing demo-account login check unchanged; on success, generate a client-side opaque token with a 3600s TTL via an isolated `issueSession()` function, structured so a future real `POST /api/login` call could replace it without touching call sites. No new mock-server endpoint is added.
- Q: What format should the token take, given nothing server-side ever parses it? → A: A random opaque string (`crypto.randomUUID()`), not a JWT — the actual source of truth for validity is the locally-stored `expiresAt` timestamp, not the token's content, so encoding claims into the token would add complexity with no payoff.
- Q: Should the authenticated session survive a page reload while the token is still valid? → A: Yes — persist the token and session metadata to `sessionStorage` (per-tab, cleared on tab close), and restore the session on app mount only if the stored `expiresAt` is still in the future.
- Q: How should expiry actually be enforced, given the tab could stay open past 3600s or be closed and reopened after? → A: Both a proactive client-side timer (scheduled for the full TTL at login, and for the remaining time on a restored session) that revokes access immediately without requiring a reload, and an on-mount check that rejects and clears an already-expired stored session rather than restoring it.
- Q: What should the user see when the token expires? → A: A brief, auto-dismissing notice ("Your session has expired. Please log in again.") before the view returns to the logged-out portal state — whether the expiry was detected by the proactive timer or found already-expired on mount.

### Session 2026-08-04 (continued)

- Q: The password field was required to be non-empty but never checked against a real value — should logging in require actually keying in the correct username and password? → A: Yes. Each demo account in `ACCOUNTS` now carries a fixed expected password, and `LoginModal` compares the entered password against it exactly; a mismatch on either the email or the password is rejected with one generic error ("Invalid email or password.") so the response doesn't reveal which field was wrong. This is still a fully client-side, plaintext, demo-grade check — not real security, since the expected values ship visible in the client bundle — so it does not change anything about how the mock API or the bearer-token session behave.

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a customer, employee, or admin, once I log in I stay signed in — including across a page reload — for up to one hour, and I'm cleanly signed out with a clear notice the moment that hour elapses, without needing any backend to enforce it.

### Acceptance Scenarios

1. **Given** the login modal, **When** I sign in with a valid demo account, **Then** a bearer token is issued with an expiry exactly 3600 seconds in the future, and every subsequent API request carries `Authorization: Bearer <token>`.
2. **Given** an active, unexpired session, **When** I reload the page, **Then** I remain signed in to the same role/view without being prompted to log in again.
3. **Given** a session whose `expiresAt` has already passed (e.g. the tab was closed and reopened after an hour), **When** the app loads, **Then** I am shown as logged out, the stale session is cleared from storage, and I see the "session expired" notice once.
4. **Given** an active session left open in the tab, **When** 3600 seconds elapse without a reload, **Then** I am automatically signed out, the "session expired" notice appears, and the view returns to the logged-out portal — with no action required from me.
5. **Given** I am signed in, **When** I click "Log out," **Then** the session is cleared from storage immediately, no pending expiry timer remains, and the next API request carries no `Authorization` header.
6. **Given** `sessionStorage` contains corrupted or non-JSON session data, **When** the app loads, **Then** it starts in the logged-out state without crashing.
7. **Given** the login modal, **When** I enter a known demo email with the wrong password (or an unknown email), **Then** the submission is rejected with a single generic error ("Invalid email or password.") and no session is issued.

### Edge Cases

- What happens across multiple tabs? → `sessionStorage` is per-tab by design; sessions do not sync across tabs. This is expected, not a defect.
- What happens if the system clock changes? → Expiry is computed from an absolute `expiresAt` timestamp captured at issuance; clock changes after issuance can shift the effective TTL, which is an accepted limitation of a fully client-side clock-based scheme.
- What happens if the login's `userApi.list()` lookup fails to resolve a numeric `userId`? → Unchanged from `Spec-frontend-api-integration.md`: login proceeds with `id: null`, now carried inside the issued session exactly as it was in the prior in-memory `user` state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Login MUST, after resolving the account via the existing `ACCOUNTS`/`userApi.list()` flow (unchanged), issue a client-generated opaque bearer token through an isolated function (`issueSession()` in `src/app/auth.ts`) structured so it can be replaced by a real server-issued-token call without changing any call site.
- **FR-002**: The issued session MUST carry a fixed time-to-live of exactly 3600 seconds from issuance, stored as an absolute `expiresAt` timestamp rather than a relative counter.
- **FR-003**: The session (token, minimal user info, `issuedAt`, `expiresAt`) MUST be persisted to `sessionStorage` and MUST survive a full page reload within the same browser tab for as long as it remains unexpired.
- **FR-004**: On every app mount, the app MUST read any stored session and MUST restore the authenticated state only if `expiresAt` is still in the future; an already-expired stored session MUST be cleared and MUST NOT be silently restored.
- **FR-005**: A proactive client-side timer MUST revoke the authenticated session automatically at the moment of expiry without requiring a reload — scheduled for the full 3600-second TTL at login, and for the remaining time when a valid session is restored on mount.
- **FR-006**: Every outgoing request through `src/app/api.ts`'s `request()` MUST include `Authorization: Bearer <token>` while a session is active, and MUST omit the header entirely once logged out.
- **FR-007**: On expiry detection — whether by the proactive timer or by finding an already-expired session on mount — the app MUST show a brief, auto-dismissing notice indicating the session expired, and MUST return the view to the logged-out portal state.
- **FR-008**: Logout MUST clear the stored session, the in-memory auth token used for request injection, and any pending expiry timer immediately, leaving no residual `Authorization` header on subsequent requests.
- **FR-009**: The mock API server MUST NOT be modified to add any authentication or authorization behavior, and the token MUST NOT be validated anywhere server-side (per `Spec-mock-api-server.md`'s Out of Scope).
- **FR-010**: The login form MUST compare the entered password against a fixed expected value for the matched demo account (`ACCOUNTS` in `src/App.tsx`) and MUST reject the submission with a single generic error when either the email or the password doesn't match, without revealing which one was wrong.

### Key Entities / Components

- **`src/app/auth.ts`**: New module — `issueSession()`, `saveSession()`/`loadSession()`/`clearSession()` (sessionStorage read/write/clear under key `heavy-rental.session`), and `isExpired()`. The sole place a token is generated (`crypto.randomUUID()`) and the sole place TTL math happens (`AUTH_TTL_MS = 3600 * 1000`).
- **`src/app/types.ts`**: `StoredSession` type (`token`, `id`, `name`, `role`, `issuedAt`, `expiresAt`) — replaces the previous ad hoc inline `{ name, role, id }` shape used for the logged-in `user` state.
- **`src/app/api.ts`**: `setAuthToken()` plus conditional `Authorization` header injection inside `request()` — the single chokepoint every API call already passes through.
- **`src/App.tsx`**: `restoreSession()` (mount-time lazy state initializer reading `sessionStorage`), `scheduleExpiry()` (proactive timer), updated `handleLogin`/`handleLogout`, the session-expired notice banner (reusing the existing local toast visual pattern already present in `EmployeeDashboard`/`AdminDashboard`), and the `ACCOUNTS` map + `LoginModal.handleSubmit` password comparison (FR-010).

## Dependencies & Assumptions

- No new npm dependency — uses native `crypto.randomUUID()` and `sessionStorage`.
- Assumes `Spec-frontend-api-integration.md`'s login-to-`userId` resolution remains the source of truth for *who* logs in; this spec only adds *what happens after* that resolution succeeds.
- Assumes the mock server continues to have zero authentication, per `Spec-mock-api-server.md`.
- Assumes a single-tab usage model for session continuity — `sessionStorage` does not synchronize the session across multiple tabs/windows.

## Out of Scope

- A real backend authentication endpoint or any server-side token issuance/validation.
- ~~Password validation or hashing (still none — matches the existing demo-account gate).~~ **Superseded 2026-08-04**: password is now checked against a fixed per-account demo value (see FR-010) — but only as a plaintext client-side comparison; no hashing, no server-side check, no real secret storage, since the expected values ship in the client bundle.
- Refresh tokens or silent renewal beyond the fixed 3600-second TTL.
- Multi-tab session synchronization.
- "Remember me" / long-lived sessions beyond the tab's lifetime.
- CSRF/XSS hardening beyond what `sessionStorage` inherently provides.

## Appendix: Manual Testing

No test framework exists in this repo (`Spec-project-environment.md` FR-012), so verification is manual, against a running `npm run dev` (Vite, `localhost:5173`) with the mock API server (Thinker "Mock Server" extension, `127.0.0.1:4010`) also running.

1. **Login**: click "Sign In", authenticate as `alex.tan@example.sg` / `customer123` (customer) or `ravi.kumar@example.sg` / `admin123` (admin) — the exact demo passwords shown in the modal's hint text.
1a. **Wrong password rejected**: try `alex.tan@example.sg` with any other password (or an unknown email) → confirm the single generic error "Invalid email or password." appears and no `heavy-rental.session` entry is created.
2. **Inspect the session**: DevTools → Application → Session Storage → key `heavy-rental.session` → confirm `token`, `issuedAt`, `expiresAt` are present and `expiresAt - issuedAt` is exactly `3600000`.
3. **Check the header**: DevTools → Network → any `/api/...` request → confirm `Authorization: Bearer <token>` is present.
4. **Reload restores the session**: reload the page → confirm you remain signed in to the same view, and the `sessionStorage` entry is unchanged.
5. **Force an already-expired session**, then reload, in the DevTools console:
   ```js
   const s = JSON.parse(sessionStorage.getItem('heavy-rental.session'));
   s.expiresAt = Date.now() - 1000;
   sessionStorage.setItem('heavy-rental.session', JSON.stringify(s));
   ```
   Confirm the "Your session has expired. Please log in again." notice appears once, the view returns to the logged-out portal, and `sessionStorage` no longer holds the key.
6. **Proactive expiry** (optional, faster with a temporarily lowered `AUTH_TTL_MS` in `src/app/auth.ts`): log in and leave the tab open past the TTL without reloading → confirm the same notice and logout happen automatically, with no reload required. Revert the temporary TTL change afterward.
7. **Logout**: log in again, click "Sign out" (in the customer/employee/admin view's nav) → confirm `sessionStorage` is cleared immediately and the next API request has no `Authorization` header.
8. **Corrupted storage**: `sessionStorage.setItem('heavy-rental.session', 'not valid json')`, then reload → confirm the app does not crash and simply starts in the logged-out state.

## Review & Acceptance Checklist

### Content Quality

- [x] Describes required behavior and contracts, not internal implementation mechanics
- [x] Focused on the value this session behavior provides to end users of each role (customer, employee, admin)
- [x] Understandable by both technical and non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No open `[NEEDS CLARIFICATION]` markers remain — ambiguities were resolved in the Clarifications session above
- [x] Requirements are testable and unambiguous (each FR maps to an observable app behavior)
- [x] Success criteria are measurable (exact TTL, exact storage key, exact header format)
- [x] Scope is clearly bounded (see Out of Scope)
- [x] Dependencies and assumptions are identified

## Change Log

- 2026-08-04: Initial specification written, adding a client-simulated bearer-token session (3600s TTL, `sessionStorage`-persisted, proactive-timer + on-mount expiry detection, `Authorization` header injection in `src/app/api.ts`) on top of the existing demo-account login gate in `src/App.tsx` (`src/app/auth.ts` new; `src/app/types.ts`, `src/app/api.ts`, `src/App.tsx` modified). Amends `Spec-frontend-api-integration.md`'s authentication Out-of-Scope note (see that spec's own Change Log) and confirms the mock API (`Spec-mock-api-server.md`) remains fully unauthenticated.
- 2026-08-04: Added FR-010 — `ACCOUNTS` in `src/App.tsx` now carries a fixed demo password per account, and `LoginModal.handleSubmit` compares the entered password against it (single generic "Invalid email or password." error on any mismatch), superseding the prior "Password validation or hashing: still none" Out-of-Scope line. Still a plaintext, fully client-side check — no hashing, no backend involvement.
