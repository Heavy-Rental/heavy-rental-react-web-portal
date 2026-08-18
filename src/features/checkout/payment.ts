// Client-local, shaped after the real Payment entity (SPEC-entity-repository.md) — never sent
// anywhere. Gives the simulated checkout success/failure UI a consistent, ERD-shaped structure.
export interface SimulatedPayment {
  amount: number;
  paymentType: "DEPOSIT" | "BALANCE" | "FULL_PAYMENT";
  status: "PENDING" | "SUCCESS" | "FAIL";
  failureReason: string | null;
  paidAt: string | null;
  // Shaped like a real Stripe PaymentIntent id (Payment.stripe_payment_intent_id,
  // SPEC-entity-repository.md) so the UI has somewhere real to put it once a live
  // backend actually creates PaymentIntents — never sent anywhere today.
  stripePaymentIntentId: string;
}

// Client-side-only stand-in for a real Stripe PaymentIntent id (pi_xxx). Once a real
// backend integration exists, this is the exact value swapped for the id returned by
// POST /api/v1/payments/create-intent.
export function generateFakePaymentIntentId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `pi_${hex}`;
}
