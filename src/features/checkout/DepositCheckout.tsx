import { useEffect, useState } from "react";
import { X, CheckCircle, AlertTriangle, Sparkles } from "lucide-react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { CartItem } from "../cart/CartContext";
import type { PaymentOption, RentalPlanResponse } from "../../app/types";
import type { SimulatedPayment } from "./payment";
import { CheckoutInputField } from "./CheckoutInputField";
import { mono, display, sans } from "../../lib/styles";
import { formatDateRange, daysBetweenISO } from "../../lib/dateFormat";
import { getStripe } from "../../app/stripe";
import { waitForBookingConfirmed } from "../../app/api";
import {
  savePendingDepositPayment,
  clearPendingDepositPayment,
} from "./pendingDepositPayment";
import stripeLogo from "../../assets/stripe.svg";
import {
  QuoteStaleError,
  type QuoteStalenessReason,
} from "./quoteStaleness";

// ─── DEPOSIT CHECKOUT ─────────────────────────────────────────────────────────

// Real-backend-only (MODE === "api", STRIPE_INTEGRATION_HANDOFF.md §5). Returned
// by onBeginPayment once the real booking + Stripe PaymentIntent both exist.
// amountDue is whichever amount the created intent actually charges — the booking's
// depositAmount for paymentOption "DEPOSIT", or its totalAmount for "FULL" (HR-213);
// the caller resolves that server-trusted figure, this component never recomputes it.
export interface ApiDepositPayment {
  bookingId: number;
  clientSecret: string;
  paymentIntentId: string;
  amountDue: number;
  paymentOption: PaymentOption;
}

// The real PaymentIntent id/amountDue from a completed API-mode payment,
// passed to onPaid so the parent doesn't have to recompute server-trusted values.
export interface ApiPaymentResult {
  bookingId: number;
  paymentIntentId: string;
  amountDue: number;
  paymentOption: PaymentOption;
}

