import type { Role, View, StoredSession } from "./types";
import { loadSession, clearSession, isExpired } from "./auth";
import { setAuthToken } from "./api";

// Reads any persisted session once at mount time: restores it (and primes the
// api client's auth token) if still valid, or reports the expired-notice text
// if it lapsed while the tab was closed. Runs as a useState lazy initializer
// rather than an effect since it's a synchronous derivation from sessionStorage,
// not a subscription to an external system.
export function restoreSession(): {
  user: StoredSession | null;
  notice: string | null;
} {
  const stored = loadSession();
  if (!stored) return { user: null, notice: null };
  if (isExpired(stored)) {
    clearSession();
    return {
      user: null,
      notice: "Your session has expired. Please log in again.",
    };
  }
  setAuthToken(stored.token);
  return { user: stored, notice: null };
}

export function viewForRole(role: Role): View {
  return role === "customer"
    ? "customer"
    : role === "admin"
      ? "admin"
      : "dashboard";
}
