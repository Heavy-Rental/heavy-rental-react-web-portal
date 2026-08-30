import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Real-backend-only (MODE === "api"). VITE_STRIPE_PUBLISHABLE_KEY is a
// publishable pk_ key (see .env.api and Spec-stripe-payment-checkout.md FR-006).
// Secret sk_ / whsec_ values must never be committed.
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}
