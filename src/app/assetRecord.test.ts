import { describe, expect, it } from "vitest";
import { resolvePhoto } from "./assetRecord";

describe("resolvePhoto", () => {
  it("passes a data: URI through unchanged", () => {
    expect(resolvePhoto("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
  });

  it("builds an Unsplash URL from a photo id without doubling the 'photo-' prefix", () => {
    // Regression: img already carries the "photo-" prefix (confirmed against
    // mock/db.json) — resolvePhoto used to prepend a second one, producing
    // "photo-photo-..." URLs that always 404'd.
    expect(resolvePhoto("photo-1780054984720-20ccf265317f")).toBe(
      "https://images.unsplash.com/photo-1780054984720-20ccf265317f?w=400&q=80",
    );
  });

  it("falls back to an empty string for a malformed value instead of building a broken URL", () => {
    // Regression: an oversized/garbage string used to be concatenated straight into
    // the Unsplash path (414 URI Too Long / 502 from Unsplash's edge).
    expect(resolvePhoto("a".repeat(2000))).toBe("");
    expect(resolvePhoto("not-a-photo")).toBe("");
    expect(resolvePhoto("")).toBe("");
  });
});
