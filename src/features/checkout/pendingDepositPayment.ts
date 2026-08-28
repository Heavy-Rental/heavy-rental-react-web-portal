import type { CartItem } from "../cart/CartContext";
import type { PaymentOption } from "../../app/types";

const STORAGE_KEY = "hr_pending_deposit_payment";

export interface PendingDepositPayment {
  bookingId: number;
  paymentIntentId: string;
  clientSecret: string;
  // The amount actually charged for this PaymentIntent — the deposit amount when
  // paymentOption is "DEPOSIT", or the full total when "FULL" (HR-213).
  amountDue: number;
  paymentOption: PaymentOption;
  cart: CartItem[];
}

// Survives a full-page Stripe redirect (3DS challenges / redirect-based payment methods
// that `confirmPayment({ redirect: "if_required" })` can still trigger) so the app can
// rebuild the confirmation screen on return — a real browser navigation clears all
// in-memory React state (cart, apiPayment, etc), unlike the common case where
// confirmPayment resolves without ever leaving the page. sessionStorage, not
// localStorage: this is scoped to one checkout attempt, not something that should
// outlive the tab.
export function savePendingDepositPayment(payment: PendingDepositPayment): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payment));
}

export function loadPendingDepositPayment(): PendingDepositPayment | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingDepositPayment;
  } catch {
    return null;
  }
}

export function clearPendingDepositPayment(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
