import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { mono, display, sans } from "../../lib/styles";
import { extractPostalCode, isSingaporePostal, lookupSingaporePostal } from "../../lib/sgPostal";
import { ApiError, postalCodeApi } from "../../app/api";

// ─── SITE ADDRESS MODAL ─────────────────────────────────────────────────────────
// Captured once per cart — maps to Booking.siteAddress/sitePostalCode/deliveryNotes.
// Postal code: use a 6-digit code already in the address, otherwise look it up
// from OneMap as the user types a Singapore street address. In API mode, once a
// 6-digit code is in hand (typed or OneMap-found), it's also confirmed against the
// real backend (specification/features/postal-code-validation.md) before Save is
// allowed — OneMap's own result is a plausible-address autofill, not proof the code
// is real; the backend call is the authoritative check.

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
  const isApiMode = import.meta.env.MODE === "api";
  // Whether this modal opened with an address already saved (e.g. the "always reopen
  // to re-confirm" checkout gate) — drives the Save/Confirm button label below. Tied to
  // the initial `address` prop, not the live-edited `form.address`, so the label doesn't
  // flip mid-edit just because the user hasn't cleared the field yet.
  const hadExistingAddress = address.trim().length > 0;
  const [form, setForm] = useState({ address, notes });
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{
    query: string;
    postal: string;
    status: "loading" | "found" | "miss";
  } | null>(null);
  const [validation, setValidation] = useState<{
    postalCode: string;
    status: "checking" | "valid" | "invalid" | "unavailable";
    message?: string;
  } | null>(null);

  const query = form.address.trim();
  const typedPostal = extractPostalCode(form.address);
  const lookupMatches = lookup !== null && lookup.query === query;
  const postalCode = typedPostal || (lookupMatches ? lookup.postal : "");
  const lookupStatus: "idle" | "loading" | "found" | "miss" = typedPostal
    ? "idle"
    : query.length < 6
      ? "idle"
      : lookupMatches
        ? lookup.status
        : "loading";

  useEffect(() => {
    if (typedPostal || query.length < 6) return;
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setLookup({ query, postal: "", status: "loading" });
      void lookupSingaporePostal(query, ac.signal)
        .then((found) => {
          if (ac.signal.aborted) return;
          setLookup({
            query,
            postal: found ?? "",
            status: found ? "found" : "miss",
          });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (ac.signal.aborted) return;
          setLookup({ query, postal: "", status: "miss" });
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [query, typedPostal]);

  // API mode only: once a 6-digit postal code is in hand (typed or OneMap-found),
  // confirm it against the real backend before Save is allowed. Mirrors the OneMap
  // effect above (debounce + AbortController + cleanup), keyed off the derived
  // postalCode rather than a user-typed field, since the postal-code input itself
  // is read-only/derived — there's no literal "blur" to hang this off.
  useEffect(() => {
    if (!isApiMode || !isSingaporePostal(postalCode)) return;
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setValidation({ postalCode, status: "checking" });
      void postalCodeApi
        .lookup(postalCode, ac.signal)
        .then((res) => {
          if (ac.signal.aborted) return;
          setValidation({
            postalCode,
            status: res.status === "VALID" ? "valid" : "invalid",
            message: res.message,
          });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (ac.signal.aborted) return;
          if (err instanceof ApiError && err.code === "bad_request") {
            setValidation({ postalCode, status: "invalid", message: err.message });
          } else {
            // Network failure or the lookup service's own 503 — don't hard-block
            // Save on this (specification/features/postal-code-validation.md).
            setValidation({ postalCode, status: "unavailable" });
          }
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [isApiMode, postalCode]);

  const postalResolved =
    validation !== null && validation.postalCode === postalCode && validation.status !== "checking";
  // Covers two distinct async phases: OneMap still resolving a postal code from the typed
  // address (lookupStatus "loading" — postalCode is still "" at this point, so the backend
  // check below never even starts yet), and the backend still confirming a resolved code.
  // Bug found in manual testing: without the lookupStatus check, clicking Save/Confirm while
  // OneMap was still mid-lookup went through with an empty postalCode and got wrongly
  // rejected as "no postal code found" instead of just staying disabled a moment longer.
  const postalChecking =
    isApiMode &&
    (lookupStatus === "loading" || (isSingaporePostal(postalCode) && !postalResolved));

  const handleSave = () => {
    if (!form.address.trim()) {
      setError("Site address is required.");
      return;
    }
    if (isApiMode) {
      if (!isSingaporePostal(postalCode)) {
        setError(
          "Couldn't find a Singapore postal code for this address. Try a more specific street or building, or include the 6-digit postal code.",
        );
        return;
      }
      if (validation?.postalCode === postalCode && validation.status === "invalid") {
        setError(
          validation.message ?? "This postal code doesn't look right — check the address.",
        );
        return;
      }
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
                  : "e.g. 619094"
              }
              className="w-full bg-secondary/30 border border-border px-3 py-2.5 text-sm text-muted-foreground placeholder-muted-foreground outline-none cursor-not-allowed"
            />
            {postalChecking && (
              <p className="text-xs text-muted-foreground mt-1">
                Verifying postal code…
              </p>
            )}
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
              disabled={postalChecking}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
            >
              {postalChecking
                ? "Verifying…"
                : hadExistingAddress
                  ? "Confirm Address"
                  : "Save Address"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
