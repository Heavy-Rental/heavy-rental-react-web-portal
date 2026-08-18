import type { Role, StoredSession } from "./types";

// Client-simulated bearer-token session (Spec-frontend-authentication.md).
// No backend issues or validates this token — see that spec's Overview for why.

export const AUTH_TTL_MS = 3600 * 1000;

const STORAGE_KEY = "heavy-rental.session";

function generateToken(): string {
  return crypto.randomUUID();
}

export function issueSession(user: { id: number | null; name: string; role: Role }): StoredSession {
  const issuedAt = Date.now();
  return {
    token: generateToken(),
    id: user.id,
    name: user.name,
    role: user.role,
    issuedAt,
    expiresAt: issuedAt + AUTH_TTL_MS,
  };
}

export function saveSession(session: StoredSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): StoredSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isExpired(session: StoredSession): boolean {
  return Date.now() >= session.expiresAt;
}
