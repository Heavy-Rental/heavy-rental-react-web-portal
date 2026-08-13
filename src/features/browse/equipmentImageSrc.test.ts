import { describe, expect, it } from "vitest";
import { equipmentImageSrc } from "./CustomerOnboarding";

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