function StripeDepositForm({
  amountDue,
  paymentOption,
  onSuccess,
  onFailure,
}: {
  amountDue: number;
  paymentOption: PaymentOption;
  onSuccess: (paymentIntentId: string) => void;
  onFailure: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  // Note: deliberately doesn't flip the parent's `step` to "processing" the way
  // the mock flow does — the PaymentElement iframe must stay mounted for the
  // duration of this call, and switching steps would unmount it mid-confirmation.
  const handleSubmit = async () => {
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    // `redirect: "if_required"` keeps most payment methods (incl. most 3DS
    // challenges) resolving in-page without ever navigating away — but some
    // payment methods/3DS flows require a real redirect regardless, and those
    // need somewhere to send the customer back to. return_url is this same SPA
    // route; CustomerPortal's resume-on-mount effect picks the flow back up from
    // the payment_intent_client_secret/redirect_status params Stripe appends here.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (error) {
      setSubmitting(false);
      onFailure(
        error.message ??
          "We couldn't process your payment. Please try again.",
      );
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    } else {
      setSubmitting(false);
      onFailure("Payment requires additional action. Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PaymentElement />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || submitting}
        className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50"
      >
        {submitting
          ? "Processing…"
          : paymentOption === "FULL"
            ? `Pay S$${amountDue.toLocaleString()} in Full`
            : `Pay S$${amountDue.toLocaleString()} Deposit`}
      </button>
    </div>
  );
}

export function DepositCheckout({
  cart,
  userName,
  paymentIntentId,
  onClose,
  onBeginPayment,
  onGetQuote,
  onPaid,
}: {
  cart: CartItem[];
  userName: string;
  paymentIntentId: string;
  onClose: () => void;
  // Real-backend-only (MODE === "api"): creates the real booking + Stripe
  // PaymentIntent when the user leaves the summary step. A no-op returning
  // null in mock mode, where booking creation still happens inside onPaid.
  // May reject with a QuoteStaleError (quote_not_ready/quote_expired) instead of a
  // plain Error — handled specially below via an explicit "price changed, please
  // confirm" step rather than the generic beginError surface. Calling this again
  // after the customer confirms takes the same happy-path branch, since the plan
  // is freshly QUOTED server-side by then.
  onBeginPayment: (paymentOption: PaymentOption) => Promise<ApiDepositPayment | null>;
  // Real-backend-only (MODE === "api"): fetches the authoritative quote for the
  // active RentalPlan purely so the summary can show a "smart priced" badge when
  // the returned dailyRate differs from the cart's client-side base-rate estimate
  // (specification/frontend-handoff.md §2) — the booking itself is still created
  // from client-side totals via onBeginPayment, unaffected by this call's result.
  // Omitted in mock mode, where there's no persisted RentalPlan/quote endpoint.
  onGetQuote?: () => Promise<RentalPlanResponse | null>;
  // paymentOption is always passed so the mock-mode call (which has no ApiPaymentResult
  // to read it from) still tells the parent which flow just completed.
  onPaid: (
    paymentOption: PaymentOption,
    result?: ApiPaymentResult,
  ) => Promise<void>;
}) {
  const isApiMode = import.meta.env.MODE === "api";
  const [apiPayment, setApiPayment] = useState<ApiDepositPayment | null>(null);
  // True from the moment Stripe reports success until this booking's status is either
  // confirmed off PENDING_DEPOSIT or the brief wait for that times out — see the
  // "confirming" overlay below and onSuccess's use of waitForBookingConfirmed.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [beginningPayment, setBeginningPayment] = useState(false);
  const [beginError, setBeginError] = useState<string | null>(null);
  const [quote, setQuote] = useState<RentalPlanResponse | null>(null);
  // Starts true whenever a quote will actually be fetched below, so the loading
  // indicator is correct on the very first render (no synchronous setState in the effect).
  const [quoteLoading, setQuoteLoading] = useState(
    () => isApiMode && !!onGetQuote,
  );

  // Fires once when the summary screen opens (API mode only) — pricing.dynamic-enabled
  // means this call may take noticeably longer than the near-instant arithmetic it used
  // to be (frontend-handoff.md §1), so it must not block "Continue to Payment": the badge
  // below just doesn't render until (or unless) it resolves.
  useEffect(() => {
    if (!isApiMode || !onGetQuote) return;
    let cancelled = false;
    onGetQuote()
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch(() => {
        // Non-fatal — the badge just doesn't show, same as "feature off" (frontend-handoff.md §2 caveats).
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quotedItem = (assetId: number) =>
    quote?.items.find((i) => i.assetId === assetId);
  // Per-item "smart priced" check: compares the quote's dailyRate against the cart's
  // own baseDailyRate for that asset (frontend-handoff.md §2's trick) — true only once
  // the quote has resolved and the two actually differ.
  const isSmartPriced = (assetId: number, baseDailyRate: number): boolean => {
    const quoted = quotedItem(assetId);
    return quoted !== undefined && quoted.dailyRate !== baseDailyRate;
  };
  // Once the quote resolves, the summary's dollar figures switch to the authoritative
  // quoted rate/total instead of the client-side base-rate estimate — otherwise the
  // "Smart Priced" badge above would sit next to numbers it contradicts. Falls back to
  // the client estimate while loading, if the quote failed, or outside API mode.
  const displayDailyRate = (assetId: number, baseDailyRate: number): number =>
    quotedItem(assetId)?.dailyRate ?? baseDailyRate;
  // Summed from the same per-item day×rate figures rendered in the "Reserved Equipment"
  // list above, rather than trusted directly off quote.totalAmount — the two can drift
  // out of sync (seen live: totalAmount came back as a single item's dailyRate instead
  // of dailyRate×days), which desyncs the Subtotal from the line item shown right above it.
  // Factored out so the same math can price a candidate re-quote (staleQuote below)
  // for the "price changed" preview, without duplicating the per-item fallback logic.
  const totalFromQuote = (q: RentalPlanResponse | null) =>
    cart.reduce((s, c) => {
      const rate =
        q?.items.find((i) => i.assetId === c.equipment.id)?.dailyRate ??
        c.equipment.baseDailyRate;
      return s + daysBetweenISO(c.startDate, c.endDate) * rate;
    }, 0);
  const displayTotal = totalFromQuote(quote);
  // Deposit stays the default/primary flow — "Pay in Full" (HR-213) is an opt-in
  // alternative that settles the whole Total Payable (subtotal + GST) in one shot.
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("DEPOSIT");
  const deposit = apiPayment
    ? apiPayment.paymentOption === "DEPOSIT"
      ? apiPayment.amountDue
      : Math.round(displayTotal * 0.3)
    : Math.round(displayTotal * 0.3);
  const amountDue =
    apiPayment && apiPayment.paymentOption === paymentOption
      ? apiPayment.amountDue
      : paymentOption === "FULL"
        ? Math.round(displayTotal * 1.09)
        : Math.round(displayTotal * 0.3);
  const [step, setStep] = useState<
    "summary" | "price_changed" | "payment" | "processing" | "failed"
  >("summary");
  // Set only when onBeginPayment rejects with a QuoteStaleError — a candidate re-quote
  // the customer hasn't confirmed yet. Never written into `quote` until they explicitly
  // confirm (handleConfirmStalePrice below), so the summary screen's displayed price
  // never silently changes out from under them.
  const [staleQuote, setStaleQuote] = useState<RentalPlanResponse | null>(
    null,
  );
  const [staleReason, setStaleReason] = useState<QuoteStalenessReason | null>(
    null,
  );
  const [card, setCard] = useState({
    number: "",
    name: userName,
    expiry: "",
    cvv: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState<"card" | "paynow">("card");
  const [payError, setPayError] = useState<string | null>(null);
  const [payment, setPayment] = useState<SimulatedPayment | null>(null);

  // API-mode only: create the real booking + PaymentIntent once, the first time
  // the user leaves the summary step (STRIPE_INTEGRATION_HANDOFF.md §4/§5 — the
  // backend has no server-side re-initiation guard yet, so this doubles as the
  // client-side guard against creating a second PaymentIntent for the same booking).
  // Shared by the initial "Continue to Payment" click and the post-confirm retry from
  // the "price changed" step — both just call onBeginPayment() again, since a confirmed
  // stale quote has already been re-quoted server-side by the time this re-runs.
  const attemptBeginPayment = async () => {
    setBeginError(null);
    setBeginningPayment(true);
    try {
      const result = await onBeginPayment(paymentOption);
      if (result) setApiPayment(result);
      setStaleQuote(null);
      setStaleReason(null);
      setStep("payment");
    } catch (err) {
      if (err instanceof QuoteStaleError) {
        setStaleQuote(err.refreshedQuote);
        setStaleReason(err.reason);
        setStep("price_changed");
      } else {
        setStep("summary");
        setBeginError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBeginningPayment(false);
    }
  };

  const handleContinue = async () => {
    if (!isApiMode || apiPayment) {
      setStep("payment");
      return;
    }
    await attemptBeginPayment();
  };

  // Syncs `quote` (the source of truth for Subtotal/GST/Total Payable/Balance Due
  // everywhere else in this component) to the confirmed re-quote BEFORE retrying, so by
  // the time the retry succeeds every displayed figure — not just the deposit — already
  // matches what's about to be charged.
  const handleConfirmStalePrice = async () => {
    if (!staleQuote) return;
    setQuote(staleQuote);
    await attemptBeginPayment();
  };

  const handleDeclineStalePrice = () => {
    setStaleQuote(null);
    setStaleReason(null);
    setStep("summary");
  };

  // Persists the moment a real PaymentIntent exists, not just on submit — a
  // redirect-based payment method can whisk the customer away before they even
  // finish filling in the PaymentElement, so this can't wait for handleSubmit.
  useEffect(() => {
    if (!isApiMode || !apiPayment) return;
    savePendingDepositPayment({
      bookingId: apiPayment.bookingId,
      paymentIntentId: apiPayment.paymentIntentId,
      clientSecret: apiPayment.clientSecret,
      amountDue: apiPayment.amountDue,
      paymentOption: apiPayment.paymentOption,
      cart,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPayment]);

  const fmtCard = (v: string) =>
    v
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  const fmtExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (payMethod === "card") {
      if (card.number.replace(/\s/g, "").length < 16)
        e.number = "Enter a valid 16-digit card number";
      if (!card.name.trim()) e.name = "Name on card is required";
      if (card.expiry.length < 5) e.expiry = "Enter expiry as MM/YY";
      if (card.cvv.length < 3) e.cvv = "Enter 3 or 4 digit CVV";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = () => {
    if (!validate()) return;
    setStep("processing");
    setPayError(null);

    // Simulated decline: a reserved test card number (mirrors Stripe's 4000...0002 test-decline
    // convention) lets anyone exercise the Screen 5 failure state without a real processor.
    const digits = card.number.replace(/\s/g, "");
    const simulatedPaymentType = paymentOption === "FULL" ? "FULL_PAYMENT" : "DEPOSIT";
    if (payMethod === "card" && digits === "4000000000000002") {
      setTimeout(() => {
        setPayment({
          amount: amountDue,
          paymentType: simulatedPaymentType,
          status: "FAIL",
          failureReason: "card_declined",
          paidAt: null,
          stripePaymentIntentId: paymentIntentId,
        });
        setStep("failed");
      }, 1800);
      return;
    }

    setTimeout(async () => {
      try {
        await onPaid(paymentOption);
        setPayment({
          amount: amountDue,
          paymentType: simulatedPaymentType,
          status: "SUCCESS",
          failureReason: null,
          paidAt: new Date().toISOString(),
          stripePaymentIntentId: paymentIntentId,
        });
      } catch (err) {
        setPayment({
          amount: amountDue,
          paymentType: simulatedPaymentType,
          status: "FAIL",
          failureReason: "processing_error",
          paidAt: null,
          stripePaymentIntentId: paymentIntentId,
        });
        setPayError(err instanceof Error ? err.message : String(err));
        setStep("failed");
      }
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="bg-card border border-border w-full sm:max-w-xl max-h-[95vh] overflow-y-auto"
        style={sans}
      >
        {/* Processing overlay */}
        {(step === "processing" || awaitingConfirmation) && (
          <div className="absolute inset-0 bg-card/95 z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-foreground">
              {awaitingConfirmation
                ? "Confirming your booking…"
                : paymentOption === "FULL"
                  ? "Processing your payment…"
                  : "Processing your deposit…"}
            </p>
            <p className="text-xs text-muted-foreground">
              Please do not close this window
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p
              className="text-xs text-primary font-semibold tracking-widest uppercase"
              style={mono}
            >
              {step === "summary" || step === "price_changed"
                ? "Step 1 of 2 · Review"
                : "Step 2 of 2 · Payment"}
            </p>
            <h2 className="text-2xl font-black text-foreground" style={display}>
              {step === "price_changed"
                ? "PRICE UPDATED"
                : step === "summary"
                  ? "BOOKING SUMMARY"
                  : paymentOption === "FULL"
                    ? "PAY IN FULL"
                    : "PAY DEPOSIT"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step 1 — Summary */}
        {step === "summary" && (
          <div className="p-6 flex flex-col gap-5">
            <div className="bg-secondary/30 border border-border">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
                  style={mono}
                >
                  Reserved Equipment
                </p>
                {quoteLoading && (
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-3 h-3 border-2 border-muted-foreground/40 border-t-transparent rounded-full animate-spin" />
                    Checking live pricing…
                  </span>
                )}
              </div>
              <div className="divide-y divide-border">
                {cart.map((c) => {
                  const days = daysBetweenISO(c.startDate, c.endDate);
                  const smartPriced = isSmartPriced(
                    c.equipment.id,
                    c.equipment.baseDailyRate,
                  );
                  return (
                    <div
                      key={c.equipment.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {c.equipment.name}
                          {smartPriced && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-primary border border-primary/30 bg-primary/10 px-1.5 py-0.5"
                              style={mono}
                              title="Priced by our live demand model, not the flat listed rate"
                            >
                              <Sparkles size={9} /> Smart Priced
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateRange(c.startDate, c.endDate)} · {days} day
                          {days > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p
                        className="text-sm font-bold text-foreground shrink-0"
                        style={mono}
                      >
                        S$
                        {(
                          days *
                          displayDailyRate(c.equipment.id, c.equipment.baseDailyRate)
                        ).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment option toggle — Deposit stays the default/primary choice; Pay in
                Full (HR-213) is a secondary, opt-in alternative, not an equal-weight CTA.
                Locked once a real booking + PaymentIntent already exist for the other
                option (apiPayment set) — onBeginPayment is deliberately never re-called
                for an already-converted plan/booking, so switching here after that point
                couldn't produce a matching intent anyway. */}
            <div>
              <p
                className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2"
                style={mono}
              >
                How would you like to pay?
              </p>
              <div className="flex gap-2">
                {(
                  [
                    ["DEPOSIT", "Deposit (30%)"],
                    ["FULL", "Pay in Full"],
                  ] as const
                ).map(([opt, label]) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={!!apiPayment && apiPayment.paymentOption !== opt}
                    onClick={() => setPaymentOption(opt)}
                    className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${paymentOption === opt ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost breakdown — GST is display-only, computed client-side, never sent to the API;
                deposit stays 30% of the pre-GST subtotal (Spec-ui-heavy-machinery-portal.md §4.4).
                Uses displayTotal (summed from the same per-item quoted rate/days shown in the
                Reserved Equipment list above) so these figures never contradict the Smart Priced
                badge above, or the line item the customer can see right above the breakdown. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground" style={mono}>
                  S${displayTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">GST (9%)</span>
                <span className="font-semibold text-foreground" style={mono}>
                  S${Math.round(displayTotal * 0.09).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pb-2 border-b border-border">
                <span className="text-foreground font-semibold">
                  Total Payable
                </span>
                <span className="font-semibold text-foreground" style={mono}>
                  S${Math.round(displayTotal * 1.09).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pb-2 border-b border-border">
                <span className="text-muted-foreground">
                  {paymentOption === "FULL"
                    ? "Balance due"
                    : "Balance due upon mobilisation/completion"}
                </span>
                <span className="font-semibold text-foreground" style={mono}>
                  S$
                  {paymentOption === "FULL"
                    ? "0"
                    : (Math.round(displayTotal * 1.09) - amountDue).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {paymentOption === "FULL" ? "Amount Due Now" : "Deposit Due Now"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {paymentOption === "FULL"
                      ? "Full Total Payable — settles the booking in one payment"
                      : "30% of subtotal (pre-GST) — holds your reservation"}
                  </p>
                </div>
                <p className="text-3xl font-black text-primary" style={display}>
                  S${amountDue.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 px-4 py-3 flex gap-3">
              <CheckCircle size={15} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {paymentOption === "FULL"
                  ? "Your equipment will be held exclusively for you once payment is confirmed. Paid in full — nothing more due."
                  : "Your equipment will be held exclusively for you once your deposit is confirmed. The remaining balance is due on the day of delivery."}
              </p>
            </div>

            {beginError && <p className="text-xs text-red-400">{beginError}</p>}
            <button
              onClick={handleContinue}
              disabled={beginningPayment}
              className="w-full py-3 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {beginningPayment ? "Creating booking…" : "Continue to Payment →"}
            </button>
          </div>
        )}

        {/* Step 1b — Price changed (quote_not_ready/quote_expired on conversion) */}
        {step === "price_changed" && (
          <div className="p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-primary" />
              </div>
              <div>
                <h3
                  className="text-lg font-black text-foreground leading-tight"
                  style={display}
                >
                  Price Updated
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {staleReason === "quote_expired"
                    ? "Your quote has expired — here's the current price."
                    : "We need to confirm current pricing for your rental plan before continuing."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 border border-border p-4 flex flex-col gap-1">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
                  style={mono}
                >
                  Previous
                </p>
                <p className="text-sm text-foreground" style={mono}>
                  Subtotal S${displayTotal.toLocaleString()}
                </p>
                <p className="text-lg font-bold text-foreground" style={mono}>
                  {paymentOption === "FULL" ? "Full Payment" : "Deposit"} S$
                  {amountDue.toLocaleString()}
                </p>
              </div>
              <div className="bg-primary/5 border border-primary/30 p-4 flex flex-col gap-1">
                <p
                  className="text-xs font-semibold text-primary tracking-widest uppercase"
                  style={mono}
                >
                  Updated
                </p>
                <p className="text-sm text-foreground" style={mono}>
                  Subtotal S${totalFromQuote(staleQuote).toLocaleString()}
                </p>
                <p className="text-lg font-bold text-primary" style={mono}>
                  {paymentOption === "FULL" ? "Full Payment" : "Deposit"} S$
                  {Math.round(
                    totalFromQuote(staleQuote) * (paymentOption === "FULL" ? 1.09 : 0.3),
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            {beginError && <p className="text-xs text-red-400">{beginError}</p>}
            <div className="flex gap-3 pt-2 border-t border-border">
              <button
                onClick={handleDeclineStalePrice}
                className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all"
              >
                ← Back to Summary
              </button>
              <button
                onClick={handleConfirmStalePrice}
                disabled={beginningPayment}
                className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50"
              >
                {beginningPayment
                  ? "Confirming…"
                  : "Confirm New Price & Continue"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Payment */}
        {step === "payment" && (
          <div className="p-6 flex flex-col gap-5">
            {/* Amount-to-pay badge */}
            <div className="flex items-center justify-between bg-secondary/40 border border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">Amount to pay now</p>
              <p className="text-2xl font-black text-primary" style={display}>
                S${amountDue.toLocaleString()}
              </p>
            </div>

            {isApiMode && apiPayment ? (
              <>
                <Elements
                  stripe={getStripe()}
                  options={{ clientSecret: apiPayment.clientSecret }}
                >
                  <StripeDepositForm
                    amountDue={amountDue}
                    paymentOption={apiPayment.paymentOption}
                    onSuccess={async (piId) => {
                      // Stripe confirming the charge only means Stripe accepted it — the
                      // backend's webhook still has to flip this booking's own status.
                      // Give it a brief head start (best-effort: a network hiccup here
                      // must not block the confirmation the customer already paid for)
                      // before trusting it, rather than showing "confirmed" the instant
                      // this promise settles.
                      setAwaitingConfirmation(true);
                      await waitForBookingConfirmed(apiPayment.bookingId).catch(
                        () => {},
                      );
                      clearPendingDepositPayment();
                      onPaid(apiPayment.paymentOption, {
                        bookingId: apiPayment.bookingId,
                        paymentIntentId: piId,
                        amountDue: apiPayment.amountDue,
                        paymentOption: apiPayment.paymentOption,
                      }).catch((err) => {
                        setAwaitingConfirmation(false);
                        setPayment({
                          amount: amountDue,
                          paymentType:
                            apiPayment.paymentOption === "FULL"
                              ? "FULL_PAYMENT"
                              : "DEPOSIT",
                          status: "FAIL",
                          failureReason: "processing_error",
                          paidAt: null,
                          stripePaymentIntentId: piId,
                        });
                        setPayError(
                          err instanceof Error ? err.message : String(err),
                        );
                        setStep("failed");
                      });
                    }}
                    onFailure={(message) => {
                      setPayment({
                        amount: amountDue,
                        paymentType:
                          apiPayment.paymentOption === "FULL"
                            ? "FULL_PAYMENT"
                            : "DEPOSIT",
                        status: "FAIL",
                        failureReason: message,
                        paidAt: null,
                        stripePaymentIntentId: apiPayment.paymentIntentId,
                      });
                      setStep("failed");
                    }}
                  />
                </Elements>
                <button
                  onClick={() => setStep("summary")}
                  className="w-full py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all"
                >
                  ← Back
                </button>
              </>
            ) : (
              <>
                {/* Payment method toggle */}
                <div>
                  <p
                    className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2"
                    style={mono}
                  >
                    Payment Method
                  </p>
                  <div className="flex gap-2">
                    {(
                      [
                        ["card", "Credit / Debit Card"],
                        ["paynow", "PayNow SG"],
                      ] as const
                    ).map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase border transition-all ${payMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {payMethod === "card" ? (
                  <div className="flex flex-col gap-4">
                    <CheckoutInputField
                      label="Card Number"
                      value={card.number}
                      onChange={(v) =>
                        setCard((p) => ({ ...p, number: fmtCard(v) }))
                      }
                      placeholder="1234 5678 9012 3456"
                      error={errors.number}
                    />
                    <CheckoutInputField
                      label="Name on Card"
                      value={card.name}
                      onChange={(v) => setCard((p) => ({ ...p, name: v }))}
                      placeholder={userName}
                      error={errors.name}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <CheckoutInputField
                        label="Expiry (MM/YY)"
                        value={card.expiry}
                        onChange={(v) =>
                          setCard((p) => ({ ...p, expiry: fmtExpiry(v) }))
                        }
                        placeholder="08/27"
                        maxLen={5}
                        error={errors.expiry}
                      />
                      <CheckoutInputField
                        label="CVV"
                        value={card.cvv}
                        onChange={(v) =>
                          setCard((p) => ({
                            ...p,
                            cvv: v.replace(/\D/g, "").slice(0, 4),
                          }))
                        }
                        placeholder="•••"
                        maxLen={4}
                        error={errors.cvv}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center flex-wrap gap-x-1.5 gap-y-1">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="shrink-0"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>
                        Your payment is encrypted and securely processed by
                      </span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <img
                          src={stripeLogo}
                          alt="Stripe"
                          className="h-3.5 w-auto align-middle"
                        />
                        .
                      </span>
                      <span>Card details are never stored on our servers.</span>
                    </p>
                  </div>
                ) : (
                  <div className="bg-secondary/30 border border-border p-4 flex flex-col items-center gap-3 text-center">
                    <p
                      className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
                      style={mono}
                    >
                      Scan with your banking app
                    </p>
                    <div className="w-36 h-36 bg-white flex items-center justify-center border border-border">
                      <svg
                        width="96"
                        height="96"
                        viewBox="0 0 96 96"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect width="96" height="96" fill="white" />
                        <rect x="6" y="6" width="24" height="24" fill="black" />
                        <rect x="66" y="6" width="24" height="24" fill="black" />
                        <rect x="6" y="66" width="24" height="24" fill="black" />
                        <rect x="42" y="6" width="12" height="12" fill="black" />
                        <rect x="42" y="42" width="12" height="12" fill="black" />
                        <rect x="66" y="42" width="12" height="12" fill="black" />
                        <rect x="42" y="78" width="12" height="12" fill="black" />
                        <rect x="78" y="78" width="12" height="12" fill="black" />
                      </svg>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Corporate UEN:{" "}
                      <span
                        className="text-foreground font-semibold"
                        style={mono}
                      >
                        201847362K
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border w-full">
                      Confirm once you've completed the transfer in your
                      banking app. Your reservation will be activated once
                      payment clears.
                    </p>
                  </div>
                )}

                {payError && <p className="text-xs text-red-400">{payError}</p>}
                <div className="flex gap-3 pt-2 border-t border-border">
                  <button
                    onClick={() => setStep("summary")}
                    className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handlePay}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all"
                  >
                    {payMethod === "card"
                      ? paymentOption === "FULL"
                        ? `Pay S$${amountDue.toLocaleString()} in Full`
                        : `Pay S$${amountDue.toLocaleString()} Deposit`
                      : "Confirm PayNow Payment"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2b — Payment Unsuccessful (Screen 5, simulated decline) */}
        {step === "failed" && payment && (
          <div className="p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3
                  className="text-lg font-black text-foreground leading-tight"
                  style={display}
                >
                  Payment Unsuccessful
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {payment.failureReason === "card_declined"
                    ? "Your card was declined. Please check your card details or try another payment method."
                    : "We couldn't process your payment. Please try again or use another payment method."}
                </p>
              </div>
            </div>

            <div className="bg-secondary/30 border border-border p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Attempted Amount
                </span>
                <span
                  className="text-xs font-semibold text-foreground"
                  style={mono}
                >
                  S${payment.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Payment Type
                </span>
                <span
                  className="text-xs font-semibold text-foreground"
                  style={mono}
                >
                  {payment.paymentType}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Failure Reason
                </span>
                <span
                  className="text-xs font-semibold text-red-400"
                  style={mono}
                >
                  {payment.failureReason}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Stripe Ref
                </span>
                <span
                  className="text-xs font-semibold text-foreground"
                  style={mono}
                  title={payment.stripePaymentIntentId}
                >
                  {payment.stripePaymentIntentId.slice(0, 8)}…
                  {payment.stripePaymentIntentId.slice(-4)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setStep("payment");
                  setPayment(null);
                }}
                className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
              >
                Retry Payment
              </button>
              {!isApiMode && (
                <button
                  onClick={() => {
                    setPayMethod("paynow");
                    setStep("payment");
                    setPayment(null);
                  }}
                  className="w-full py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all"
                >
                  Use Alternative Payment Method
                </button>
              )}
              <a
                href="mailto:support@heavyrental.com?subject=Payment%20issue"
                className="w-full py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all text-center"
              >
                Contact Support
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
