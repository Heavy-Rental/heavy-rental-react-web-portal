import { ShoppingCart, X, Trash2 } from "lucide-react";
import type { CartItem } from "../cart/CartContext";
import { mono, display } from "../../lib/styles";
import { formatDateRange, daysBetweenISO } from "../../lib/dateFormat";

// ─── CART DRAWER ────────────────────────────────────────────────────────────

export function CartDrawer({
  cart,
  onRemoveItem,
  siteAddress,
  onEditAddress,
  highlightAddAddress,
  totalCost,
  onCancelPlan,
  onCheckout,
  onClose,
}: {
  cart: CartItem[];
  onRemoveItem: (equipmentId: number) => void;
  siteAddress: string;
  onEditAddress: () => void;
  highlightAddAddress?: boolean;
  totalCost: number;
  // Present only in API mode once a plan exists — omitted in mock mode, where there's no
  // persisted RentalPlan to cancel (api-contract-for-frontend.md §5.5).
  onCancelPlan?: () => void;
  onCheckout: () => void;
  onClose: () => void;
}) {
  return (
    <div className="w-72 shrink-0 bg-card border border-border sticky top-20">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="font-black text-foreground text-lg" style={display}>
          RENTAL PLAN
        </p>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>
      {cart.length === 0 ? (
        <div className="p-6 text-center">
          <ShoppingCart
            size={28}
            className="text-muted-foreground mx-auto mb-3 opacity-40"
          />
          <p className="text-sm text-muted-foreground">
            No equipment selected yet.
          </p>
          {/* Recovery path for a plan left over from before an emptied plan was
              auto-cancelled on removal — onCancelPlan is only passed once a plan
              actually exists, so this can't show up for a customer with no plan at all. */}
          {onCancelPlan && (
            <button
              onClick={onCancelPlan}
              className="mt-4 text-xs text-muted-foreground hover:text-red-400 underline underline-offset-2 transition-colors"
            >
              Cancel rental plan
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border">
            {cart.map((c) => (
              <div key={c.equipment.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {c.equipment.name}
                  </p>
                  <button
                    onClick={() => onRemoveItem(c.equipment.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {formatDateRange(c.startDate, c.endDate)} ·{" "}
                  {daysBetweenISO(c.startDate, c.endDate)} days
                </p>
                <p className="text-sm font-bold text-primary" style={mono}>
                  S$
                  {(
                    daysBetweenISO(c.startDate, c.endDate) *
                    c.equipment.baseDailyRate
                  ).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Delivery site
              </span>
              <button
                type="button"
                onClick={onEditAddress}
                className={`text-xs text-primary hover:text-primary/80 underline underline-offset-2 px-1.5 py-0.5 ${highlightAddAddress ? "border border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.25)] animate-pulse rounded-sm" : ""}`}
              >
                {siteAddress ? "Edit" : "Add"}
              </button>
            </div>
            <p className="text-xs text-foreground mb-3 leading-relaxed">
              {siteAddress || "No delivery address set yet."}
            </p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                Total Estimate
              </span>
              <span className="text-xl font-black text-foreground" style={display}>
                S${totalCost.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
            >
              Proceed to Deposit
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              30% deposit required to hold your reservation.
            </p>
            {onCancelPlan && (
              <button
                onClick={onCancelPlan}
                className="w-full mt-3 text-xs text-muted-foreground hover:text-red-400 underline underline-offset-2 transition-colors"
              >
                Cancel rental plan
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
