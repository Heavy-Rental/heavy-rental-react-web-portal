import { describe, expect, it } from "vitest";
import { equipmentImageSrc, isUnsplashPhotoId } from "./equipmentImageSrc";

describe("equipmentImageSrc", () => {
  it("returns null for empty or unknown placeholders", () => {
    expect(equipmentImageSrc(undefined, 120, 120)).toBeNull();
    expect(equipmentImageSrc("", 120, 120)).toBeNull();
    expect(equipmentImageSrc("not-a-photo", 120, 120)).toBeNull();
  });

  it("passes through absolute and data URLs", () => {
    expect(equipmentImageSrc("https://cdn.example/a.jpg", 120, 120)).toBe(
      "https://cdn.example/a.jpg",
    );
    expect(equipmentImageSrc("data:image/png;base64,abc", 80, 80)).toBe(
      "data:image/png;base64,abc",
    );
  });

  it("maps Unsplash photo ids to a sized image URL", () => {
    expect(equipmentImageSrc("photo-1780054984720-20ccf265317f", 120, 120)).toBe(
      "https://images.unsplash.com/photo-1780054984720-20ccf265317f?w=120&h=120&fit=crop&auto=format",
    );
  });
});

describe("isUnsplashPhotoId", () => {
  it("accepts a well-formed photo id", () => {
    expect(isUnsplashPhotoId("photo-1780054984720-20ccf265317f")).toBe(true);
  });

  it("rejects values that would produce a malformed Unsplash request", () => {
    // Regression cases: an oversized/garbage string (414 URI Too Long), a data: URI
    // that lost its prefix, and a plain non-photo string.
    expect(isUnsplashPhotoId("data:image/png;base64,abc")).toBe(false);
    expect(isUnsplashPhotoId("a".repeat(2000))).toBe(false);
    expect(isUnsplashPhotoId("not-a-photo")).toBe(false);
    expect(isUnsplashPhotoId("")).toBe(false);
  });
});
