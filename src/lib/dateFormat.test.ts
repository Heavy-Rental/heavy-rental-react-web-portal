import { describe, it, expect } from "vitest";
import { daysBetweenISO } from "./dateFormat";

// api-contract-for-frontend.md §8: client-side price preview relies on this being
// inclusive of both endpoints — a preview using an exclusive count would understate
// the price actually charged once an item is added.
describe("daysBetweenISO", () => {
  it("counts inclusively per the contract's worked example (2026-09-01 → 2026-09-05 = 5 days)", () => {
    expect(daysBetweenISO("2026-09-01", "2026-09-05")).toBe(5);
  });

  it("returns 1 for a single-day range", () => {
    expect(daysBetweenISO("2026-09-01", "2026-09-01")).toBe(1);
  });

  it("counts correctly across a month boundary", () => {
    expect(daysBetweenISO("2026-08-30", "2026-09-02")).toBe(4);
  });
});
