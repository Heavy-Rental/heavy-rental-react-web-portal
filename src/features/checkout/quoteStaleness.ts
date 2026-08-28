import type { RentalPlanResponse } from "../../app/types";

export type QuoteStalenessReason = "quote_not_ready" | "quote_expired";

export function isQuoteStaleCode(code: string): code is QuoteStalenessReason {
  return code === "quote_not_ready" || code === "quote_expired";
}

// Thrown by onBeginPayment (CustomerPortal.tsx) instead of resolving, when the backend
// rejects createBookingFromPlan with 409 quote_not_ready/quote_expired. Carries the
// already-re-quoted RentalPlanResponse so DepositCheckout can show old-vs-new price
// without a second round trip. DepositCheckout catches this via `instanceof`.
export class QuoteStaleError extends Error {
  constructor(
    public readonly refreshedQuote: RentalPlanResponse,
    public readonly reason: QuoteStalenessReason,
  ) {
    super(
      reason === "quote_expired"
        ? "Your quote has expired — here's the current price."
        : "We need to confirm current pricing for your rental plan before continuing.",
    );
    this.name = "QuoteStaleError";
  }
}
