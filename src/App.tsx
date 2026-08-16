import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  ArrowRight,
  Star,
  Phone,
  Mail,
  Menu,
  X,
  Truck,
  Wrench,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Activity,
  DollarSign,
  AlertTriangle,
  User,
  LogOut,
  ShoppingCart,
  Upload,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CustomerOnboarding } from "./features/browse/CustomerOnboarding";
import { equipmentImageSrc } from "./features/browse/equipmentImageSrc";
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { AssetFormModal } from "./features/admin/assets/AssetFormModal";
import { SafetyPage } from "./app/SafetyPage";
import { AboutPage } from "./app/AboutPage";
import { ProjectsPage } from "./app/ProjectsPage";
import type {
  Asset as EquipmentItem,
  Role,
  View,
  OnboardingMode,
  StoredSession,
} from "./app/types";
import {
  assetApi,
  depotApi,
  userApi,
  rentalPlanApi,
  rentalPlanCartApi,
  bookingApi,
  monthlyUtilizationApi,
  statusDistributionApi,
  calcDeposit,
  calcFullPaymentDueDate,
  setAuthToken,
  login,
  logout,
  createBookingFromPlan,
  paymentApi,
} from "./app/api";
import { useApiResource } from "./app/useApiResource";
import {
  deriveAssetRecord,
  formatCondition,
  type AssetRecord,
} from "./app/assetRecord";
import {
  issueSession,
  loadSession,
  saveSession,
  clearSession,
  isExpired,
} from "./app/auth";
import { mono, display, sans } from "./lib/styles";
import {
  daysBetweenISO,
  formatDateRange,
  parseISODate,
  type QuoteDateRange,
} from "./lib/dateFormat";
import { DateRangeBar } from "./components/DateRangeBar";
import {
  buildQuoteCartItems,
  shouldPromptDeliveryDetails,
  toggleEquipmentInPlan,
} from "./features/checkout/specsPlan";
import { AuthLoadingOverlay } from "./components/AuthLoadingOverlay";
import {
  CartProvider,
  useCart,
  cartDateRange,
  resolveCartDepotId,
  cartFromRentalPlan,
  findActiveRentalPlan,
  type CartItem,
} from "./features/cart/CartContext";
import { Chatbot } from "./features/browse/Chatbot";
import { EquipmentGrid } from "./features/browse/EquipmentGrid";
import { SiteAddressModal } from "./features/checkout/SiteAddressModal";
import { generateFakePaymentIntentId } from "./features/checkout/payment";
import { DepositCheckout } from "./features/checkout/DepositCheckout";
import { CartDrawer } from "./features/checkout/CartDrawer";
import { ConfirmationScreen } from "./features/checkout/ConfirmationScreen";
import {
  buildRentalPlanViews,
  type RentalPlan,
} from "./features/checkout/rentalPlan";
import { RentalPlanDetail } from "./features/checkout/RentalPlanDetail";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: "Marcus Delgado",
    role: "Site Manager — Ironclad Construction",
    quote:
      "We needed a 100-ton crane on 48-hour notice. Heavy Rental delivered, certified operator included. Saved our project timeline.",
    rating: 5,
  },
  {
    name: "Jennifer Okafor",
    role: "Operations Director — Vertex Earthworks",
    quote:
      "We run 12+ excavators through Heavy Rental month over month. Billing is clean, equipment is well-maintained.",
    rating: 5,
  },
  {
    name: "Brian Stellrecht",
    role: "Owner — Stellrecht Grading Co.",
    quote:
      "As a small contractor, Heavy Rental lets me bid on jobs I'd have had to turn down before.",
    rating: 5,
  },
];
const IDEAL_FOR_BY_CATEGORY: Record<string, string[]> = {
  Excavator: [
    "earthmoving",
    "trenching",
    "demolition",
    "foundation work",
    "digging",
  ],
  "Scissors Lift": [
    "indoor access",
    "installation",
    "elevated work",
    "warehousing",
    "maintenance",
  ],
  "Boom Lift": [
    "aerial work",
    "height",
    "painting",
    "electrical",
    "maintenance",
    "elevated",
  ],
  "Fork Lift": [
    "material handling",
    "warehouse",
    "loading",
    "pallet moving",
    "logistics",
  ],
};

function deriveTags(item: {
  platformHeight?: number | null;
  capacity?: number;
  condition?: string;
}): string[] {
  const tags: string[] = [];
  if (typeof item.platformHeight === "number")
    tags.push(`${item.platformHeight}m Reach`);
  if (typeof item.capacity === "number")
    tags.push(`${item.capacity}kg Capacity`);
  if (item.condition === "EXCELLENT") tags.push("Like New");
  return tags;
}

const STATS = [
  { value: "1,200+", label: "Equipment Units" },
  { value: "98%", label: "On-Time Delivery" },
  { value: "340+", label: "Active Clients" },
  { value: "24/7", label: "Support Available" },
];

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────

