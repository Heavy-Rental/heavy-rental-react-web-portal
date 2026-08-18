import { ChevronLeft, User, LogOut } from "lucide-react";
import type { RentalPlan } from "./rentalPlan";
import { mono, display, sans } from "../../lib/styles";
import { formatDateRange } from "../../lib/dateFormat";

// ─── RENTAL PLAN / INVOICE DETAIL PAGE ──────────────────────────────────────

export function RentalPlanDetail({
  plan,
  userName,
  onHome,
  onBack,
  onLogout,
}: {
  plan: RentalPlan;
  userName: string;
  onHome: () => void;
  onBack: () => void;
  onLogout: () => void;
}) {
  const navBar = (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
        <button
          onClick={onHome}
          className="text-xl font-black text-primary hover:opacity-80 transition-opacity"
          style={display}
        >
          HEAVY<span className="text-foreground"> RENTAL</span>
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div className="w-6 h-6 bg-primary/20 border border-primary/40 flex items-center justify-center">
              <User size={12} className="text-primary" />
            </div>
            <span>{userName}</span>
            <span
              className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10"
              style={mono}
            >
              CUSTOMER
            </span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {navBar}
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group"
        >
          <ChevronLeft
            size={14}
            className="group-hover:-translate-x-0.5 transition-transform"
          />{" "}
          Back to Profile
        </button>

        {/* Invoice header */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <p
              className="text-xs text-primary font-semibold tracking-widest uppercase mb-2"
              style={mono}
            >
              Rental Plan
            </p>
            <h1
              className="text-4xl font-black text-foreground leading-none mb-2"
              style={display}
            >
              {plan.id}
            </h1>
            <p className="text-sm text-muted-foreground">
              Issued to{" "}
              <span className="text-foreground font-semibold">
                {userName}
              </span>{" "}
              · Paid on {plan.paidAt}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`inline-block px-3 py-1 text-xs font-bold tracking-widest uppercase border mb-3 ${plan.status === "Active" ? "bg-primary/10 text-primary border-primary/30" : "bg-green-500/10 text-green-400 border-green-500/20"}`}
            >
              {plan.status}
            </span>
            <p className="text-xs text-muted-foreground">Invoice Total</p>
            <p className="text-3xl font-black text-foreground" style={display}>
              S${plan.totalCost.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-8" />

        {/* Bill To / Plan Info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border p-5">
            <p
              className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3"
              style={mono}
            >
              Bill To
            </p>
            <p className="font-bold text-foreground">{userName}</p>
            <p className="text-sm text-muted-foreground">
              customer@heavyrental.com
            </p>
            <p className="text-sm text-muted-foreground">
              Apex Construction Pte Ltd
            </p>
            <p className="text-sm text-muted-foreground">
              1 Jurong Port Rd, Singapore 619096
            </p>
          </div>
          <div className="bg-card border border-border p-5">
            <p
              className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3"
              style={mono}
            >
              Plan Details
            </p>
            <div className="space-y-1.5">
              {[
                { label: "Plan No.", value: plan.id },
                { label: "Date Issued", value: plan.paidAt },
                {
                  label: "Equipment",
                  value: `${plan.items.length} unit${plan.items.length !== 1 ? "s" : ""}`,
                },
                {
                  label: "Total Days",
                  value: `${plan.items.reduce((s, i) => s + i.days, 0)} days`,
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold text-foreground" style={mono}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Line items table */}
        <div className="border border-border mb-6">
          <div className="grid grid-cols-12 bg-muted/60 border-b border-border px-5 py-3">
            <p
              className="col-span-5 text-xs font-semibold text-muted-foreground uppercase tracking-widest"
              style={mono}
            >
              Equipment
            </p>
            <p
              className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center"
              style={mono}
            >
              Days
            </p>
            <p
              className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest text-right"
              style={mono}
            >
              Unit Price
            </p>
            <p
              className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest text-right"
              style={mono}
            >
              Amount
            </p>
          </div>
          {plan.items.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 px-5 py-4 border-b border-border/40 last:border-0 items-center bg-card"
            >
              <div className="col-span-5">
                <p className="font-semibold text-foreground">
                  {item.equipmentName}
                </p>
                <p className="text-xs text-primary mt-0.5" style={mono}>
                  {item.category}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateRange(item.startDate, item.endDate)}
                </p>
              </div>
              <p className="col-span-2 text-sm text-foreground text-center font-medium">
                {item.days}
              </p>
              <p className="col-span-3 text-sm text-foreground text-right">
                S${item.dailyRate.toLocaleString()}
                <span className="text-xs text-muted-foreground">/day</span>
              </p>
              <p
                className="col-span-2 text-base font-black text-foreground text-right"
                style={display}
              >
                S${(item.dailyRate * item.days).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Payment summary */}
        <div className="flex justify-end mb-8">
          <div className="w-full max-w-sm border border-border bg-card">
            <div className="px-5 py-4 space-y-2.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>S${plan.totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-400">Deposit Paid (30%)</span>
                <span className="text-green-400 font-semibold">
                  − ${plan.depositPaid.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-sm font-bold text-foreground">
                  Balance Due on Delivery
                </span>
                <span className="text-lg font-black text-foreground" style={display}>
                  S${plan.balanceDue.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="px-5 py-3 bg-muted/30 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                The remaining balance is due on the day of delivery. Equipment
                will be held exclusively once the deposit is confirmed.
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="border-t border-border pt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            HEAVY RENTAL PTE LTD · 1 Jurong Port Rd, Singapore 619096 ·
            support@heavyrental.com
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 border border-border text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            Back to Profile
          </button>
        </div>
      </div>
    </div>
  );
}
