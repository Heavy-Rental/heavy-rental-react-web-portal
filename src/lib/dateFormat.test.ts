import { describe, it, expect } from "vitest";
import { addDaysISO, daysBetweenISO, resolveQuoteDates } from "./dateFormat";

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

const TODAY = "2026-08-13";

describe("resolveQuoteDates", () => {
  it("uses tentativeStartDate and tentativeEndDate when both are valid", () => {
    expect(
      resolveQuoteDates(
        {
          tentativeStartDate: "2026-09-01",
          tentativeEndDate: "2026-09-21",
          days: 21,
        },
        TODAY,
      ),
    ).toEqual({ startDate: "2026-09-01", endDate: "2026-09-21" });
  });

  it("uses tentativeStartDate + days when end is missing", () => {
    expect(
      resolveQuoteDates(
        { tentativeStartDate: "2026-09-01", days: 21 },
        TODAY,
      ),
    ).toEqual({ startDate: "2026-09-01", endDate: "2026-09-21" });
  });

  it("derives today → today+days-1 when only days is present", () => {
    expect(resolveQuoteDates({ days: 21 }, TODAY)).toEqual({
      startDate: TODAY,
      endDate: addDaysISO(TODAY, 20),
    });
  });

  it("uses start + days when the tentative range is inverted", () => {
    expect(
      resolveQuoteDates(
        {
          tentativeStartDate: "2026-09-21",
          tentativeEndDate: "2026-09-01",
          days: 7,
        },
        TODAY,
      ),
    ).toEqual({ startDate: "2026-09-21", endDate: "2026-09-27" });
  });

  it("returns null when no usable dates or days are present", () => {
    expect(resolveQuoteDates({}, TODAY)).toBeNull();
    expect(resolveQuoteDates({ days: 0 }, TODAY)).toBeNull();
    expect(
      resolveQuoteDates({ tentativeStartDate: "not-a-date" }, TODAY),
    ).toBeNull();
  });

  it("clamps a past start to today and keeps the duration", () => {
    expect(
      resolveQuoteDates(
        {
          tentativeStartDate: "2026-08-01",
          tentativeEndDate: "2026-08-10",
        },
        TODAY,
      ),
    ).toEqual({ startDate: TODAY, endDate: addDaysISO(TODAY, 9) });
  });
});
