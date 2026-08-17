import { useState, useMemo, useEffect } from "react";
import { User, Upload, ShoppingCart, LogOut, CheckCircle, X } from "lucide-react";
import { CustomerOnboarding } from "../browse/CustomerOnboarding";
import { equipmentImageSrc } from "../browse/equipmentImageSrc";
import type { Asset as EquipmentItem, OnboardingMode } from "../../app/types";
import {
  assetApi,
  depotApi,
  rentalPlanApi,
  rentalPlanCartApi,
  bookingApi,
  calcDeposit,
  calcFullPaymentDueDate,
  createBookingFromPlan,
  paymentApi,
} from "../../app/api";
import { useApiResource } from "../../app/useApiResource";
import { mono, display, sans } from "../../lib/styles";
import {
  daysBetweenISO,
  formatDateRange,
  parseISODate,
  type QuoteDateRange,
} from "../../lib/dateFormat";
import { DateRangeBar } from "../../components/DateRangeBar";
import {
  buildQuoteCartItems,
  shouldPromptDeliveryDetails,
  toggleEquipmentInPlan,
} from "../checkout/specsPlan";
import {
  useCart,
  cartDateRange,
  resolveCartDepotId,
  cartFromRentalPlan,
  findActiveRentalPlan,
  type CartItem,
} from "../cart/CartContext";
import { Chatbot } from "../browse/Chatbot";
import { EquipmentGrid } from "../browse/EquipmentGrid";
import { SiteAddressModal } from "../checkout/SiteAddressModal";
import { generateFakePaymentIntentId } from "../checkout/payment";
import { DepositCheckout } from "../checkout/DepositCheckout";
import { CartDrawer } from "../checkout/CartDrawer";
import { ConfirmationScreen } from "../checkout/ConfirmationScreen";
import { buildRentalPlanViews, type RentalPlan } from "../checkout/rentalPlan";
import { RentalPlanDetail } from "../checkout/RentalPlanDetail";
import { CustomerProfilePage } from "./CustomerProfilePage";
import { EquipmentDetailPage } from "./EquipmentDetailPage";

