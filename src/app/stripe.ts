import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Real-backend-only (MODE === "api"). VITE_STRIPE_PUBLISHABLE_KEY is never
// committed — see .env.api and Spec-stripe-payment-checkout.md.
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}
