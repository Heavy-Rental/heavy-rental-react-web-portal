import { CheckCircle } from "lucide-react";
import type { CartItem } from "../cart/CartContext";
import type { PaymentOption } from "../../app/types";
import { mono, display, sans } from "../../lib/styles";
import { formatDateRange, daysBetweenISO } from "../../lib/dateFormat";

// ─── BOOKING CONFIRMATION SCREEN ────────────────────────────────────────────

export function ConfirmationScreen({
  confirmedOrder,
  reservationId,
  paymentIntentId,
  userName,
  onBrowseMore,
}: {
  confirmedOrder: {
    items: CartItem[];
    totalCost: number;
    depositPaid: number;
    paymentOption: PaymentOption;
  };
  reservationId: string;
  paymentIntentId: string;
  userName: string;
  onBrowseMore: () => void;
}) {
  const {
    items: confirmedItems,
    totalCost: confirmedTotal,
    depositPaid,
    paymentOption,
  } = confirmedOrder;
  const isFullPayment = paymentOption === "FULL";
  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-6"
      style={sans}
    >
      <div className="max-w-lg w-full">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <p
            className="text-xs text-green-400 font-semibold tracking-widest uppercase mb-2"
            style={mono}
          >
            {isFullPayment
              ? "Payment Received · Equipment Held"
              : "Deposit Received · Equipment Held"}
          </p>
          <h2
            className="text-5xl font-black text-foreground leading-none mb-2"
            style={display}
          >
            RESERVATION CONFIRMED!
          </h2>
          <p className="text-muted-foreground text-sm">
            Thank you, {userName.split(" ")[0]}. Your equipment has been
            reserved and is held exclusively for you.
          </p>
        </div>

        {/* Reservation card */}
        <div className="bg-card border border-primary/30 mb-4">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-primary/5">
            <p
              className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
              style={mono}
            >
              Reservation ID
            </p>
            <p className="text-lg font-black text-primary" style={mono}>
              {reservationId}
            </p>
          </div>
          <div className="divide-y divide-border">
            {confirmedItems.map((c) => {
              const days = daysBetweenISO(c.startDate, c.endDate);
              const cost = days * c.equipment.baseDailyRate;
              return (
                <div
                  key={c.equipment.id}
                  className="px-5 py-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {c.equipment.name}
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
                    S${cost.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-border bg-secondary/20 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Rental Cost</span>
              <span className="font-semibold text-foreground" style={mono}>
                S${confirmedTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-400 font-semibold">
                {isFullPayment ? "Paid in Full" : "Deposit Paid (30%)"}
              </span>
              <span className="font-black text-green-400" style={mono}>
                −S${depositPaid.toLocaleString()}
              </span>
            </div>
            {!isFullPayment && (
              <div className="flex items-center justify-between text-sm pt-1.5 border-t border-border">
                <span className="text-muted-foreground">
                  Balance Due on Delivery
                </span>
                <span
                  className="font-black text-foreground text-lg"
                  style={display}
                >
                  S${(confirmedTotal - depositPaid).toLocaleString()}
                </span>
              </div>
            )}
            {paymentIntentId && (
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
                <span className="text-muted-foreground">Payment Ref</span>
                <span
                  className="text-muted-foreground"
                  style={mono}
                  title={paymentIntentId}
                >
                  {paymentIntentId.slice(0, 8)}…{paymentIntentId.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* What's next */}
        <div className="bg-card border border-border p-5 mb-6">
          <p
            className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3"
            style={mono}
          >
            What happens next
          </p>
          <div className="flex flex-col gap-3">
            {[
              {
                step: "01",
                text: "Confirmation email sent to your registered address with full booking details.",
              },
              {
                step: "02",
                text: "Our logistics team will contact you within 2 hours to arrange delivery.",
              },
              ...(isFullPayment
                ? []
                : [
                    {
                      step: "03",
                      text: "Remaining balance collected on equipment delivery. Cash, card, or bank transfer accepted.",
                    },
                  ]),
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3">
                <span
                  className="text-xs font-black text-primary shrink-0 mt-0.5"
                  style={mono}
                >
                  {step}
                </span>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onBrowseMore}
          className="w-full py-3 bg-primary text-primary-foreground font-bold text-sm tracking-widest uppercase hover:brightness-110 transition-all"
        >
          Browse More Equipment
        </button>
      </div>
    </div>
  );
}
