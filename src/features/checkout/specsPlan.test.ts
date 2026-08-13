import { describe, expect, it } from "vitest";
import { stubEquipment } from "../../test/equipment";
import {
  buildQuoteCartItems,
  shouldPromptDeliveryDetails,
  toggleEquipmentInPlan,
} from "./specsPlan";

const DATES = { startDate: "2026-09-01", endDate: "2026-09-21" };

describe("buildQuoteCartItems", () => {
  it("maps every recommended machine onto the quote date window", () => {
    const a = stubEquipment({ id: 1, name: "Boom" });
    const b = stubEquipment({ id: 4, name: "Excavator" });
    expect(buildQuoteCartItems([a, b], DATES)).toEqual([
      { equipment: a, ...DATES },
      { equipment: b, ...DATES },
    ]);
  });

  it("returns an empty cart when there are no recs", () => {
    expect(buildQuoteCartItems([], DATES)).toEqual([]);
  });
});

describe("shouldPromptDeliveryDetails", () => {
  it("skips Delivery Details after Add All (specs mode)", () => {
    expect(shouldPromptDeliveryDetails("specs")).toBe(false);
  });

  it("still prompts on Know / Browse / unset", () => {
    expect(shouldPromptDeliveryDetails("know")).toBe(true);
    expect(shouldPromptDeliveryDetails("browse")).toBe(true);
    expect(shouldPromptDeliveryDetails(null)).toBe(true);
  });
});

describe("toggleEquipmentInPlan", () => {
  const boom = stubEquipment({ id: 1, name: "Boom" });
  const excavator = stubEquipment({ id: 4, name: "Excavator" });

  it("adds a machine that is not in the plan", () => {
    expect(toggleEquipmentInPlan([], boom, DATES)).toEqual([
      { equipment: boom, ...DATES },
    ]);
  });

  it("removes a machine that is already in the plan", () => {
    const cart = buildQuoteCartItems([boom, excavator], DATES);
    expect(toggleEquipmentInPlan(cart, boom, DATES)).toEqual([
      { equipment: excavator, ...DATES },
    ]);
  });
});
