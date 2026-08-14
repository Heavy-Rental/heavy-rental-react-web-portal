import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractPostalCode,
  isSingaporePostal,
  lookupSingaporePostal,
} from "./sgPostal";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractPostalCode / isSingaporePostal", () => {
  it("pulls a 6-digit code from anywhere in the address", () => {
    expect(extractPostalCode("20 Jurong Port Road, 619094")).toBe("619094");
    expect(extractPostalCode("619094 Singapore")).toBe("619094");
    expect(extractPostalCode("20 Jurong Port Road")).toBe("");
  });

  it("accepts only exactly 6 digits", () => {
    expect(isSingaporePostal("619094")).toBe(true);
    expect(isSingaporePostal("61909")).toBe(false);
    expect(isSingaporePostal("S619094")).toBe(false);
  });
});

describe("lookupSingaporePostal", () => {
  it("does not fetch when the query is shorter than 5 characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await lookupSingaporePostal("20")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the first valid OneMap POSTAL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ POSTAL: "619094" }],
        }),
      }),
    );
    expect(await lookupSingaporePostal("20 Jurong Port Road")).toBe("619094");
  });

  it("returns null when OneMap is !ok, empty, or NIL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );
    expect(await lookupSingaporePostal("unknown place")).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ POSTAL: "NIL" }] }),
      }),
    );
    expect(await lookupSingaporePostal("unknown place")).toBeNull();
  });
});