export function CustomerPortal({
  userName,
  userId,
  onLogout,
}: {
  userName: string;
  userId: number | null;
  onLogout: () => void;
}) {
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>(null);
  const [specsRecs, setSpecsRecs] = useState<EquipmentItem[]>([]);
  // Equipment queued from "Add All to Rental Plan" waiting on the shared date bar — auto-added
  // to the cart the moment both dates are picked (see the effect below); highlights the bar
  // in the meantime so it's obvious what the user still needs to do.
  const [pendingAutoAdd, setPendingAutoAdd] = useState<EquipmentItem[] | null>(
    null,
  );
  // A single item queued from a card's "Select" button, waiting on the site-address
  // modal the same way pendingAutoAdd waits for it above — see the retry effect below.
  const [pendingCartItem, setPendingCartItem] = useState<CartItem | null>(
    null,
  );
  const { cart, setCart, cartOpen, setCartOpen } = useCart();
  const isApiMode = import.meta.env.MODE === "api";
  // API mode only: the persisted RentalPlan backing `cart`, and a lookup from
  // assetId → RentalPlanItem id (needed for DELETE .../items/{itemId}, which the
  // real backend keys by item id, not asset id). Mock mode never touches these.
  const [planId, setPlanId] = useState<number | null>(null);
  const [planItemIds, setPlanItemIds] = useState<Record<number, number>>({});
  const [activeFilter, setActiveFilter] = useState("All");
  const [detailItem, setDetailItem] = useState<EquipmentItem | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: userName,
    email: "customer@heavyrental.com",
    phone: "+65 9123 4567",
    company: "Apex Construction Pte Ltd",
  });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reservationId, setReservationId] = useState("");
  // Snapshot of the cart at the moment payment succeeds — the confirmation screen must render
  // from this, not live `cart`, since `cart` is cleared in the same state batch as `confirmed`
  // (otherwise the confirmation screen would render against an already-empty cart).
  const [confirmedOrder, setConfirmedOrder] = useState<{
    items: CartItem[];
    totalCost: number;
    depositPaid: number;
  } | null>(null);
  // Simulated Stripe PaymentIntent id — minted client-side per checkout attempt so both the
  // DepositCheckout failure screen and the confirmation screen can reference the same id.
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<RentalPlan | null>(null);

  // Shared date-range bar (Spec-frontend-ui-changes.md Screen 6) — every cart item is
  // selected against this one range, instead of each machine picking its own dates.
  const today = new Date();
  const [sharedMonth, setSharedMonth] = useState(today.getMonth());
  const [sharedYear, setSharedYear] = useState(today.getFullYear());
  const [sharedStartDate, setSharedStartDate] = useState<string | null>(null);
  const [sharedEndDate, setSharedEndDate] = useState<string | null>(null);
  const [dateBarOpen, setDateBarOpen] = useState(false);
  const [cartDateError, setCartDateError] = useState<string | null>(null);

  // Site address capture (Spec-frontend-ui-changes.md Screen 6) — collected once per cart,
  // maps to Booking.siteAddress/sitePostalCode/deliveryNotes.
  const [siteAddress, setSiteAddress] = useState("");
  const [sitePostalCode, setSitePostalCode] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [siteAddressModalOpen, setSiteAddressModalOpen] = useState(false);
  const [siteAddressPrompted, setSiteAddressPrompted] = useState(false);

  const equipmentRes = useApiResource(
    (signal) => assetApi.list(sharedStartDate && sharedEndDate ? { startDate: sharedStartDate, endDate: sharedEndDate } : undefined, signal),
    [sharedStartDate, sharedEndDate],
  );
  const equipment = useMemo(() => equipmentRes.data ?? [], [equipmentRes.data]);
  const depotsRes = useApiResource((signal) => depotApi.list(signal));
  const depots = depotsRes.data ?? [];
  const rentalPlansRes = useApiResource((signal) => rentalPlanApi.list(signal));
  const rentalPlans = useMemo(
    () =>
      rentalPlansRes.status === "success" && userId !== null
        ? buildRentalPlanViews(rentalPlansRes.data, equipment, userId)
        : [],
    [rentalPlansRes.status, rentalPlansRes.data, equipment, userId],
  );

  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [specUploadOpen, setSpecUploadOpen] = useState(false);

  // API mode only: hydrate the cart from the customer's persisted RentalPlan on mount
  // (Spec-rental-plan-cart-checkout.md — fixes the cart being lost on reload/navigation,
  // since it now lives server-side, not in this component's local state). Waits on the
  // catalog since RentalPlanItem only carries assetId — resolving it to a display-ready
  // CartItem needs the already-fetched Equipment record.
  useEffect(() => {
    if (!isApiMode || equipmentRes.status !== "success") return;
    let cancelled = false;
    rentalPlanCartApi
      .list()
      .then((plans) => {
        if (cancelled) return;
        const active = findActiveRentalPlan(plans);
        if (!active) return;
        const { cart: hydrated, itemIds } = cartFromRentalPlan(
          active,
          equipmentRes.data,
        );
        setCart(hydrated);
        setPlanItemIds(itemIds);
        setPlanId(active.id);
      })
      .catch(() => {
        // Non-fatal — the cart just starts empty, same as a customer with no plan yet.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiMode, equipmentRes.status]);

  // API mode only: ensures a RentalPlan exists for the given date range, reusing the
  // caller's one active (non-CONVERTED, non-CANCELLED) plan if it already matches (B9 — no server-side
  // filter, so this always fetches the list and filters client-side; the backend itself
  // 409s a second create() while one exists, so checking first also avoids that). Returns
  // null (and sets cartDateError) if an active plan exists with a *different* range — the
  // plan's date range is fixed at creation (B11), so that's a real conflict, not a stale read.
  const ensureApiRentalPlanId = async (
    startDate: string,
    endDate: string,
  ): Promise<number | null> => {
    if (planId !== null) return planId;
    const plans = await rentalPlanCartApi.list();
    const active = findActiveRentalPlan(plans);
    if (active) {
      if (active.startDate !== startDate || active.endDate !== endDate) {
        setCartDateError(
          `Your active rental plan is already set for ${formatDateRange(active.startDate, active.endDate)}. Remove all items first to change dates.`,
        );
        return null;
      }
      return active.id;
    }
    // siteAddress is required to create a plan (RentalPlanCreateRequest.siteAddress is
    // @NotBlank + must end in a 6-digit postal code) — block and prompt for it rather
    // than sending a blank value the server would reject as validation_failed.
    if (!siteAddress.trim()) {
      setSiteAddressModalOpen(true);
      setCartDateError(
        "Add a delivery address before adding equipment to your rental plan.",
      );
      return null;
    }
    // The user only ever types/sees the plain street address (e.g. "20 Jurong Port
    // Road") — sitePostalCode is resolved separately (typed inline or via OneMap
    // lookup, see SiteAddressModal) and appended here so the combined string still
    // satisfies the backend constraint above, without forcing the user to type it.
    const resolvedSiteAddress =
      sitePostalCode && !siteAddress.includes(sitePostalCode)
        ? `${siteAddress}, ${sitePostalCode}`
        : siteAddress;
    const created = await rentalPlanCartApi.create({
      startDate,
      endDate,
      siteAddress: resolvedSiteAddress,
    });
    return created.id;
  };

  // Auto-add AI-recommended equipment ("Add All to Rental Plan") to the cart the moment both
  // shared dates are available. Wraps setSharedEndDate (the only setter that can complete a
  // range) so the flush happens synchronously in the same click that finalizes the end date,
  // rather than reactively in a useEffect (React discourages calling setState from effects to
  // sync internal state — https://react.dev/learn/you-might-not-need-an-effect). Declared above
  // every early return so it's always available; it only touches useState setters (never
  // addToCart, defined further down), so it's safe to construct from any render path.
  const handleSharedEndDateSelected = (d: string | null) => {
    setSharedEndDate(d);
    if (!d || !sharedStartDate || !pendingAutoAdd) return;
    const startDate = sharedStartDate,
      endDate = d;
    const toAdd = pendingAutoAdd;
    setCartOpen(true);
    setCartDateError(null);
    if (!siteAddressPrompted) {
      setSiteAddressPrompted(true);
      setSiteAddressModalOpen(true);
    }
    if (!isApiMode) {
      setPendingAutoAdd(null);
      setCart((prev) => {
        const merged = [...prev];
        for (const eq of toAdd) {
          const idx = merged.findIndex((c) => c.equipment.id === eq.id);
          const item: CartItem = { equipment: eq, startDate, endDate };
          if (idx >= 0) merged[idx] = item;
          else merged.push(item);
        }
        return merged;
      });
      return;
    }
    // API mode needs a saved delivery address before the rental plan can be created
    // server-side — keep these items queued (pendingAutoAdd stays set, not cleared)
    // and prompt for it, instead of attempting the doomed API call in this same
    // click. The retry effect below re-invokes this handler once the address saves.
    if (!siteAddress.trim()) {
      setSiteAddressModalOpen(true);
      return;
    }
    setPendingAutoAdd(null);
    void (async () => {
      try {
        const id = await ensureApiRentalPlanId(startDate, endDate);
        if (id === null) return;
        let plan = null;
        for (const eq of toAdd) {
          if (cart.some((c) => c.equipment.id === eq.id)) continue;
          plan = await rentalPlanCartApi.addItem(id, eq.id);
        }
        if (plan) {
          const { cart: synced, itemIds } = cartFromRentalPlan(plan, equipment);
          setCart(synced);
          setPlanItemIds(itemIds);
          setPlanId(plan.status === "CONVERTED" || plan.status === "CANCELLED" ? null : plan.id);
        } else {
          setPlanId(id);
        }
      } catch (err) {
        setCartDateError(
          err instanceof Error
            ? err.message
            : "Couldn't add those items to your rental plan.",
        );
      }
    })();
  };

  const addToCart = (item: CartItem) => {
    // Hard-enforce one shared date range per cart (Spec-ui-heavy-machinery-portal.md §4.3) —
    // a belt-and-suspenders backstop behind the date-bar lock below, in case an item reaches
    // here from a path that doesn't source dates from the shared bar (chatbot, spec matches).
    const other = cart.find((c) => c.equipment.id !== item.equipment.id);
    if (
      other &&
      (other.startDate !== item.startDate || other.endDate !== item.endDate)
    ) {
      setCartDateError(
        "All equipment in one booking must share the same rental dates. Remove the existing item(s) first, or match their dates.",
      );
      return;
    }
    setCartDateError(null);
    setCartOpen(true);
    // After Add All (specs mode), address is collected from the highlighted Add
    // control — do not pop Delivery Details from equipment-card Select.
    if (shouldPromptDeliveryDetails(onboardingMode) && !siteAddressPrompted) {
      setSiteAddressPrompted(true);
      setSiteAddressModalOpen(true);
    }
    if (!isApiMode) {
      setCart((prev) => [
        ...prev.filter((c) => c.equipment.id !== item.equipment.id),
        item,
      ]);
      return;
    }
    // API mode needs a saved delivery address before the rental plan can be created
    // server-side — queue this item and prompt for it, instead of attempting the
    // doomed API call in this same click. The retry effect below re-adds it once
    // the address saves.
    if (!siteAddress.trim()) {
      setSiteAddressModalOpen(true);
      setPendingCartItem(item);
      return;
    }
    void (async () => {
      try {
        const id = await ensureApiRentalPlanId(item.startDate, item.endDate);
        if (id === null) return;
        const plan = await rentalPlanCartApi.addItem(id, item.equipment.id);
        const { cart: synced, itemIds } = cartFromRentalPlan(plan, equipment);
        setCart(synced);
        setPlanItemIds(itemIds);
        setPlanId(plan.status === "CONVERTED" || plan.status === "CANCELLED" ? null : plan.id);
      } catch (err) {
        setCartDateError(
          err instanceof Error
            ? err.message
            : "Couldn't add this item to your rental plan.",
        );
      }
    })();
  };

  // Retries whatever addToCart/handleSharedEndDateSelected deferred because siteAddress
  // was still blank, the moment SiteAddressModal's onSave fills it in — otherwise the item
  // is never actually added and the earlier "Add a delivery address…" prompt just sits
  // there looking broken even after the user types an address (nothing else re-triggers
  // the add). Narrow deps are intentional: this should only fire on the blank→non-blank
  // transition, not on every pendingCartItem/pendingAutoAdd change. Declared before the
  // onboarding/loading/error early returns below so this hook always runs in the same
  // order across renders (react-hooks/rules-of-hooks).
  useEffect(() => {
    if (!siteAddress.trim()) return;
    if (pendingCartItem) {
      const item = pendingCartItem;
      // Clearing the queue is inseparable from retrying addToCart(item) below,
      // which itself synchronizes cart/plan state with the API — there's no
      // external system to subscribe to other than this component's own
      // siteAddress transition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingCartItem(null);
      addToCart(item);
    }
    if (pendingAutoAdd && sharedEndDate) {
      handleSharedEndDateSelected(sharedEndDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteAddress]);

  const applyQuoteDatesToBar = (quoteDates?: QuoteDateRange) => {
    if (!quoteDates) return;
    setSharedStartDate(quoteDates.startDate);
    setSharedEndDate(quoteDates.endDate);
    const start = parseISODate(quoteDates.startDate);
    setSharedMonth(start.getMonth());
    setSharedYear(start.getFullYear());
  };

  const applySpecsRecsToPlan = (
    recs?: EquipmentItem[],
    quoteDates?: QuoteDateRange,
  ) => {
    if (!recs) return;
    setSpecsRecs(recs);
    setPendingAutoAdd(null);
    setCartDateError(null);
    applyQuoteDatesToBar(quoteDates);
    if (quoteDates) {
      setCart(buildQuoteCartItems(recs, quoteDates));
      setCartOpen(true);
    } else {
      setCart([]);
      setCartOpen(false);
      setDateBarOpen(true);
    }
  };

  if (!onboardingMode) {
    return (
      <CustomerOnboarding
        userName={userName}
        onDone={(mode, recs, quoteDates) => {
          setOnboardingMode(mode);
          applySpecsRecsToPlan(recs, quoteDates);
        }}
      />
    );
  }

  if (specUploadOpen) {
    return (
      <CustomerOnboarding
        userName={userName}
        initialStep="upload"
        onDone={(mode, recs, quoteDates) => {
          setSpecUploadOpen(false);
          setOnboardingMode(mode);
          applySpecsRecsToPlan(recs, quoteDates);
        }}
      />
    );
  }

  if (equipmentRes.status === "loading" || depotsRes.status === "loading") {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        style={sans}
      >
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (equipmentRes.status === "error" || depotsRes.status === "error") {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center p-6 text-center"
        style={sans}
      >
        <div>
          <p className="text-foreground font-semibold mb-2">
            Couldn't reach the equipment catalog.
          </p>
          <p className="text-sm text-muted-foreground">
            {equipmentRes.error ?? depotsRes.error}
          </p>
        </div>
      </div>
    );
  }

  const totalCost = cart.reduce(
    (s, c) =>
      s + daysBetweenISO(c.startDate, c.endDate) * c.equipment.baseDailyRate,
    0,
  );

  // API mode only: remove an item via DELETE .../items/{itemId} (keyed by RentalPlanItem
  // id, not assetId — planItemIds tracks that mapping since RentalPlanItemResponse is the
  // only place it's exposed). Response reflects the new status/items, so `cart` is set
  // from it directly rather than issuing a follow-up GET.
  const removeFromCartApi = (equipmentId: number) => {
    const itemId = planItemIds[equipmentId];
    if (planId === null || itemId === undefined) return;
    rentalPlanCartApi
      .removeItem(planId, itemId)
      .then((plan) => {
        if (plan.items.length === 0) {
          // An emptied plan still counts as "active" (findActiveRentalPlan only excludes
          // CONVERTED/CANCELLED) and its startDate/endDate stay fixed from creation (no
          // update route exists) — left alone, the next ensureApiRentalPlanId() call with a
          // different date range would wrongly read it as a real conflict against a plan
          // that has nothing in it. Cancel it so the slot is genuinely free again.
          rentalPlanCartApi.cancel(plan.id).catch(() => {
            // Best-effort — the plan is empty either way, and "Cancel rental plan" in the
            // cart drawer is still available as a manual fallback if this call fails.
          });
          setCart([]);
          setPlanItemIds({});
          setPlanId(null);
          return;
        }
        const { cart: synced, itemIds } = cartFromRentalPlan(plan, equipment);
        setCart(synced);
        setPlanItemIds(itemIds);
        setPlanId(plan.status === "CONVERTED" || plan.status === "CANCELLED" ? null : plan.id);
      })
      .catch((err) => {
        setCartDateError(
          err instanceof Error
            ? err.message
            : "Couldn't remove this item from your rental plan.",
        );
      });
  };

  // API mode only: abandon the current plan (api-contract-for-frontend.md §5.5). Minimal
  // wiring for manual verification of PR 4 — trusts the response over local state, same as
  // addItem/removeItem above, and clears the cart since a cancelled plan is no longer "mine".
  const cancelPlanApi = () => {
    if (planId === null) return;
    if (!window.confirm("Cancel your current rental plan? This can't be undone.")) return;
    rentalPlanCartApi
      .cancel(planId)
      .then(() => {
        setCart([]);
        setPlanItemIds({});
        setPlanId(null);
      })
      .catch((err) => {
        setCartDateError(
          err instanceof Error
            ? err.message
            : "Couldn't cancel your rental plan.",
        );
      });
  };

  // Specs-banner toggle: add/remove Rental Plan items without opening Delivery Details.
  const toggleSpecsRecInPlan = (eq: EquipmentItem) => {
    if (cart.some((c) => c.equipment.id === eq.id)) {
      setCart((prev) => toggleEquipmentInPlan(prev, eq, { startDate: "", endDate: "" }));
      return;
    }
    if (!sharedStartDate || !sharedEndDate) return;
    const other = cart.find((c) => c.equipment.id !== eq.id);
    if (
      other &&
      (other.startDate !== sharedStartDate || other.endDate !== sharedEndDate)
    ) {
      setCartDateError(
        "All equipment in one booking must share the same rental dates. Remove the existing item(s) first, or match their dates.",
      );
      return;
    }
    setCartDateError(null);
    setCart((prev) =>
      toggleEquipmentInPlan(prev, eq, {
        startDate: sharedStartDate,
        endDate: sharedEndDate,
      }),
    );
    setCartOpen(true);
  };

  const handleChatbotSelect = (eq: EquipmentItem) => {
    setHighlightId(eq.id);
    if (sharedStartDate && sharedEndDate) {
      addToCart({
        equipment: eq,
        startDate: sharedStartDate,
        endDate: sharedEndDate,
      });
    }
    setTimeout(() => setHighlightId(null), 3000);
  };

  // Clicking the logo returns to the main equipment-browsing page within the
  // portal — it must never touch auth/session state (see handleLogout in App).
  const goHome = () => {
    setDetailItem(null);
    setProfileOpen(false);
    setEditMode(false);
    setConfirmed(false);
    setConfirmedOrder(null);
    setSelectedPlan(null);
  };

  if (confirmed && confirmedOrder) {
    return (
      <ConfirmationScreen
        confirmedOrder={confirmedOrder}
        reservationId={reservationId}
        paymentIntentId={paymentIntentId}
        userName={userName}
        onBrowseMore={() => {
          setConfirmed(false);
          setConfirmedOrder(null);
        }}
      />
    );
  }

  // ── RENTAL PLAN DETAIL PAGE ──────────────────────────────────────────────────
  if (selectedPlan) {
    return (
      <RentalPlanDetail
        plan={selectedPlan}
        userName={userName}
        onHome={goHome}
        onBack={() => setSelectedPlan(null)}
        onLogout={onLogout}
      />
    );
  }

  // ── USER PROFILE PAGE ────────────────────────────────────────────────────────
  if (profileOpen) {
    return (
      <CustomerProfilePage
        userName={userName}
        goHome={goHome}
        onLogout={onLogout}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        editMode={editMode}
        setEditMode={setEditMode}
        rentalPlans={rentalPlans}
        onBack={() => setProfileOpen(false)}
        onSelectPlan={(plan) => {
          setProfileOpen(false);
          setSelectedPlan(plan);
        }}
      />
    );
  }

  // ── EQUIPMENT DETAIL PAGE ────────────────────────────────────────────────────
  if (detailItem) {
    return (
      <EquipmentDetailPage
        detailItem={detailItem}
        equipment={equipment}
        cart={cart}
        goHome={goHome}
        userName={userName}
        onLogout={onLogout}
        onOpenProfile={() => setProfileOpen(true)}
        onUploadSpecs={() => setSpecUploadOpen(true)}
        onToggleCart={() => setCartOpen((o) => !o)}
        sharedStartDate={sharedStartDate}
        sharedEndDate={sharedEndDate}
        sharedMonth={sharedMonth}
        sharedYear={sharedYear}
        setSharedStartDate={setSharedStartDate}
        setSharedEndDate={handleSharedEndDateSelected}
        setSharedMonth={setSharedMonth}
        setSharedYear={setSharedYear}
        dateBarOpen={dateBarOpen}
        setDateBarOpen={setDateBarOpen}
        pendingAutoAddActive={!!pendingAutoAdd}
        onBack={() => setDetailItem(null)}
        onSelect={(item, startDate, endDate) => {
          addToCart({ equipment: item, startDate, endDate });
          setDetailItem(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <button
            onClick={goHome}
            className="text-xl font-black text-primary hover:opacity-80 transition-opacity"
            style={display}
          >
            HEAVY<span className="text-foreground"> RENTAL</span>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <div className="w-6 h-6 bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:border-primary transition-colors">
                <User size={12} className="text-primary" />
              </div>
              <span>{userName}</span>
              <span
                className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10 group-hover:bg-primary/20 transition-colors"
                style={mono}
              >
                CUSTOMER
              </span>
            </button>
            <button
              onClick={() => setSpecUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/40 bg-primary/5 text-xs font-bold tracking-widest uppercase text-primary hover:bg-primary/15 hover:border-primary/70 transition-all"
              style={mono}
            >
              <Upload size={13} /> Upload Specs
            </button>
            <button
              onClick={() => setCartOpen((o) => !o)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <ShoppingCart size={15} />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
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

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <p
            className="text-xs text-primary font-semibold tracking-widest uppercase mb-2"
            style={mono}
          >
            {onboardingMode === "browse"
              ? "Browsing · No pressure"
              : onboardingMode === "specs"
                ? "Based on your specs"
                : `Welcome back, ${userName.split(" ")[0]}`}
          </p>
          <h1
            className="text-5xl font-black text-foreground leading-none"
            style={display}
          >
            {onboardingMode === "specs"
              ? "YOUR RECOMMENDATIONS"
              : "SELECT YOUR EQUIPMENT"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {onboardingMode === "specs"
              ? sharedStartDate && sharedEndDate
                ? "Dates are filled from your quote. Select any machine to add it to your cart."
                : "Matched from your uploaded specs. Set your dates below, then select any machine to add it to your cart."
              : "Pick your rental dates once below, then select any machine — every item in one booking shares the same dates."}
          </p>
        </div>

        <DateRangeBar
          sharedStartDate={sharedStartDate}
          sharedEndDate={sharedEndDate}
          sharedMonth={sharedMonth}
          sharedYear={sharedYear}
          setSharedStartDate={setSharedStartDate}
          setSharedEndDate={handleSharedEndDateSelected}
          setSharedMonth={setSharedMonth}
          setSharedYear={setSharedYear}
          dateBarOpen={dateBarOpen}
          setDateBarOpen={setDateBarOpen}
          locked={cart.length > 0}
          highlight={!!pendingAutoAdd && (!sharedStartDate || !sharedEndDate)}
        />

        {cartDateError && (
          <div className="mb-8 -mt-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
            {cartDateError}
            <button
              onClick={() => setCartDateError(null)}
              className="text-red-400 hover:text-red-300"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {siteAddressModalOpen && (
          <SiteAddressModal
            address={siteAddress}
            notes={deliveryNotes}
            onClose={() => setSiteAddressModalOpen(false)}
            onSave={(address, postalCode, notes) => {
              setSiteAddress(address);
              setSitePostalCode(postalCode);
              setDeliveryNotes(notes);
              setSiteAddressModalOpen(false);
            }}
          />
        )}

        {/* Specs recommendation banner */}
        {onboardingMode === "specs" && specsRecs.length > 0 && (
          <div className="mb-8 border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-primary flex items-center justify-center">
                <CheckCircle size={12} className="text-primary-foreground" />
              </div>
              <p
                className="text-xs font-semibold text-primary tracking-widest uppercase"
                style={mono}
              >
                Top {specsRecs.length} matches from your specs
              </p>
              <button
                onClick={() => setOnboardingMode("know")}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Show all equipment
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {specsRecs.map((eq, i) => {
                const inPlan = cart.some((c) => c.equipment.id === eq.id);
                const thumb = equipmentImageSrc(eq.img, 120, 120);
                return (
                <div
                  key={eq.id}
                  className={`flex items-center gap-3 p-3 bg-card border ${inPlan ? "border-primary" : i === 0 ? "border-primary/50" : "border-border"}`}
                >
                  <div className="w-14 h-14 bg-muted overflow-hidden shrink-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={eq.name}
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    {i === 0 && (
                      <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 font-bold tracking-wider inline-block mb-1">
                        BEST MATCH
                      </span>
                    )}
                    <p
                      className="text-xs text-primary font-semibold"
                      style={mono}
                    >
                      {eq.category}
                    </p>
                    <p
                      className="text-sm font-black text-foreground leading-tight truncate"
                      style={display}
                    >
                      {eq.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      S${eq.baseDailyRate.toLocaleString()}/day
                    </p>
                  </div>
                  <button
                    disabled={!sharedStartDate || !sharedEndDate}
                    onClick={() => toggleSpecsRecInPlan(eq)}
                    title={
                      !sharedStartDate || !sharedEndDate
                        ? "Set your dates in the bar above first"
                        : inPlan
                          ? "Remove from your rental plan"
                          : undefined
                    }
                    className={`shrink-0 px-3 py-1.5 text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed ${inPlan ? "bg-secondary text-foreground border border-primary" : "bg-primary text-primary-foreground hover:brightness-110"}`}
                  >
                    {inPlan ? "Selected" : "Select"}
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-6 items-start">
          <EquipmentGrid
            equipment={equipment}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            highlightId={highlightId}
            cart={cart}
            sharedStartDate={sharedStartDate}
            sharedEndDate={sharedEndDate}
            onSelectDetail={setDetailItem}
            onAddToCart={addToCart}
          />

          {cartOpen && (
            <CartDrawer
              cart={cart}
              onRemoveItem={(equipmentId) =>
                isApiMode
                  ? removeFromCartApi(equipmentId)
                  : setCart((prev) =>
                      prev.filter((x) => x.equipment.id !== equipmentId),
                    )
              }
              siteAddress={siteAddress}
              onEditAddress={() => setSiteAddressModalOpen(true)}
              highlightAddAddress={cart.length > 0 && !siteAddress}
              totalCost={totalCost}
              onCancelPlan={isApiMode && planId !== null ? cancelPlanApi : undefined}
              onCheckout={() => {
                setCartOpen(false);
                setCheckoutOpen(true);
                setPaymentIntentId(generateFakePaymentIntentId());
              }}
              onClose={() => setCartOpen(false)}
            />
          )}
        </div>
      </div>
      <Chatbot onSelectEquipment={handleChatbotSelect} equipment={equipment} />
      {checkoutOpen && (
        <DepositCheckout
          cart={cart}
          totalCost={totalCost}
          userName={userName}
          paymentIntentId={paymentIntentId}
          onClose={() => setCheckoutOpen(false)}
          onGetQuote={
            isApiMode && planId !== null
              ? () => rentalPlanCartApi.quote(planId)
              : undefined
          }
          onBeginPayment={async () => {
            // Real backend only (STRIPE_INTEGRATION_HANDOFF.md §2/§5) — DepositCheckout
            // only calls this when MODE === "api"; mock mode still creates its booking
            // inside onPaid below, after the simulated payment "succeeds". Unlike the
            // mock-mode path below, POST /api/bookings takes no userId — the real backend
            // derives the customer from the Authorization bearer token server-side (its
            // response's customerName proves this), so there's nothing to check here.
            if (planId === null) {
              throw new Error(
                "Your rental plan couldn't be found — please refresh and try again.",
              );
            }
            // Re-quote immediately before converting the plan (re-quoting a QUOTED plan is
            // explicitly allowed — it's the stale-quote recovery path) so the plan is
            // guaranteed QUOTED and the amount about to be charged is the freshest one,
            // regardless of whether DepositCheckout's own display-only quote (onGetQuote
            // above) has resolved yet. This is what keeps the charged amount from silently
            // reverting to flat base-rate math once dynamic pricing is live
            // (specification/frontend-handoff.md).
            await rentalPlanCartApi.quote(planId);
            const booking = await createBookingFromPlan({
              rentalPlanId: planId,
              siteAddress,
              deliveryNotes: deliveryNotes || undefined,
            });
            const intent = await paymentApi.createDepositIntent(
              booking.bookingId,
            );
            return {
              bookingId: booking.bookingId,
              clientSecret: intent.clientSecret,
              paymentIntentId: intent.paymentIntentId,
              depositAmount: booking.depositAmount,
            };
          }}
          onPaid={async (result) => {
            if (result) {
              // Real backend: booking + Stripe PaymentIntent already exist (onBeginPayment
              // above) and the payment just succeeded — trust the server's depositAmount
              // rather than recomputing it client-side.
              const rid = `RNT-${String(result.bookingId).padStart(4, "0")}`;
              setReservationId(rid);
              setConfirmedOrder({
                items: cart,
                totalCost,
                depositPaid: result.depositAmount,
              });
              setCheckoutOpen(false);
              setConfirmed(true);
              setCart([]);
              setSiteAddress("");
              setSitePostalCode("");
              setDeliveryNotes("");
              setSiteAddressPrompted(false);
              setSharedStartDate(null);
              setSharedEndDate(null);
              return;
            }
            if (userId === null)
              throw new Error(
                "You must be signed in with a linked account to book equipment.",
              );
            const { startDate, endDate } = cartDateRange(cart);
            const depotId = resolveCartDepotId(cart, depots);
            const cost = cart.reduce(
              (s, c) =>
                s +
                daysBetweenISO(c.startDate, c.endDate) *
                  c.equipment.baseDailyRate,
              0,
            );
            const deposit = calcDeposit(cost);
            const plan = await rentalPlanApi.create({
              userId,
              status: "active",
              depotId,
              items: cart.map((c) => ({
                equipmentId: c.equipment.id,
                startDate: c.startDate,
                endDate: c.endDate,
              })),
              createdAt: new Date().toISOString(),
            });
            const booking = await bookingApi.create({
              rentalPlanId: plan.id,
              depotId,
              equipmentIds: cart.map((c) => c.equipment.id),
              startDate,
              endDate,
              deliveryDate: startDate,
              returnDate: endDate,
              totalAmount: cost,
              depositAmount: deposit,
              fullPaymentDueDate: calcFullPaymentDueDate(startDate),
              status: "CONFIRMED",
              paidStatus: "DEPOSIT",
              siteAddress,
              sitePostalCode,
              deliveryNotes,
            });
            const rid = `RNT-${String(booking.id).padStart(4, "0")}`;
            rentalPlansRes.reload();
            setReservationId(rid);
            setConfirmedOrder({
              items: cart,
              totalCost: cost,
              depositPaid: deposit,
            });
            setCheckoutOpen(false);
            setConfirmed(true);
            setCart([]);
            setSiteAddress("");
            setSitePostalCode("");
            setDeliveryNotes("");
            setSiteAddressPrompted(false);
            setSharedStartDate(null);
            setSharedEndDate(null);
          }}
        />
      )}
    </div>
  );
}
