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

  it("dedupes recommendations that resolve to the same equipment, keeping the first", () => {
    // Regression: the recommendation engine can return two recommendation lines for the
    // same catalog equipment (e.g. two project-spec lines both matched to the same unit).
    // Every other cart mutation in this app enforces one line per equipment id — this must
    // too, or downstream code keyed on equipment.id (React list keys, planItemIds, removal)
    // breaks once a duplicate equipment id reaches the cart.
    const forkliftFirst = stubEquipment({ id: 7, name: "Hyster H4.2FT Forklift" });
    const forkliftAgain = stubEquipment({ id: 7, name: "Hyster H4.2FT Forklift" });
    const excavator = stubEquipment({ id: 4, name: "Excavator" });
    expect(
      buildQuoteCartItems([forkliftFirst, excavator, forkliftAgain], DATES),
    ).toEqual([
      { equipment: forkliftFirst, ...DATES },
      { equipment: excavator, ...DATES },
    ]);
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
