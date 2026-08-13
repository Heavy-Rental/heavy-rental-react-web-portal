/* eslint-disable react-refresh/only-export-components -- Context provider, its hook, and the
   cart-derivation helpers that operate on the same CartItem shape are kept together deliberately;
   splitting them wouldn't change runtime behavior, only Fast Refresh granularity in this one file. */
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Equipment, Depot, RentalPlanResponse } from "../../app/types";

export interface CartItem {
  equipment: Equipment;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
}

// ─── REAL BACKEND (MODE === "api"): cart ↔ persisted RentalPlan ────────────────
// In API mode, `cart` is a mirror of the customer's one active (non-CONVERTED)
// RentalPlan (Spec-rental-plan-cart-checkout.md B9) — every mutation goes through
// `rentalPlanCartApi` first, and `cart` is only ever set from that call's response,
// never optimistically. These are pure derivation helpers, not part of the context
// itself, since the async orchestration (which endpoint to call, when to create a
// plan) lives with the rest of cart orchestration in the consuming component.

// RentalPlanItem carries assetId, not a full Equipment record — resolve against the
// already-fetched catalog. Items whose asset isn't in `equipment` (e.g. filtered out
// by the shared date-range availability query) are dropped rather than shown broken.
export function cartFromRentalPlan(
  plan: RentalPlanResponse,
  equipment: Equipment[],
): { cart: CartItem[]; itemIds: Record<number, number> } {
  const cart: CartItem[] = [];
  const itemIds: Record<number, number> = {};
  for (const item of plan.items) {
    itemIds[item.assetId] = item.id;
    const eq = equipment.find((e) => e.id === item.assetId);
    if (eq)
      cart.push({ equipment: eq, startDate: plan.startDate, endDate: plan.endDate });
  }
  return { cart, itemIds };
}

// No server-side "active plan" filter exists (contract §7) — a customer has at most
// one non-CONVERTED plan at a time, enforced server-side.
export function findActiveRentalPlan(
  plans: RentalPlanResponse[],
): RentalPlanResponse | undefined {
  return plans.find((p) => p.status !== "CONVERTED");
}

// Spec-ui-heavy-machinery-portal.md §4.3: all equipment in one booking must share a
// single start/end date — the cart lets each item pick its own range, so checkout
// collapses it to the widest covering range (earliest start / latest end).
export function cartDateRange(cart: CartItem[]): {
  startDate: string;
  endDate: string;
} {
  // ISO "YYYY-MM-DD" strings sort correctly with plain string comparison — no Date math needed.
  return {
    startDate: cart.reduce(
      (min, c) => (c.startDate < min ? c.startDate : min),
      cart[0].startDate,
    ),
    endDate: cart.reduce(
      (max, c) => (c.endDate > max ? c.endDate : max),
      cart[0].endDate,
    ),
  };
}

export function resolveCartDepotId(cart: CartItem[], depots: Depot[]): number {
  const locations = new Set(cart.map((c) => c.equipment.location));
  if (locations.size !== 1) {
    throw new Error(
      "Equipment in your cart is spread across multiple depots — a booking can only be fulfilled from one depot.",
    );
  }
  const depot = depots.find((d) => d.name === cart[0].equipment.location);
  if (!depot)
    throw new Error(
      `No depot matches location "${cart[0].equipment.location}".`,
    );
  return depot.id;
}

interface CartContextValue {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  cartOpen: boolean;
  setCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <CartContext.Provider value={{ cart, setCart, cartOpen, setCartOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
