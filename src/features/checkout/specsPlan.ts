import type { Asset, OnboardingMode } from "../../app/types";
import type { QuoteDateRange } from "../../lib/dateFormat";
import type { CartItem } from "../cart/CartContext";

export function buildQuoteCartItems(
  recs: Asset[],
  dates: QuoteDateRange,
): CartItem[] {
  // Deduped by equipment id, first occurrence wins — the recommendation engine can return
  // more than one recommendation line resolving to the same catalog equipment (e.g. two
  // project-spec lines both matched to the same "best available" unit). Every other cart
  // mutation in this app (addToCart, toggleEquipmentInPlan) enforces one line per equipment
  // id; letting this be the one path that doesn't breaks every downstream assumption keyed
  // on equipment.id — React list keys (duplicate-key warnings), planItemIds (a plain object
  // keyed by equipment id, so it can only ever track one line per id), and removal (which
  // filters out all matching entries at once, so a duplicate can never be discarded singly).
  const seen = new Set<number>();
  return recs
    .filter((eq) => {
      if (seen.has(eq.id)) return false;
      seen.add(eq.id);
      return true;
    })
    .map((eq) => ({
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
  eq: Asset,
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