interface ChartTipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly ChartTipPayloadItem[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs">
      <p className="text-foreground font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={String(p.name ?? i)} style={{ color: p.color ?? "#f5a623" }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────────

// Demo accounts mapped to real mock/db.json seed users (Spec-mock-api-server.md)
// so a real numeric userId can be resolved at login — see handleLogin in App().
// The password is a fixed demo value compared client-side only (Spec-frontend-authentication.md
// FR-010) — not real security, since it ships visible in the client bundle.
const ACCOUNTS: Record<string, { role: Role; name: string; password: string }> =
  {
    "alex.tan@example.sg": {
      role: "customer",
      name: "Alex Tan",
      password: "customer123",
    },
    "ravi.kumar@example.sg": {
      role: "admin",
      name: "Ravi Kumar",
      password: "admin123",
    },
  };

function LoginModal({
  onLogin,
  onClose,
}: {
  onLogin: (role: Role, name: string, email: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.toLowerCase().trim();
    const account = ACCOUNTS[normalizedEmail];
    if (!account || password !== account.password) {
      setError("Invalid email or password.");
      return;
    }
    await onLogin(account.role, account.name, normalizedEmail);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="bg-card border border-border w-full max-w-md"
        style={sans}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="text-xl font-black text-foreground" style={display}>
            SIGN IN
          </span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="you@company.com"
              required
              autoFocus
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              required
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 font-bold text-sm tracking-widest uppercase bg-primary hover:brightness-110 text-primary-foreground transition-all mt-1"
          >
            Sign In
          </button>
          <p className="text-xs text-muted-foreground text-center" style={mono}>
            Customer: alex.tan@example.sg / customer123 · Admin:
            ravi.kumar@example.sg / admin123
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── CUSTOMER PORTAL ──────────────────────────────────────────────────────────

function CustomerPortal({
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
    const initials = userName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const navBar = (
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <button
            onClick={goHome}
            className="text-xl font-black text-primary hover:opacity-80 transition-opacity"
            style={display}
          >
            HEAVY<span className="text-foreground"> RENTAL</span>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setProfileOpen(false)}
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
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Back */}
          <button
            onClick={() => setProfileOpen(false)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ChevronLeft
              size={14}
              className="group-hover:-translate-x-0.5 transition-transform"
            />{" "}
            Back to Catalog
          </button>

          {/* Header */}
          <div className="flex items-start gap-6 mb-10">
            <div className="w-20 h-20 bg-primary/20 border-2 border-primary/40 flex items-center justify-center shrink-0">
              <span
                className="text-3xl font-black text-primary"
                style={display}
              >
                {initials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs text-primary font-semibold tracking-widest uppercase mb-1"
                style={mono}
              >
                Customer Account
              </p>
              <h1
                className="text-5xl font-black text-foreground leading-none mb-1"
                style={display}
              >
                {userName.toUpperCase()}
              </h1>
              <p className="text-sm text-muted-foreground">
                {profileForm.company} · Member since Jan 2024
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left col */}
            <div className="flex flex-col gap-5">
              {/* Personal info */}
              <div className="bg-card border border-border">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <p
                    className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
                    style={mono}
                  >
                    Personal Information
                  </p>
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-3 py-1 text-xs font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditMode(false)}
                        className="px-3 py-1 text-xs font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setEditMode(false)}
                        className="px-3 py-1 text-xs font-bold tracking-widest uppercase bg-primary text-primary-foreground hover:brightness-110 transition-all"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {[
                    { label: "Full Name", key: "name" as const },
                    { label: "Email", key: "email" as const },
                    { label: "Phone", key: "phone" as const },
                    { label: "Company", key: "company" as const },
                  ].map(({ label, key }) => (
                    <div key={key} className="px-5 py-3">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {label}
                      </p>
                      {editMode ? (
                        <input
                          value={profileForm[key]}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="w-full bg-secondary/50 border border-border px-2 py-1 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
                        />
                      ) : (
                        <p className="text-sm font-medium text-foreground">
                          {profileForm[key]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="bg-card border border-border p-5">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4"
                  style={mono}
                >
                  Account Stats
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Plans", value: rentalPlans.length },
                    {
                      label: "Days Rented",
                      value: rentalPlans.reduce(
                        (s, r) => s + r.items.reduce((x, i) => x + i.days, 0),
                        0,
                      ),
                    },
                    {
                      label: "Total Spent",
                      value: `S$${rentalPlans.reduce((s, r) => s + r.depositPaid, 0).toLocaleString()}`,
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="bg-secondary/40 border border-border px-3 py-3"
                    >
                      <p className="text-xs text-muted-foreground mb-1">
                        {label}
                      </p>
                      <p
                        className="text-2xl font-black text-foreground"
                        style={display}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right col */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Rental Plans */}
              <div className="bg-card border border-border">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <p
                    className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
                    style={mono}
                  >
                    Rental Plan
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {rentalPlans.length}{" "}
                    {rentalPlans.length === 1 ? "plan" : "plans"}
                  </span>
                </div>
                {rentalPlans.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-muted-foreground text-sm">
                      No rental plans yet.
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Rental plans are created after you complete a payment.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {rentalPlans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => {
                          setProfileOpen(false);
                          setSelectedPlan(plan);
                        }}
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p
                              className="text-sm font-black text-foreground tracking-wide"
                              style={mono}
                            >
                              {plan.id}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 text-xs font-semibold border ${plan.status === "Active" ? "bg-primary/10 text-primary border-primary/30" : "bg-green-500/10 text-green-400 border-green-500/20"}`}
                            >
                              {plan.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {plan.items.map((i) => i.equipmentName).join(", ")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {plan.items.reduce((s, i) => s + i.days, 0)} days ·
                            Paid {plan.paidAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              Total
                            </p>
                            <p
                              className="text-lg font-black text-foreground"
                              style={display}
                            >
                              S${plan.totalCost.toLocaleString()}
                            </p>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deactivate — bottom of page, low visibility */}
          <div className="mt-16 pt-6 border-t border-border/40 flex justify-center">
            <button className="text-xs text-muted-foreground/40 hover:text-red-400/70 transition-colors underline underline-offset-4">
              Deactivate account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EQUIPMENT DETAIL PAGE ────────────────────────────────────────────────────
  if (detailItem) {
    const inCart = cart.some((c) => c.equipment.id === detailItem.id);
    const liveAvailable =
      equipment.find((e) => e.id === detailItem.id)?.available ??
      detailItem.available;

    const SPEC_ROWS: [string, string][] = [
      ["Category", detailItem.category],
      ["Purchase Year", String(detailItem.purchaseYear)],
      ["Max Capacity", `${detailItem.capacity} tonnes`],
      ["Location", detailItem.location ?? "—"],
      ["Base Daily Rate", `S$${detailItem.baseDailyRate.toLocaleString()}`],
      [
        "Weekly Rate",
        detailItem.weekly ? `S$${detailItem.weekly.toLocaleString()}` : "—",
      ],
      [
        "Availability",
        typeof liveAvailable === "boolean"
          ? liveAvailable
            ? "Available Now"
            : "Currently On Rent"
          : "—",
      ],
    ];

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

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Breadcrumb */}
          <button
            onClick={() => setDetailItem(null)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ChevronLeft
              size={14}
              className="group-hover:-translate-x-0.5 transition-transform"
            />
            Back to Equipment Catalog
          </button>

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

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: image + gallery */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <div className="relative aspect-video bg-muted overflow-hidden border border-border">
                <img
                  src={
                    detailItem.img.startsWith("data:")
                      ? detailItem.img
                      : `https://images.unsplash.com/${detailItem.img}?w=900&h=520&fit=crop&auto=format`
                  }
                  alt={detailItem.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2">
                  {typeof liveAvailable === "boolean" && (
                    <span
                      className={`px-2.5 py-1 text-xs font-bold border ${liveAvailable ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                    >
                      {liveAvailable ? "● Available" : "● On Rent"}
                    </span>
                  )}

                  {inCart && (
                    <span className="px-2.5 py-1 text-xs font-bold bg-primary text-primary-foreground">
                      In Cart
                    </span>
                  )}
                </div>
              </div>
              {/* Thumbnail strip — same image at different crops for demo */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  "?w=300&h=180&fit=crop&crop=entropy",
                  "?w=300&h=180&fit=crop&crop=center",
                  "?w=300&h=180&fit=crop&crop=faces,edges",
                ].map((q, i) => (
                  <div
                    key={i}
                    className="aspect-video bg-muted overflow-hidden border border-border opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <img
                      src={
                        detailItem.img.startsWith("data:")
                          ? detailItem.img
                          : `https://images.unsplash.com/${detailItem.img}${q}&auto=format`
                      }
                      alt=""
                      className="w-full h-full object-cover"
                      style={
                        detailItem.img.startsWith("data:")
                          ? {
                              transform: "scale(1.7)",
                              transformOrigin: [
                                "10% 10%",
                                "50% 50%",
                                "90% 90%",
                              ][i],
                            }
                          : undefined
                      }
                    />
                  </div>
                ))}
              </div>

              {/* Ideal For */}
              <div className="bg-card border border-border p-5">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3"
                  style={mono}
                >
                  Ideal For
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    detailItem.idealFor ??
                    IDEAL_FOR_BY_CATEGORY[detailItem.category] ??
                    []
                  ).map((use) => (
                    <span
                      key={use}
                      className="px-3 py-1 text-xs bg-primary/10 text-primary border border-primary/20 font-semibold"
                    >
                      {use}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: details + CTA */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div>
                <p
                  className="text-xs text-primary font-semibold tracking-widest uppercase mb-1"
                  style={mono}
                >
                  {detailItem.category}
                </p>
                <h1
                  className="text-4xl font-black text-foreground leading-none mb-3"
                  style={display}
                >
                  {detailItem.name}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {detailItem.desc}
                </p>
              </div>

              {/* Pricing */}
              <div className="bg-card border border-border p-5">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3"
                  style={mono}
                >
                  Pricing
                </p>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Daily rate
                    </p>
                    <p
                      className="text-3xl font-black text-foreground"
                      style={display}
                    >
                      S${detailItem.baseDailyRate.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Weekly rate
                    </p>
                    <p
                      className="text-3xl font-black text-foreground"
                      style={display}
                    >
                      {detailItem.weekly
                        ? `S$${detailItem.weekly.toLocaleString()}`
                        : "—"}
                    </p>
                    {detailItem.weekly && (
                      <p className="text-xs text-green-400 mt-0.5">
                        Save{" "}
                        {Math.round(
                          (1 -
                            detailItem.weekly /
                              (detailItem.baseDailyRate * 7)) *
                            100,
                        )}
                        % vs daily
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Specs table */}
              <div className="bg-card border border-border">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase px-5 pt-4 pb-3 border-b border-border"
                  style={mono}
                >
                  Specifications
                </p>
                <div className="divide-y divide-border">
                  {SPEC_ROWS.map(([label, val]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-5 py-2.5"
                    >
                      <span className="text-xs text-muted-foreground">
                        {label}
                      </span>
                      <span
                        className={`text-xs font-semibold text-right ${label === "Availability" ? (detailItem.available ? "text-green-400" : "text-amber-400") : "text-foreground"}`}
                        style={mono}
                      >
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statutory compliance badge — client-synthesized, like condition/serialno, not persisted anywhere */}
              {(detailItem.category === "Boom Lift" ||
                detailItem.category === "Excavator") &&
                (detailItem.id % 2 === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/30 text-xs font-semibold text-green-400">
                    🟢 MOM Approved / LE Cert Valid
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-400">
                    🟡 Inspection Due
                  </div>
                ))}

              {/* Tags */}
              <div>
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2"
                  style={mono}
                >
                  Features & Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {(detailItem.tags ?? deriveTags(detailItem)).map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-xs bg-secondary/60 text-muted-foreground border border-border"
                      style={mono}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col gap-3 sticky top-20">
                <button
                  disabled={
                    !detailItem.available || !sharedStartDate || !sharedEndDate
                  }
                  onClick={() => {
                    if (sharedStartDate && sharedEndDate) {
                      addToCart({
                        equipment: detailItem,
                        startDate: sharedStartDate,
                        endDate: sharedEndDate,
                      });
                      setDetailItem(null);
                    }
                  }}
                  title={
                    !sharedStartDate || !sharedEndDate
                      ? "Set your dates in the bar above first"
                      : undefined
                  }
                  className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground text-sm font-black tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Select
                </button>
                {liveAvailable === false && (
                  <p className="text-xs text-center text-amber-400">
                    This machine is currently on rent. Check back soon.
                  </p>
                )}

                <button
                  onClick={() => setDetailItem(null)}
                  className="w-full py-3 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground hover:border-primary/30 transition-all"
                >
                  ← Back to Catalog
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
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

// ─── EMPLOYEE DASHBOARD ─────────────────────────────────────────────────────

function EmployeeDashboard({
  userName,
  onLogout,
}: {
  userName: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"dashboard" | "assets">("dashboard");
  // Clicking the logo returns to the dashboard tab — it must never touch
  // auth/session state (see handleLogout in App).
  const goHome = () => setTab("dashboard");
  const equipmentRes = useApiResource((signal) => assetApi.list(undefined, signal));
  const equipment = equipmentRes.data ?? [];
  const monthlyUtilRes = useApiResource((signal) => monthlyUtilizationApi.list(signal));
  const monthlyUtilization = monthlyUtilRes.data ?? [];
  const statusDistRes = useApiResource((signal) => statusDistributionApi.list(signal));
  const statusDist = statusDistRes.data ?? [];
  const categories = Array.from(new Set(equipment.map((e) => e.category)));

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [seededFrom, setSeededFrom] = useState<typeof equipmentRes.data>(null);
  if (equipmentRes.status === "success" && equipmentRes.data !== seededFrom) {
    setSeededFrom(equipmentRes.data);
    setAssets(equipmentRes.data.map(deriveAssetRecord));
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [toast, setToast] = useState<string | null>(null);

  const totalRevenue = assets.reduce((s, e) => s + e.revenue, 0);
  const avgUtilization = assets.length
    ? Math.round(assets.reduce((s, e) => s + e.utilization, 0) / assets.length)
    : 0;
  const totalHours = assets.reduce((s, e) => s + e.hoursThisMonth, 0);
  const utilizationData = assets.map((e) => ({
    name: e.name.split(" ").slice(0, 2).join(" "),
    utilization: e.utilization,
    target: 80,
  }));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = (a: AssetRecord) => {
    setAssets((prev) =>
      prev.some((x) => x.id === a.id)
        ? prev.map((x) => (x.id === a.id ? a : x))
        : [...prev, a],
    );
    setFormOpen(false);
    setEditingAsset(null);
    showToast(
      editingAsset
        ? "Asset updated successfully."
        : "New asset added to fleet.",
    );
  };

  const handleDelete = (id: number) => {
    setAssets((prev) => prev.filter((x) => x.id !== id));
    setDeleteId(null);
    showToast("Asset removed from fleet.");
  };

  const filteredAssets = assets.filter((a) => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.serialno.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || a.category === filterCat;
    const matchStatus =
      filterStatus === "All" ||
      (filterStatus === "Available" ? a.available : !a.available);
    return matchSearch && matchCat && matchStatus;
  });

  const conditionColor = (c: AssetRecord["condition"]) =>
    ({
      EXCELLENT: "text-green-400 bg-green-500/10 border-green-500/30",
      GOOD: "text-blue-400 bg-blue-500/10 border-blue-500/30",
      FAIR: "text-amber-400 bg-amber-500/10 border-amber-500/30",
      NEEDS_REPAIR: "text-red-400 bg-red-500/10 border-red-500/30",
    })[c];

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-card border border-primary/40 px-4 py-3 text-sm text-foreground flex items-center gap-2 shadow-xl">
          <CheckCircle size={15} className="text-primary shrink-0" />
          {toast}
        </div>
      )}

      {/* Asset form modal */}
      {formOpen && (
        <AssetFormModal
          asset={editingAsset}
          onSave={handleSave}
          onClose={() => {
            setFormOpen(false);
            setEditingAsset(null);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div
            className="bg-card border border-border p-6 max-w-sm w-full"
            style={sans}
          >
            <p
              className="font-black text-xl text-foreground mb-2"
              style={display}
            >
              REMOVE ASSET?
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently remove the asset record from the fleet. This
              action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 py-2 bg-red-500 text-white text-xs font-bold tracking-wider uppercase hover:bg-red-600 transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={goHome}
              className="text-xl font-black text-primary hover:opacity-80 transition-opacity"
              style={display}
            >
              HEAVY<span className="text-foreground"> RENTAL</span>
            </button>
            <span
              className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10 uppercase tracking-wider"
              style={mono}
            >
              Employee
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Live
            </div>
            <span className="text-sm text-muted-foreground">{userName}</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-0 border-t border-border">
          {[
            { key: "dashboard", icon: BarChart2, label: "Dashboard" },
            { key: "assets", icon: Wrench, label: "Asset Records" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as "dashboard" | "assets")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── DASHBOARD TAB ── */}
      {tab === "dashboard" && (
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="mb-10">
            <p
              className="text-xs text-primary font-semibold tracking-widest uppercase mb-2"
              style={mono}
            >
              Fleet Management · July 2025
            </p>
            <h1
              className="text-5xl font-black text-foreground leading-none"
              style={display}
            >
              FLEET PERFORMANCE
            </h1>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              {
                icon: Activity,
                label: "Avg Utilization",
                value: `${avgUtilization}%`,
                sub: "+4% vs last month",
                accent: true,
              },
              {
                icon: DollarSign,
                label: "Total Revenue",
                value: `S$${(totalRevenue / 1000).toFixed(0)}K`,
                sub: "This month",
              },
              {
                icon: Truck,
                label: "Operating Hours",
                value: totalHours.toLocaleString(),
                sub: "Across all machines",
              },
              {
                icon: AlertTriangle,
                label: "Maintenance Alerts",
                value: "2",
                sub: "Action required",
              },
            ].map(({ icon: Icon, label, value, sub, accent }) => (
              <div
                key={label}
                className={`p-5 border flex flex-col gap-3 ${accent ? "bg-primary border-primary" : "bg-card border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold tracking-wider uppercase ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    style={mono}
                  >
                    {label}
                  </span>
                  <Icon
                    size={16}
                    className={
                      accent
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }
                  />
                </div>
                <p
                  className={`text-4xl font-black leading-none ${accent ? "text-primary-foreground" : "text-foreground"}`}
                  style={display}
                >
                  {value}
                </p>
                <p
                  className={`text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                >
                  {sub}
                </p>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 bg-card border border-border p-6">
              <p className="text-xs text-muted-foreground mb-1" style={mono}>
                PER-MACHINE
              </p>
              <h3
                className="text-xl font-black text-foreground mb-5"
                style={display}
              >
                UTILIZATION RATE
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart id="emp-util-bar" data={utilizationData} barGap={6}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#8a8478", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#8a8478", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={(p) => (
                      <ChartTip
                        active={p.active}
                        payload={
                          p.payload as
                            | readonly ChartTipPayloadItem[]
                            | undefined
                        }
                        label={
                          typeof p.label === "string" ||
                          typeof p.label === "number"
                            ? p.label
                            : undefined
                        }
                      />
                    )}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar
                    dataKey="utilization"
                    fill="#f5a623"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="target"
                    fill="rgba(255,255,255,0.06)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border p-6">
              <p className="text-xs text-muted-foreground mb-1" style={mono}>
                FLEET STATUS
              </p>
              <h3
                className="text-xl font-black text-foreground mb-4"
                style={display}
              >
                DISTRIBUTION
              </h3>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart id="emp-status-pie">
                  <Pie
                    data={statusDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {statusDist.map((entry, i) => (
                      <Cell key={`emp-sd-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={(p) => (
                      <ChartTip
                        active={p.active}
                        payload={
                          p.payload as
                            | readonly ChartTipPayloadItem[]
                            | undefined
                        }
                        label={
                          typeof p.label === "string" ||
                          typeof p.label === "number"
                            ? p.label
                            : undefined
                        }
                      />
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-2">
                {statusDist.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5"
                        style={{ background: color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {name}
                      </span>
                    </div>
                    <span
                      className="text-xs font-semibold text-foreground"
                      style={mono}
                    >
                      {value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4 mb-8">
            <div className="bg-card border border-border p-6">
              <p className="text-xs text-muted-foreground mb-1" style={mono}>
                6-MONTH TREND
              </p>
              <h3
                className="text-xl font-black text-foreground mb-4"
                style={display}
              >
                UTILIZATION
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart id="emp-util-line" data={monthlyUtilization}>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#8a8478", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[50, 100]}
                    tick={{ fill: "#8a8478", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={(p) => (
                      <ChartTip
                        active={p.active}
                        payload={
                          p.payload as
                            | readonly ChartTipPayloadItem[]
                            | undefined
                        }
                        label={
                          typeof p.label === "string" ||
                          typeof p.label === "number"
                            ? p.label
                            : undefined
                        }
                      />
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="utilization"
                    stroke="#f5a623"
                    strokeWidth={2}
                    dot={{ fill: "#f5a623", r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border p-6">
              <p className="text-xs text-muted-foreground mb-1" style={mono}>
                6-MONTH TREND
              </p>
              <h3
                className="text-xl font-black text-foreground mb-4"
                style={display}
              >
                REVENUE
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart id="emp-revenue-bar" data={monthlyUtilization}>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#8a8478", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8a8478", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `S$${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    content={(p) => (
                      <ChartTip
                        active={p.active}
                        payload={
                          p.payload as
                            | readonly ChartTipPayloadItem[]
                            | undefined
                        }
                        label={
                          typeof p.label === "string" ||
                          typeof p.label === "number"
                            ? p.label
                            : undefined
                        }
                      />
                    )}
                  />
                  <Bar dataKey="revenue" fill="#f5a623" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p
                  className="text-xs text-muted-foreground mb-0.5"
                  style={mono}
                >
                  ALL MACHINES
                </p>
                <h3
                  className="text-xl font-black text-foreground"
                  style={display}
                >
                  MACHINE BREAKDOWN
                </h3>
              </div>
              <button
                onClick={() => setTab("assets")}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-semibold"
              >
                Manage assets <ArrowRight size={13} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Machine",
                      "Category",
                      "Location",
                      "Utilization",
                      "Op Hours",
                      "Revenue",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase"
                        style={mono}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((e, i) => (
                    <tr
                      key={e.id}
                      className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-foreground text-sm">
                          {e.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.purchaseYear}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-sm">
                        {e.category}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-sm">
                        {e.location}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${e.utilization}%`,
                                background:
                                  e.utilization >= 80
                                    ? "#f5a623"
                                    : e.utilization >= 60
                                      ? "#fbbf24"
                                      : "#f87171",
                              }}
                            />
                          </div>
                          <span
                            className="text-xs font-semibold text-foreground"
                            style={mono}
                          >
                            {e.utilization}%
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-5 py-3 text-sm font-medium text-foreground"
                        style={mono}
                      >
                        {e.hoursThisMonth}h
                      </td>
                      <td
                        className="px-5 py-3 text-sm font-semibold text-foreground"
                        style={mono}
                      >
                        S${e.revenue.toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold border ${e.available ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}
                        >
                          {e.available ? "Available" : "On Rent"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSET RECORDS TAB ── */}
      {tab === "assets" && (
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <p
                className="text-xs text-primary font-semibold tracking-widest uppercase mb-2"
                style={mono}
              >
                Fleet Registry
              </p>
              <h1
                className="text-5xl font-black text-foreground leading-none"
                style={display}
              >
                ASSET RECORDS
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {assets.length} assets registered ·{" "}
                {assets.filter((a) => a.available).length} available
              </p>
            </div>
            <button
              onClick={() => {
                setEditingAsset(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all shrink-0"
            >
              + Add New Asset
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 flex-1 min-w-48">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or serial no…"
                className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="On Rent">On Rent</option>
            </select>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: "Total Assets",
                value: assets.length,
                color: "text-foreground",
              },
              {
                label: "Available",
                value: assets.filter((a) => a.available).length,
                color: "text-green-400",
              },
              {
                label: "On Rent",
                value: assets.filter((a) => !a.available).length,
                color: "text-amber-400",
              },
              {
                label: "Need Service",
                value: assets.filter((a) => a.condition === "NEEDS_REPAIR")
                  .length,
                color: "text-red-400",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="bg-card border border-border px-4 py-3 flex items-center justify-between"
              >
                <span className="text-xs text-muted-foreground" style={mono}>
                  {label}
                </span>
                <span
                  className={`text-2xl font-black ${color}`}
                  style={display}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Asset table */}
          {filteredAssets.length === 0 ? (
            <div className="bg-card border border-border p-16 text-center">
              <Wrench
                size={32}
                className="text-muted-foreground mx-auto mb-4 opacity-40"
              />
              <p className="text-foreground font-semibold mb-1">
                No assets found
              </p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        "",
                        "Asset",
                        "Serial No.",
                        "Category",
                        "Location",
                        "Daily Rate",
                        "Condition",
                        "Status",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap"
                          style={mono}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((a, i) => (
                      <tr
                        key={a.id}
                        className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                      >
                        <td className="pl-4 pr-2 py-3 w-14">
                          {a.photo ? (
                            <img
                              src={a.photo}
                              alt={a.name}
                              className="w-12 h-10 object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-10 bg-secondary border border-border flex items-center justify-center shrink-0">
                              <Truck
                                size={16}
                                className="text-muted-foreground opacity-40"
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">
                            {a.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {a.purchaseYear} · {a.capacity}t capacity
                          </p>
                        </td>
                        <td
                          className="px-4 py-3 text-xs text-muted-foreground"
                          style={mono}
                        >
                          {a.serialno}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {a.category}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {a.location}
                        </td>
                        <td
                          className="px-4 py-3 font-semibold text-foreground"
                          style={mono}
                        >
                          S${a.baseDailyRate.toLocaleString()}/day
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold border ${conditionColor(a.condition)}`}
                          >
                            {formatCondition(a.condition)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold border ${a.available ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}
                          >
                            {a.available ? "Available" : "On Rent"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingAsset(a);
                                setFormOpen(true);
                              }}
                              className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteId(a.id)}
                              className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground" style={mono}>
                  Showing {filteredAssets.length} of {assets.length} assets
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Reads any persisted session once at mount time: restores it (and primes the
// api client's auth token) if still valid, or reports the expired-notice text
// if it lapsed while the tab was closed. Runs as a useState lazy initializer
// rather than an effect since it's a synchronous derivation from sessionStorage,
// not a subscription to an external system.
function restoreSession(): {
  user: StoredSession | null;
  notice: string | null;
} {
  const stored = loadSession();
  if (!stored) return { user: null, notice: null };
  if (isExpired(stored)) {
    clearSession();
    return {
      user: null,
      notice: "Your session has expired. Please log in again.",
    };
  }
  setAuthToken(stored.token);
  return { user: stored, notice: null };
}

function viewForRole(role: Role): View {
  return role === "customer"
    ? "customer"
    : role === "admin"
      ? "admin"
      : "dashboard";
}

export default function App() {
  const [initialSession] = useState(restoreSession);
  const [view, setView] = useState<View>(
    initialSession.user ? viewForRole(initialSession.user.role) : "portal",
  );
  const [user, setUser] = useState<StoredSession | null>(initialSession.user);
  const [showLogin, setShowLogin] = useState(false);
  const [authOverlay, setAuthOverlay] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [sessionNotice, setSessionNotice] = useState<string | null>(
    initialSession.notice,
  );
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const equipmentRes = useApiResource((signal) => assetApi.list(undefined, signal));
  const equipment = equipmentRes.data ?? [];

  const scheduleExpiry = (session: StoredSession) => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = setTimeout(
      () => {
        clearSession();
        setAuthToken(null);
        setUser(null);
        setView("portal");
        setSessionNotice("Your session has expired. Please log in again.");
      },
      Math.max(0, session.expiresAt - Date.now()),
    );
  };

  // Auto-dismiss the notice a few seconds after it appears, whether it came
  // from the initial-mount restore or from the proactive timer above.
  useEffect(() => {
    if (!sessionNotice) return;
    const t = setTimeout(() => setSessionNotice(null), 3000);
    return () => clearTimeout(t);
  }, [sessionNotice]);

  // Restart the proactive expiry timer for a restored session's remaining TTL.
  useEffect(() => {
    if (initialSession.user) scheduleExpiry(initialSession.user);
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (role: Role, name: string, email: string) => {
    const started = Date.now();
    setAuthOverlay(true);
    setShowLogin(false);
    try {
      const resolveUserId = async (): Promise<number | null> => {
        try {
          const users = await userApi.list();
          return users.find((u) => u.email.toLowerCase() === email)?.id ?? null;
        } catch {
          // no linked account for this email — proceed with id: null (existing behavior)
          return null;
        }
      };
      let session: StoredSession;
      if (import.meta.env.MODE === "api") {
        const password = ACCOUNTS[email]?.password;
        const { accessToken, expiresIn } = await login(email, password);
        // Prime the api client with the real bearer token before calling any
        // other authenticated endpoint (e.g. userApi.list() below) — previously
        // that call fired before login() resolved and always 401'd.
        setAuthToken(accessToken);
        const id = await resolveUserId();
        const issuedAt = Date.now();
        session = {
          token: accessToken,
          id,
          name,
          role,
          issuedAt,
          expiresAt: issuedAt + expiresIn * 1000,
        };
      } else {
        const id = await resolveUserId();
        session = issueSession({ id, name, role });
      }
      const wait = Math.max(0, 500 - (Date.now() - started));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      saveSession(session);
      setAuthToken(session.token);
      setUser(session);
      scheduleExpiry(session);
      setView(viewForRole(role));
    } catch {
      setSessionNotice("Couldn't sign in. Please try again.");
    } finally {
      setAuthOverlay(false);
    }
  };
  const handleLogout = () => {
  if (import.meta.env.MODE === "api") {
    logout().catch(() => {
      // best-effort revoke — still clear the local session even if this fails
    });
  }
  if (expiryTimer.current) clearTimeout(expiryTimer.current);
  clearSession();
  setAuthToken(null);
  setUser(null);
  setView("portal");
};


  if (view === "customer" && user)
    return (
      <CartProvider>
        <CustomerPortal
          userName={user.name}
          userId={user.id}
          onLogout={handleLogout}
        />
      </CartProvider>
    );
  if (view === "dashboard" && user)
    return (
      <EmployeeDashboard
        userName={user.name}
        onLogout={handleLogout}
      />
    );
  if (view === "admin" && user)
    return (
      <AdminDashboard
        userName={user.name}
        onLogout={handleLogout}
      />
    );
  if (view === "safety") return <SafetyPage onHome={() => setView("portal")} />;
  if (view === "about") return <AboutPage onHome={() => setView("portal")} />;
  if (view === "projects")
    return <ProjectsPage onHome={() => setView("portal")} />;

  const categoryTiles = Array.from(
    new Set(equipment.map((e) => e.category)),
  ).map((cat) => {
    const first = equipment.find((e) => e.category === cat)!;
    return {
      label: cat,
      count: equipment.filter((e) => e.category === cat).length,
      img: first.img,
    };
  });
  const filters = [
    "All",
    ...Array.from(new Set(equipment.map((e) => e.category))),
  ];
  const filtered =
    activeFilter === "All"
      ? equipment
      : equipment.filter((e) => e.category === activeFilter);

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {showLogin && (
        <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />
      )}
      <AuthLoadingOverlay open={authOverlay} />
      {sessionNotice && (
        <div className="fixed top-4 right-4 z-50 bg-card border border-primary/40 px-4 py-3 text-sm text-foreground flex items-center gap-2 shadow-xl">
          <AlertTriangle size={15} className="text-primary shrink-0" />
          {sessionNotice}
        </div>
      )}

      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <span
            className="text-2xl font-black tracking-tight text-primary"
            style={display}
          >
            HEAVY<span className="text-foreground"> RENTAL</span>
          </span>
          <div className="hidden md:flex items-center gap-8">
            {["Equipment", "Projects", "Safety", "About"].map((l) => (
              <a
                key={l}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (l === "Equipment")
                    document
                      .getElementById("equipment-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  else if (l === "Projects") setView("projects");
                  else if (l === "Safety") setView("safety");
                  else if (l === "About") setView("about");
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {l}
              </a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 hover:border-primary/40 transition-all"
            >
              <User size={14} /> Sign In
            </button>
          </div>
          <button
            className="md:hidden text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-card border-t border-border px-6 py-4 flex flex-col gap-4">
            {["Equipment", "Projects", "Safety", "About"].map((l) => (
              <a
                key={l}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  if (l === "Equipment")
                    document
                      .getElementById("equipment-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  else if (l === "Projects") setView("projects");
                  else if (l === "Safety") setView("safety");
                  else if (l === "About") setView("about");
                }}
                className="text-sm text-muted-foreground"
              >
                {l}
              </a>
            ))}
            <button
              onClick={() => {
                setShowLogin(true);
                setMobileOpen(false);
              }}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold w-full"
            >
              Sign In
            </button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-end overflow-hidden pt-16">
        <div className="absolute inset-0 bg-background">
          <img
            src="https://images.unsplash.com/photo-1653315917834-04a6d84e132e?w=1800&h=1000&fit=crop&auto=format"
            alt="Excavator silhouetted at sunset"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pb-20 w-full">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-px w-8 bg-primary" />
              <span
                className="text-primary text-xs font-semibold tracking-widest uppercase"
                style={mono}
              >
                Heavy Equipment Rentals
              </span>
            </div>
            <h1
              className="text-6xl md:text-8xl font-black leading-none tracking-tight text-foreground mb-6"
              style={display}
            >
              THE RIGHT
              <br />
              MACHINE.
              <br />
              <span className="text-primary">RIGHT NOW.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed">
              Access over 1,200 pieces of certified heavy equipment —
              excavators, cranes, forklifts, and more — delivered to your
              jobsite within 48 hours.
            </p>
            <div className="flex items-center gap-6">
              {STATS.slice(0, 3).map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span
                    className="text-lg font-black text-primary"
                    style={display}
                  >
                    {s.value}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p
                className="text-primary text-xs font-semibold tracking-widest uppercase mb-2"
                style={mono}
              >
                Browse by Type
              </p>
              <h2
                className="text-4xl md:text-5xl font-black text-foreground"
                style={display}
              >
                OUR FLEET
              </h2>
            </div>
            <button
              onClick={() =>
                document
                  .getElementById("equipment-section")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="hidden md:flex items-center gap-2 text-sm text-primary hover:gap-3 transition-all duration-200"
            >
              View all equipment <ArrowRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categoryTiles.map((cat) => (
              <div
                key={cat.label}
                onClick={() => {
                  setActiveFilter(cat.label === "All" ? "All" : cat.label);
                  document
                    .getElementById("equipment-section")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group relative overflow-hidden cursor-pointer border border-border hover:border-primary/50 transition-all duration-300 bg-card"
              >
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={`https://images.unsplash.com/${cat.img}?w=400&h=300&fit=crop&auto=format`}
                    alt={cat.label}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p
                    className="text-base font-bold text-foreground leading-tight"
                    style={display}
                  >
                    {cat.label}
                  </p>
                  <p className="text-xs text-primary" style={mono}>
                    {cat.count} units
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Equipment preview */}
      <section
        id="equipment-section"
        className="py-20 bg-muted/30 border-t border-border"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <p
                className="text-primary text-xs font-semibold tracking-widest uppercase mb-2"
                style={mono}
              >
                Available Now
              </p>
              <h2
                className="text-4xl md:text-5xl font-black text-foreground"
                style={display}
              >
                FEATURED EQUIPMENT
              </h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all border ${activeFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group bg-card border border-border hover:border-primary/40 transition-all duration-300 flex flex-col"
              >
                <div className="relative aspect-video bg-muted overflow-hidden">
                  <img
                    src={`https://images.unsplash.com/${item.img}?w=600&h=340&fit=crop&auto=format`}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold border ${item.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                    >
                      {item.available ? "Available" : "Booked"}
                    </span>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <p
                    className="text-xs text-primary font-semibold tracking-widest uppercase mb-0.5"
                    style={mono}
                  >
                    {item.category}
                  </p>
                  <h3
                    className="font-black text-lg text-foreground leading-tight mb-3"
                    style={display}
                  >
                    {item.name}
                  </h3>
                  <div className="mt-auto flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        From / day
                      </p>
                      <p
                        className="text-2xl font-black text-foreground"
                        style={display}
                      >
                        S${item.baseDailyRate.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowLogin(true)}
                      className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-primary relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(0,0,0,.3) 40px,rgba(0,0,0,.3) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(0,0,0,.3) 40px,rgba(0,0,0,.3) 41px)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2
              className="text-4xl font-black text-primary-foreground leading-none"
              style={display}
            >
              READY TO RENT?
            </h2>
            <p className="text-primary-foreground/70 mt-1 text-sm">
              Sign in to book equipment, track orders, and manage your fleet.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setShowLogin(true)}
              className="px-6 py-3 bg-primary-foreground text-primary font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all"
            >
              Sign In as Customer
            </button>
            <button
              onClick={() => setShowLogin(true)}
              className="px-6 py-3 border-2 border-primary-foreground text-primary-foreground font-bold text-sm tracking-widest uppercase hover:bg-primary-foreground/10 transition-all"
            >
              Employee Login
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p
              className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
              style={mono}
            >
              Client Stories
            </p>
            <h2 className="text-5xl font-black text-foreground" style={display}>
              TRUSTED ON SITE
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className={`p-8 border flex flex-col ${i === 1 ? "bg-primary border-primary" : "bg-card border-border"}`}
              >
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star
                      key={si}
                      size={14}
                      className={
                        i === 1
                          ? "text-primary-foreground fill-primary-foreground"
                          : "text-primary fill-primary"
                      }
                    />
                  ))}
                </div>
                <p
                  className={`text-base leading-relaxed flex-1 mb-8 ${i === 1 ? "text-primary-foreground" : "text-foreground"}`}
                >
                  "{t.quote}"
                </p>
                <div>
                  <p
                    className={`font-black text-lg leading-tight ${i === 1 ? "text-primary-foreground" : "text-foreground"}`}
                    style={display}
                  >
                    {t.name}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${i === 1 ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {t.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <span
                className="text-3xl font-black tracking-tight text-primary mb-4 block"
                style={display}
              >
                HEAVY<span className="text-foreground"> RENTAL</span>
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-5">
                The industrial equipment rental platform for contractors who
                move fast.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="tel:+6562624200"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone size={14} className="text-primary" />
                  (+65) 6262 4200
                </a>
                <a
                  href="mailto:fleet@heavyrental.com"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail size={14} className="text-primary" />{" "}
                  fleet@heavyrental.com
                </a>
              </div>
            </div>
            {[
              {
                title: "Equipment",
                links: [
                  "Excavators",
                  "Cranes",
                  "Bulldozers",
                  "Forklifts",
                  "Dump Trucks",
                ],
              },
              {
                title: "Services",
                links: [
                  "Daily Rental",
                  "Long-Term Lease",
                  "Operator Supply",
                  "Maintenance",
                  "Transport",
                ],
              },
              {
                title: "Company",
                links: [
                  "About Us",
                  "Safety Standards",
                  "Certifications",
                  "Careers",
                  "Press",
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <p
                  className="text-xs font-semibold text-foreground tracking-widest uppercase mb-4"
                  style={mono}
                >
                  {col.title}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">
              © 2025 Heavy Rental. All rights reserved.
            </p>
            <div className="flex gap-6">
              {["Privacy", "Terms", "Insurance"].map((l) => (
                <a
                  key={l}
                  href="#"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
