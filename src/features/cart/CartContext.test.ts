import { describe, it, expect } from "vitest";
import { cartFromRentalPlan, findActiveRentalPlan, cartDateRange } from "./CartContext";
import type { Equipment, RentalPlanResponse } from "../../app/types";

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 1,
    name: "CAT 320 Excavator",
    category: "Excavator",
    baseDailyRate: 450,
    minDailyRate: 400,
    maxDailyRate: 500,
    weekly: 2800,
    capacity: 20,
    platformHeight: null,
    purchaseYear: 2022,
    location: "Jurong Depot",
    rating: 4.5,
    reviews: 10,
    available: true,
    img: "",
    tags: [],
    utilization: 0,
    revenue: 0,
    hoursThisMonth: 0,
    desc: "",
    idealFor: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<RentalPlanResponse> = {}): RentalPlanResponse {
  return {
    id: 55,
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    siteAddress: "20 Jurong Port Road, 619094",
    status: "DRAFT",
    totalAmount: null,
    items: [],
    updatedAt: "2026-08-13T10:30:00",
    createdAt: "2026-08-13T09:15:00",
    ...overrides,
  };
}

describe("cartFromRentalPlan", () => {
  it("resolves each item's assetId against the equipment catalog and applies the plan's shared date range", () => {
    const equipment = [makeEquipment({ id: 4, name: "CAT 320 Excavator" })];
    const plan = makePlan({
      items: [{ id: 101, assetId: 4, assetName: "CAT 320 Excavator", dailyRate: 450, subtotal: 2250 }],
    });

    const { cart, itemIds } = cartFromRentalPlan(plan, equipment);

    expect(cart).toEqual([
      { equipment: equipment[0], startDate: plan.startDate, endDate: plan.endDate },
    ]);
    expect(itemIds).toEqual({ 4: 101 });
  });

  it("drops items whose asset isn't in the fetched catalog instead of showing them broken", () => {
    const plan = makePlan({
      items: [{ id: 101, assetId: 999, assetName: "Unknown Asset", dailyRate: 450, subtotal: 2250 }],
    });

    const { cart, itemIds } = cartFromRentalPlan(plan, []);

    expect(cart).toEqual([]);
    // itemIds still tracks the mapping — needed so a later removeItem() on the
    // now-hidden line is still possible.
    expect(itemIds).toEqual({ 999: 101 });
  });

  it("returns an empty cart for a plan with no items", () => {
    const { cart, itemIds } = cartFromRentalPlan(makePlan({ items: [] }), [makeEquipment()]);
    expect(cart).toEqual([]);
    expect(itemIds).toEqual({});
  });
});

describe("findActiveRentalPlan", () => {
  it("returns undefined when the caller has no plans", () => {
    expect(findActiveRentalPlan([])).toBeUndefined();
  });

  it.each(["DRAFT", "SAVED", "QUOTED"] as const)(
    "treats a %s plan as active",
    (status) => {
      const plan = makePlan({ status });
      expect(findActiveRentalPlan([plan])).toBe(plan);
    },
  );

  it.each(["CONVERTED", "CANCELLED"] as const)(
    "does not treat a %s plan as active",
    (status) => {
      expect(findActiveRentalPlan([makePlan({ status })])).toBeUndefined();
    },
  );

  it("finds the one active plan among a converted/cancelled history", () => {
    const active = makePlan({ id: 3, status: "QUOTED" });
    const plans = [
      makePlan({ id: 1, status: "CONVERTED" }),
      makePlan({ id: 2, status: "CANCELLED" }),
      active,
    ];
    expect(findActiveRentalPlan(plans)).toBe(active);
  });
});

describe("cartDateRange", () => {
  it("collapses per-item ranges to the widest covering range", () => {
    const cart = [
      { equipment: makeEquipment({ id: 1 }), startDate: "2026-09-03", endDate: "2026-09-05" },
      { equipment: makeEquipment({ id: 2 }), startDate: "2026-09-01", endDate: "2026-09-08" },
      { equipment: makeEquipment({ id: 3 }), startDate: "2026-09-02", endDate: "2026-09-04" },
    ];
    expect(cartDateRange(cart)).toEqual({ startDate: "2026-09-01", endDate: "2026-09-08" });
  });

  it("returns the single item's own range for a one-item cart", () => {
    const cart = [{ equipment: makeEquipment(), startDate: "2026-09-01", endDate: "2026-09-05" }];
    expect(cartDateRange(cart)).toEqual({ startDate: "2026-09-01", endDate: "2026-09-05" });
  });
});
