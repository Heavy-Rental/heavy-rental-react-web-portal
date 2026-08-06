import { useState } from "react";
import { X } from "lucide-react";
import type { AssetRecord } from "../../../app/assetRecord";
import { formatCondition } from "../../../app/assetRecord";
import { mono, display, sans } from "../../../lib/styles";
import { CONDITIONS, DEPLOYMENT_META, type DeploymentStatus } from "../adminFormat";
import type { FleetAsset } from "../AdminDataContext";

export function FleetUpdateModal({
  asset,
  onClose,
  onSave,
}: {
  asset: FleetAsset;
  onClose: () => void;
  onSave: (id: number, patch: Partial<FleetAsset>) => void;
}) {
  const [status, setStatus] = useState<DeploymentStatus>(asset.deploymentStatus);
  const [site, setSite] = useState(asset.currentSite);
  const [booking, setBooking] = useState(asset.assignedBooking);
  const [customer, setCustomer] = useState(asset.assignedCustomer);
  const [notes, setNotes] = useState(asset.notes);
  const [condition, setCondition] = useState<AssetRecord["condition"]>(asset.condition);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="bg-card border border-border w-full sm:max-w-lg max-h-[95vh] overflow-y-auto"
        style={sans}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p className="text-xs text-red-400 font-semibold tracking-widest uppercase" style={mono}>
              Update Asset Status
            </p>
            <h2 className="text-xl font-black text-foreground leading-tight" style={display}>
              {asset.name}
            </h2>
            <p className="text-xs text-muted-foreground">SN: {asset.serialno}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>
              Deployment Status
            </p>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              'Booked' and 'In-Transit' track this asset's active booking (Booking.status =
              CONFIRMED / MOBILISED). Select 'Maintenance' to take it out of service regardless of
              booking state.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DEPLOYMENT_META) as DeploymentStatus[]).map((s) => {
                const m = DEPLOYMENT_META[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex items-start gap-3 p-3 border transition-all text-left ${status === s ? `${m.bg} ${m.border}` : "border-border bg-secondary/20 hover:border-primary/30"}`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${status === s ? m.dot : "bg-muted-foreground/30"}`}
                    />
                    <div>
                      <p className={`text-sm font-bold ${status === s ? m.color : "text-foreground"}`}>
                        {s}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Current Location / Site
            </label>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="e.g. Tuas Depot or 20 Jurong Port Rd, S(619094)"
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors"
            />
          </div>
          {status !== "Available" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Linked Booking</label>
                <input
                  value={booking}
                  onChange={(e) => setBooking(e.target.value)}
                  placeholder="RNT-XXXX"
                  className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors"
                  style={mono}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Customer</label>
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors"
                />
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2" style={mono}>
              Equipment Condition
            </p>
            <div className="flex gap-2 flex-wrap">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`px-3 py-1.5 text-xs font-bold border transition-all ${condition === c ? (c === "NEEDS_REPAIR" ? "bg-amber-500 text-black border-amber-500" : "bg-primary text-primary-foreground border-primary") : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  {formatCondition(c)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Status Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Describe current situation, any issues, or relevant context…"
              className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-red-400/60 transition-colors resize-none"
            />
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Updating condition sets <code>lastConditionUpdatedAt</code>. Saved for this session —
            resets when the mock server restarts.
          </p>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onSave(asset.id, {
                  deploymentStatus: status,
                  currentSite: site,
                  assignedBooking: booking,
                  assignedCustomer: customer,
                  notes,
                  condition,
                })
              }
              className="flex-1 py-2.5 bg-red-500 text-white text-xs font-black tracking-widest uppercase hover:bg-red-600 transition-all"
            >
              Save Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
