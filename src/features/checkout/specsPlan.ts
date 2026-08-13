import type { Equipment, OnboardingMode } from "../../app/types";
import type { QuoteDateRange } from "../../lib/dateFormat";
import type { CartItem } from "../cart/CartContext";

export function buildQuoteCartItems(
  recs: Equipment[],
  dates: QuoteDateRange,
): CartItem[] {
  return recs.map((eq) => ({
    equipment: eq,
    startDate: dates.startDate,
    endDate: dates.endDate,
  }));
}

export function shouldPromptDeliveryDetails(
  onboardingMode: OnboardingMode,
): boolean {
  return onboardingMode !== "specs";
}

export function toggleEquipmentInPlan(
  cart: CartItem[],
  eq: Equipment,
  dates: QuoteDateRange,
): CartItem[] {
  if (cart.some((c) => c.equipment.id === eq.id)) {
    return cart.filter((c) => c.equipment.id !== eq.id);
  }
  return [
    ...cart.filter((c) => c.equipment.id !== eq.id),
    { equipment: eq, startDate: dates.startDate, endDate: dates.endDate },
  ];
}
