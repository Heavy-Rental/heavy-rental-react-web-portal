import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { mono, display, sans } from "../../lib/styles";
import {
  extractPostalCode,
  isSingaporePostal,
  lookupSingaporePostal,
} from "../../lib/sgPostal";

// ─── SITE ADDRESS MODAL ─────────────────────────────────────────────────────────
// Captured once per cart — maps to Booking.siteAddress/sitePostalCode/deliveryNotes.
// Postal code: use a 6-digit code already in the address, otherwise look it up
// from OneMap as the user types a Singapore street address.

export function SiteAddressModal({
  address,
  notes,
  onClose,
  onSave,
}: {
  address: string;
  notes: string;
  onClose: () => void;
  onSave: (address: string, postalCode: string, notes: string) => void;
}) {
  const [form, setForm] = useState({ address, notes });
  const [error, setError] = useState<string | null>(null);
  const [lookedUpPostal, setLookedUpPostal] = useState("");
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "found" | "miss"
  >("idle");

  const typedPostal = extractPostalCode(form.address);
  const postalCode = typedPostal || lookedUpPostal;

  useEffect(() => {
    if (typedPostal) {
      setLookedUpPostal("");
      setLookupStatus("idle");
      return;
    }
    const q = form.address.trim();
    if (q.length < 6) {
      setLookedUpPostal("");
      setLookupStatus("idle");
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setLookupStatus("loading");
      void lookupSingaporePostal(q, ac.signal)
        .then((found) => {
          if (ac.signal.aborted) return;
          setLookedUpPostal(found ?? "");
          setLookupStatus(found ? "found" : "miss");
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (ac.signal.aborted) return;
          setLookedUpPostal("");
          setLookupStatus("miss");
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [form.address, typedPostal]);

  const handleSave = () => {
    if (!form.address.trim()) {
      setError("Site address is required.");
      return;
    }
    if (!isSingaporePostal(postalCode)) {
      setError(
        "Couldn't find a Singapore postal code for this address. Try a more specific street or building, or include the 6-digit postal code.",
      );
      return;
    }
    setError(null);
    onSave(form.address.trim(), postalCode, form.notes.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="bg-card border border-border w-full sm:max-w-md"
        style={sans}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p
              className="text-xs text-primary font-semibold tracking-widest uppercase mb-0.5"
              style={mono}
            >
              Delivery Details
            </p>
            <h2 className="text-xl font-black text-foreground" style={display}>
              SITE ADDRESS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground -mt-1">
            Where should this booking's equipment be delivered? One address
            covers the whole booking. Type a Singapore street or building —
            we'll look up the postal code.
          </p>
          <div>
            <label
              htmlFor="site-address"
              className="text-xs text-muted-foreground mb-1.5 block"
            >
              Address<span className="text-primary ml-0.5">*</span>
            </label>
            <input
              id="site-address"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              placeholder="e.g. 20 Jurong Port Road"
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="site-postal"
              className="text-xs text-muted-foreground mb-1.5 block"
            >
              Postal Code{" "}
              <span className="normal-case font-normal text-muted-foreground/60">
                {typedPostal
                  ? "(from address)"
                  : lookupStatus === "loading"
                    ? "(looking up…)"
                    : lookupStatus === "found"
                      ? "(from Singapore OneMap)"
                      : "(auto-detected from address)"}
              </span>
            </label>
            <input
              id="site-postal"
              value={postalCode}
              readOnly
              placeholder={
                lookupStatus === "loading"
                  ? "Looking up postal code…"
                  : lookupStatus === "miss"
                    ? "No match — try a more specific address"
                    : "Appears after you type a Singapore address"
              }
              className="w-full bg-secondary/30 border border-border px-3 py-2.5 text-sm text-muted-foreground placeholder-muted-foreground outline-none cursor-not-allowed"
              style={mono}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Delivery Notes{" "}
              <span className="normal-case font-normal text-muted-foreground/60">
                (optional)
              </span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              placeholder="Gate code, site contact, unloading instructions…"
              className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all"
            >
              Skip for now
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
            >
              Save Address
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
