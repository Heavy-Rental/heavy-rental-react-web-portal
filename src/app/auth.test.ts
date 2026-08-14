import { afterEach, describe, expect, it } from "vitest";
import {
  AUTH_TTL_MS,
  clearSession,
  isExpired,
  issueSession,
  loadSession,
  saveSession,
} from "./auth";

afterEach(() => {
  clearSession();
});

describe("sessionStorage bearer token", () => {
  it("persists and restores a session including the token", () => {
    const session = issueSession({
      id: 1,
      name: "Alex Tan",
      role: "customer",
    });
    saveSession(session);
    expect(loadSession()).toEqual(session);
    expect(session.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(session.expiresAt - session.issuedAt).toBe(AUTH_TTL_MS);
  });

  it("returns null for missing or corrupt storage", () => {
    expect(loadSession()).toBeNull();
    sessionStorage.setItem("heavy-rental.session", "not-json");
    expect(loadSession()).toBeNull();
  });

  it("treats expiresAt in the past as expired", () => {
    const session = issueSession({ id: 1, name: "Alex", role: "customer" });
    expect(isExpired({ ...session, expiresAt: Date.now() - 1 })).toBe(true);
    expect(isExpired({ ...session, expiresAt: Date.now() + 60_000 })).toBe(
      false,
    );
  });

  it("clearSession removes the stored token", () => {
    saveSession(issueSession({ id: 1, name: "Alex", role: "customer" }));
    clearSession();
    expect(loadSession()).toBeNull();
  });
});
