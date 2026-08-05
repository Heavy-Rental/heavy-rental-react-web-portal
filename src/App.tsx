import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Calendar,
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
  MessageCircle,
  Send,
  User,
  LogOut,
  ShoppingCart,
  Trash2,
  Bot,
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
import { CustomerOnboarding } from "./app/CustomerOnboarding";
import { AdminDashboard, AssetFormModal } from "./app/AdminDashboard";
import { SafetyPage } from "./app/SafetyPage";
import { AboutPage } from "./app/AboutPage";
import { ProjectsPage } from "./app/ProjectsPage";
import type {
  Equipment as EquipmentItem,
  Depot,
  RentalPlan as ApiRentalPlan,
  Role,
  View,
  OnboardingMode,
  StoredSession,
} from "./app/types";
import {
  equipmentApi,
  depotApi,
  userApi,
  rentalPlanApi,
  bookingApi,
  monthlyUtilizationApi,
  statusDistributionApi,
  calcDeposit,
  calcFullPaymentDueDate,
  setAuthToken,
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
import stripeLogo from "./assets/stripe.svg";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface CartItem {
  equipment: EquipmentItem;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
}

interface ChatMessage {
  from: "bot" | "user";
  text: string;
}

// Client-local, shaped after the real Payment entity (SPEC-entity-repository.md) — never sent
// anywhere. Gives the simulated checkout success/failure UI a consistent, ERD-shaped structure.
interface SimulatedPayment {
  amount: number;
  paymentType: "DEPOSIT" | "BALANCE" | "FULL_PAYMENT";
  status: "PENDING" | "SUCCESS" | "FAIL";
  failureReason: string | null;
  paidAt: string | null;
  // Shaped like a real Stripe PaymentIntent id (Payment.stripe_payment_intent_id,
  // SPEC-entity-repository.md) so the UI has somewhere real to put it once a live
  // backend actually creates PaymentIntents — never sent anywhere today.
  stripePaymentIntentId: string;
}

// Client-side-only stand-in for a real Stripe PaymentIntent id (pi_xxx). Once a real
// backend integration exists, this is the exact value swapped for the id returned by
// POST /api/v1/payments/create-intent.
function generateFakePaymentIntentId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `pi_${hex}`;
}

interface RentalPlanItem {
  equipmentName: string;
  category: string;
  dailyRate: number;
  days: number;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
}

interface RentalPlan {
  id: string;
  paidAt: string;
  items: RentalPlanItem[];
  totalCost: number;
  depositPaid: number;
  balanceDue: number;
  status: "Active" | "Completed";
}

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

const STATS = [
  { value: "1,200+", label: "Equipment Units" },
  { value: "98%", label: "On-Time Delivery" },
  { value: "340+", label: "Active Clients" },
  { value: "24/7", label: "Support Available" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
// Cart/booking dates are stored as plain ISO "YYYY-MM-DD" strings (matching Booking.startDate/
// endDate's own convention) rather than a day-of-month + single month/year triple — that older
// shape couldn't represent a range crossing a month boundary (e.g. Aug 18 – Sep 18).

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
function formatDateLong(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}
function formatDateShort(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}
function daysBetweenISO(startISO: string, endISO: string): number {
  return (
    Math.round(
      (parseISODate(endISO).getTime() - parseISODate(startISO).getTime()) /
        86400000,
    ) + 1
  );
}
// "Aug 18–22, 2026" when same month, "Aug 18 – Sep 18, 2026" across months, full dates on both ends across years.
function formatDateRange(startISO: string, endISO: string): string {
  const s = parseISODate(startISO),
    e = parseISODate(endISO);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${formatDateShort(startISO)} – ${formatDateShort(endISO)}, ${e.getFullYear()}`;
  }
  return `${formatDateLong(startISO)} – ${formatDateLong(endISO)}`;
}

// ─── CHATBOT LOGIC ────────────────────────────────────────────────────────────

type ChatStep = "greeting" | "task" | "load" | "location" | "result";
interface ChatState {
  step: ChatStep;
  task: string;
  load: number | null;
  location: string;
}

function getBotResponse(
  state: ChatState,
  userInput: string,
  equipment: EquipmentItem[],
): {
  reply: string;
  nextState: ChatState;
  suggestions?: string[];
  recommended?: EquipmentItem[];
} {
  if (state.step === "greeting") {
    return {
      reply:
        "Great! What kind of work are you planning? For example: excavation, lifting, grading, warehouse, or aerial work.",
      nextState: { ...state, step: "task" },
      suggestions: [
        "Excavation / Trenching",
        "Elevated / Boom work",
        "Indoor / Compact access",
        "Warehouse / Material handling",
        "Demolition",
      ],
    };
  }
  if (state.step === "task") {
    return {
      reply:
        "Got it. What's the approximate load or material weight you need to handle?",
      nextState: { ...state, step: "load", task: userInput },
      suggestions: [
        "Under 2 tons",
        "2–20 tons",
        "20–50 tons",
        "50–100 tons",
        "Not sure",
      ],
    };
  }
  if (state.step === "load") {
    const input = userInput.toLowerCase();
    let loadNum: number | null = null;
    if (input.includes("under 2") || input.includes("1 ton")) loadNum = 1.5;
    else if (input.includes("2") && input.includes("20")) loadNum = 10;
    else if (input.includes("20") && input.includes("50")) loadNum = 30;
    else if (input.includes("50") || input.includes("100")) loadNum = 80;
    return {
      reply: "Almost there — which city or region is your jobsite in?",
      nextState: { ...state, step: "location", load: loadNum },
      suggestions: ["Jurong Port", "Pioneer", "Tuas", "Marina South", "Other"],
    };
  }
  if (state.step === "location") {
    const task = state.task.toLowerCase();
    const load = state.load;
    const scored = equipment
      .map((e) => ({
        ...e,
        score:
          e.idealFor.reduce((s, kw) => s + (task.includes(kw) ? 3 : 0), 0) +
          (load !== null && e.capacity >= load ? 2 : 0) +
          (e.available ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    return {
      reply: `Based on your project in ${userInput}, here are my top recommendations:`,
      nextState: { ...state, step: "result", location: userInput },
      recommended: scored.slice(0, 2),
    };
  }
  return {
    reply: "Would you like to start over and find a different machine?",
    nextState: { step: "greeting", task: "", load: null, location: "" },
    suggestions: ["Start over"],
  };
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

const mono = { fontFamily: "'DM Mono', monospace" } as const;
const display = { fontFamily: "'Barlow Condensed', sans-serif" } as const;
const sans = { fontFamily: "'DM Sans', sans-serif" } as const;

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
  onLogin: (role: Role, name: string, email: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.toLowerCase().trim();
    const account = ACCOUNTS[normalizedEmail];
    if (!account || password !== account.password) {
      setError("Invalid email or password.");
      return;
    }
    onLogin(account.role, account.name, normalizedEmail);
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

// ─── SHARED DATE-RANGE BAR ────────────────────────────────────────────────────
// Hotel/flight-style: dates are chosen once here, every "Select" button across the
// portal (catalog grid, equipment detail page) reuses the same shared selection so
// every item in a booking shares one date range (Spec-ui-heavy-machinery-portal.md §4.3).

function DateRangeBar({
  sharedStartDate,
  sharedEndDate,
  sharedMonth,
  sharedYear,
  setSharedStartDate,
  setSharedEndDate,
  setSharedMonth,
  setSharedYear,
  dateBarOpen,
  setDateBarOpen,
  locked,
  highlight,
}: {
  sharedStartDate: string | null;
  sharedEndDate: string | null;
  sharedMonth: number;
  sharedYear: number;
  setSharedStartDate: (d: string | null) => void;
  setSharedEndDate: (d: string | null) => void;
  setSharedMonth: React.Dispatch<React.SetStateAction<number>>;
  setSharedYear: React.Dispatch<React.SetStateAction<number>>;
  dateBarOpen: boolean;
  setDateBarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  locked: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`mb-8 bg-card border font-sans transition-shadow ${highlight ? "border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.25)] animate-pulse" : "border-border"}`}
    >
      {highlight && (
        <p className="px-5 pt-3 text-xs font-semibold text-amber-400 flex items-center gap-1.5">
          <Calendar size={12} /> Pick your rental dates to finish adding these
          to your plan
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <button
          type="button"
          disabled={locked}
          onClick={() => setDateBarOpen((o) => !o)}
          className="flex-1 min-w-64 flex items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60 group"
        >
          <Calendar size={16} className="text-primary shrink-0" />
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div
              className={`rounded-lg border px-4 py-2.5 transition-colors ${!sharedStartDate ? "border-amber-500/60 bg-amber-500/5" : "border-border group-hover:border-amber-500/40"}`}
            >
              <p className="text-[11px] text-muted-foreground tracking-wide uppercase">
                Start Date
              </p>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {sharedStartDate
                  ? formatDateLong(sharedStartDate)
                  : "Select date"}
              </p>
            </div>
            <div
              className={`rounded-lg border px-4 py-2.5 transition-colors ${sharedStartDate && !sharedEndDate ? "border-amber-500/60 bg-amber-500/5" : "border-border group-hover:border-amber-500/40"}`}
            >
              <p className="text-[11px] text-muted-foreground tracking-wide uppercase">
                End Date
              </p>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {sharedEndDate ? formatDateLong(sharedEndDate) : "Select date"}
              </p>
            </div>
          </div>
        </button>
        {locked ? (
          <p className="text-xs text-muted-foreground max-w-xs">
            Dates are locked to your cart's current selection — remove all items
            to change them.
          </p>
        ) : (
          sharedStartDate &&
          sharedEndDate && (
            <button
              type="button"
              onClick={() => {
                setSharedStartDate(null);
                setSharedEndDate(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear dates
            </button>
          )
        )}
      </div>

      {dateBarOpen &&
        !locked &&
        (() => {
          const prevMonth = () => {
            if (sharedMonth === 0) {
              setSharedMonth(11);
              setSharedYear((y) => y - 1);
            } else setSharedMonth((m) => m - 1);
          };
          const nextMonth = () => {
            if (sharedMonth === 11) {
              setSharedMonth(0);
              setSharedYear((y) => y + 1);
            } else setSharedMonth((m) => m + 1);
          };

          // Selection compares real ISO dates (not just day-of-month numbers scoped to one
          // "active" month), so picking a start in one visible month and an end in the other —
          // or navigating further before picking the end — genuinely spans a month boundary
          // (e.g. Aug 18 – Sep 18) instead of being forced into a single month.
          const handleDayClick = (month: number, year: number, d: number) => {
            const clicked = toISODate(year, month, d);
            if (!sharedStartDate || (sharedStartDate && sharedEndDate)) {
              setSharedStartDate(clicked);
              setSharedEndDate(null);
            } else if (clicked < sharedStartDate) {
              setSharedStartDate(clicked);
            } else {
              setSharedEndDate(clicked);
            }
          };

          const renderMonth = (
            month: number,
            year: number,
            nav: "prev" | "next" | null,
          ) => {
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const dayClass = (d: number) => {
              const iso = toISODate(year, month, d);
              const isStart = iso === sharedStartDate;
              const isEnd = iso === sharedEndDate;
              const inRange = !!(
                sharedStartDate &&
                sharedEndDate &&
                iso > sharedStartDate &&
                iso < sharedEndDate
              );
              if (isStart || isEnd) {
                const singleDay =
                  (isStart && isEnd) || (isStart && !sharedEndDate);
                return `bg-amber-500 text-black font-semibold ${singleDay ? "rounded-md" : isStart ? "rounded-l-md rounded-r-none" : "rounded-r-md rounded-l-none"}`;
              }
              if (inRange)
                return "bg-amber-500/15 text-foreground rounded-none";
              return "text-foreground hover:bg-amber-500/20 hover:text-amber-400 rounded-md";
            };
            return (
              <div key={`${year}-${month}`} className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  {nav === "prev" ? (
                    <button
                      onClick={prevMonth}
                      className="p-1 border border-border hover:border-amber-500/50 hover:text-amber-400 text-muted-foreground transition-colors rounded-md"
                    >
                      <ChevronLeft size={13} />
                    </button>
                  ) : (
                    <span className="w-[26px]" />
                  )}
                  <span className="text-sm font-semibold text-foreground tracking-wide">
                    {MONTH_NAMES[month]} {year}
                  </span>
                  {nav === "next" ? (
                    <button
                      onClick={nextMonth}
                      className="p-1 border border-border hover:border-amber-500/50 hover:text-amber-400 text-muted-foreground transition-colors rounded-md"
                    >
                      <ChevronRight size={13} />
                    </button>
                  ) : (
                    <span className="w-[26px]" />
                  )}
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[11px] text-muted-foreground tracking-wide py-1"
                    >
                      {d[0]}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    return (
                      <button
                        key={d}
                        onClick={() => handleDayClick(month, year, d)}
                        className={`w-9 h-9 flex items-center justify-center text-sm font-medium transition-colors duration-100 mx-auto ${dayClass(d)}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          };

          const month2 = sharedMonth === 11 ? 0 : sharedMonth + 1;
          const year2 = sharedMonth === 11 ? sharedYear + 1 : sharedYear;

          return (
            <div className="border-t border-border p-5">
              <div className="flex flex-col sm:flex-row gap-8">
                {renderMonth(sharedMonth, sharedYear, "prev")}
                {renderMonth(month2, year2, "next")}
              </div>
              <div className="flex justify-end pt-4 mt-4 border-t border-border">
                <button
                  type="button"
                  disabled={!sharedStartDate || !sharedEndDate}
                  onClick={() => setDateBarOpen(false)}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Done
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ─── SITE ADDRESS MODAL ─────────────────────────────────────────────────────────
// Captured once per cart, right after the first successful "Select" (Spec-frontend-ui-changes.md
// Screen 6) — maps to Booking.siteAddress/sitePostalCode/deliveryNotes.

function SiteAddressModal({
  address,
  postalCode,
  notes,
  onClose,
  onSave,
}: {
  address: string;
  postalCode: string;
  notes: string;
  onClose: () => void;
  onSave: (address: string, postalCode: string, notes: string) => void;
}) {
  const [form, setForm] = useState({ address, postalCode, notes });
  const [error, setError] = useState<string | null>(null);
  const postalRe = /^S\(\d{6}\)$/;

  const handleSave = () => {
    if (!form.address.trim()) {
      setError("Site address is required.");
      return;
    }
    if (!postalRe.test(form.postalCode.trim())) {
      setError("Postal code must be in the format S(XXXXXX).");
      return;
    }
    setError(null);
    onSave(form.address.trim(), form.postalCode.trim(), form.notes.trim());
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
            covers the whole booking.
          </p>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Address<span className="text-primary ml-0.5">*</span>
            </label>
            <input
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              placeholder="e.g. 20 Jurong Port Road"
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Postal Code<span className="text-primary ml-0.5">*</span>
            </label>
            <input
              value={form.postalCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, postalCode: e.target.value }))
              }
              placeholder="S(619094)"
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors"
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

// ─── CHATBOT ──────────────────────────────────────────────────────────────────

function Chatbot({
  onSelectEquipment,
  equipment,
}: {
  onSelectEquipment: (e: EquipmentItem) => void;
  equipment: EquipmentItem[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      from: "bot",
      text: "Hi! I'm your equipment assistant. I can help you find the right machine for your job. Ready to get started?",
    },
  ]);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<ChatState>({
    step: "greeting",
    task: "",
    load: null,
    location: "",
  });
  const [suggestions, setSuggestions] = useState<string[]>([
    "Yes, help me find equipment!",
  ]);
  const [recommended, setRecommended] = useState<EquipmentItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const {
      reply,
      nextState,
      suggestions: nextSugg,
      recommended: rec,
    } = getBotResponse(chatState, text, equipment);
    setMessages((prev) => [
      ...prev,
      { from: "user", text },
      { from: "bot", text: reply },
    ]);
    setChatState(nextState);
    setSuggestions(nextSugg ?? []);
    setRecommended(rec ?? []);
    setInput("");
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center shadow-2xl hover:brightness-110 transition-all duration-200"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 bg-card border border-border shadow-2xl flex flex-col"
          style={{ height: 480, ...sans }}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
            <div className="w-8 h-8 bg-primary flex items-center justify-center">
              <Bot size={16} className="text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground" style={display}>
                EQUIPMENT ASSISTANT
              </p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />{" "}
                Online
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.from === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-6 h-6 flex items-center justify-center shrink-0 ${m.from === "bot" ? "bg-primary" : "bg-secondary"}`}
                >
                  {m.from === "bot" ? (
                    <Bot size={13} className="text-primary-foreground" />
                  ) : (
                    <User size={13} className="text-muted-foreground" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] px-3 py-2 text-xs leading-relaxed ${m.from === "bot" ? "bg-secondary/60 text-foreground" : "bg-primary text-primary-foreground"}`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {recommended.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                {recommended.map((eq) => (
                  <div
                    key={eq.id}
                    className="border border-border bg-secondary/40 p-3"
                  >
                    <p
                      className="text-xs font-black text-foreground mb-0.5"
                      style={display}
                    >
                      {eq.name}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      S${eq.baseDailyRate.toLocaleString()}/day · {eq.category}
                    </p>
                    <button
                      onClick={() => {
                        onSelectEquipment(eq);
                        setOpen(false);
                      }}
                      className="w-full py-1.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all"
                    >
                      Select This Machine
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setChatState({
                      step: "greeting",
                      task: "",
                      load: null,
                      location: "",
                    });
                    setSuggestions(["Yes, help me find equipment!"]);
                    setRecommended([]);
                    setMessages((prev) => [
                      ...prev,
                      { from: "bot", text: "No problem! Let's start over." },
                    ]);
                  }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors text-center py-1"
                >
                  Start over →
                </button>
              </div>
            )}
            {suggestions.length > 0 && recommended.length === 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-2.5 py-1 border border-primary/40 text-xs text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-150"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border flex items-center gap-2 px-3 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Type a message…"
              className="flex-1 bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none"
            />
            <button
              onClick={() => send(input)}
              className="w-7 h-7 bg-primary flex items-center justify-center hover:brightness-110 transition-all"
            >
              <Send size={13} className="text-primary-foreground" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── CUSTOMER PORTAL ──────────────────────────────────────────────────────────

// Spec-ui-heavy-machinery-portal.md §4.3: all equipment in one booking must share a
// single start/end date — the cart lets each item pick its own range, so checkout
// collapses it to the widest covering range (earliest start / latest end).
function cartDateRange(cart: CartItem[]): {
  startDate: string;
  endDate: string;
} {
  // ISO "YYYY-MM-DD" strings sort correctly with plain string comparison — no Date math needed.
  return {
    startDate: cart.reduce(
      (min, c) => (c.startDate < min ? c.startDate : min),
      cart[0].startDate,
    ),
    endDate: cart.reduce(
      (max, c) => (c.endDate > max ? c.endDate : max),
      cart[0].endDate,
    ),
  };
}

function resolveCartDepotId(cart: CartItem[], depots: Depot[]): number {
  const locations = new Set(cart.map((c) => c.equipment.location));
  if (locations.size !== 1) {
    throw new Error(
      "Equipment in your cart is spread across multiple depots — a booking can only be fulfilled from one depot.",
    );
  }
  const depot = depots.find((d) => d.name === cart[0].equipment.location);
  if (!depot)
    throw new Error(
      `No depot matches location "${cart[0].equipment.location}".`,
    );
  return depot.id;
}

function buildRentalPlanViews(
  apiPlans: ApiRentalPlan[],
  equipment: EquipmentItem[],
  userId: number,
): RentalPlan[] {
  return apiPlans
    .filter((p) => p.userId === userId)
    .map((p) => {
      const items: RentalPlanItem[] = p.items.map((i) => {
        const eq = equipment.find((e) => e.id === i.equipmentId);
        return {
          equipmentName: eq?.name ?? `Equipment #${i.equipmentId}`,
          category: eq?.category ?? "",
          dailyRate: eq?.baseDailyRate ?? 0,
          days: daysBetweenISO(i.startDate, i.endDate),
          startDate: i.startDate,
          endDate: i.endDate,
        };
      });
      const totalCost = items.reduce((s, it) => s + it.dailyRate * it.days, 0);
      const depositPaid = calcDeposit(totalCost);
      return {
        id: `RNT-${String(p.id).padStart(4, "0")}`,
        paidAt: new Date(p.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        items,
        totalCost,
        depositPaid,
        balanceDue: totalCost - depositPaid,
        status: (p.status === "active"
          ? "Active"
          : "Completed") as RentalPlan["status"],
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

function CustomerPortal({
  userName,
  userId,
  onLogout,
  onHome,
}: {
  userName: string;
  userId: number | null;
  onLogout: () => void;
  onHome: () => void;
}) {
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>(null);
  const [specsRecs, setSpecsRecs] = useState<EquipmentItem[]>([]);
  // Equipment queued from "Add All to Rental Plan" waiting on the shared date bar — auto-added
  // to the cart the moment both dates are picked (see the effect below); highlights the bar
  // in the meantime so it's obvious what the user still needs to do.
  const [pendingAutoAdd, setPendingAutoAdd] = useState<EquipmentItem[] | null>(
    null,
  );
  const [cart, setCart] = useState<CartItem[]>([]);
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
  const [cartOpen, setCartOpen] = useState(false);
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

  const equipmentRes = useApiResource(() => equipmentApi.list());
  const equipment = useMemo(() => equipmentRes.data ?? [], [equipmentRes.data]);
  const depotsRes = useApiResource(() => depotApi.list());
  const depots = depotsRes.data ?? [];
  const rentalPlansRes = useApiResource(() => rentalPlanApi.list());
  const rentalPlans = useMemo(
    () =>
      rentalPlansRes.status === "success" && userId !== null
        ? buildRentalPlanViews(rentalPlansRes.data, equipment, userId)
        : [],
    [rentalPlansRes.status, rentalPlansRes.data, equipment, userId],
  );

  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [specUploadOpen, setSpecUploadOpen] = useState(false);

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
    setCart((prev) => {
      const merged = [...prev];
      for (const eq of pendingAutoAdd) {
        const idx = merged.findIndex((c) => c.equipment.id === eq.id);
        const item: CartItem = { equipment: eq, startDate, endDate };
        if (idx >= 0) merged[idx] = item;
        else merged.push(item);
      }
      return merged;
    });
    setCartOpen(true);
    setCartDateError(null);
    setPendingAutoAdd(null);
    if (!siteAddressPrompted) {
      setSiteAddressPrompted(true);
      setSiteAddressModalOpen(true);
    }
  };

  if (!onboardingMode) {
    return (
      <CustomerOnboarding
        userName={userName}
        onDone={(mode, recs) => {
          setOnboardingMode(mode);
          if (recs) {
            setSpecsRecs(recs);
            setPendingAutoAdd(recs);
            setDateBarOpen(true);
          }
        }}
      />
    );
  }

  if (specUploadOpen) {
    return (
      <CustomerOnboarding
        userName={userName}
        initialStep="upload"
        onDone={(mode, recs) => {
          setSpecUploadOpen(false);
          setOnboardingMode(mode);
          if (recs) {
            setSpecsRecs(recs);
            setPendingAutoAdd(recs);
            setDateBarOpen(true);
          }
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

  const filters = [
    "All",
    ...Array.from(new Set(equipment.map((e) => e.category))),
  ];
  const filtered = equipment.filter(
    (e) => activeFilter === "All" || e.category === activeFilter,
  );
  const totalCost = cart.reduce(
    (s, c) =>
      s + daysBetweenISO(c.startDate, c.endDate) * c.equipment.baseDailyRate,
    0,
  );

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
    setCart((prev) => [
      ...prev.filter((c) => c.equipment.id !== item.equipment.id),
      item,
    ]);
    setCartOpen(true);
    if (!siteAddressPrompted) {
      setSiteAddressPrompted(true);
      setSiteAddressModalOpen(true);
    }
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

  if (confirmed && confirmedOrder) {
    const {
      items: confirmedItems,
      totalCost: confirmedTotal,
      depositPaid,
    } = confirmedOrder;
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
              Deposit Received · Equipment Held
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
                  Deposit Paid (30%)
                </span>
                <span className="font-black text-green-400" style={mono}>
                  −S${depositPaid.toLocaleString()}
                </span>
              </div>
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
                {
                  step: "03",
                  text: "Remaining balance collected on equipment delivery. Cash, card, or bank transfer accepted.",
                },
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
            onClick={() => {
              setConfirmed(false);
              setConfirmedOrder(null);
            }}
            className="w-full py-3 bg-primary text-primary-foreground font-bold text-sm tracking-widest uppercase hover:brightness-110 transition-all"
          >
            Browse More Equipment
          </button>
        </div>
      </div>
    );
  }

  // ── RENTAL PLAN DETAIL PAGE ──────────────────────────────────────────────────
  if (selectedPlan) {
    const plan = selectedPlan;
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
              onClick={() => setSelectedPlan(null)}
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
            onClick={() => setSelectedPlan(null)}
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
              <p
                className="text-3xl font-black text-foreground"
                style={display}
              >
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
                    <span
                      className="font-semibold text-foreground"
                      style={mono}
                    >
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
                  <span
                    className="text-lg font-black text-foreground"
                    style={display}
                  >
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
              onClick={() => setSelectedPlan(null)}
              className="px-5 py-2 border border-border text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              Back to Profile
            </button>
          </div>
        </div>
      </div>
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
            onClick={onHome}
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
    const SPEC_ROWS: [string, string][] = [
      ["Category", detailItem.category],
      ["Purchase Year", String(detailItem.purchaseYear)],
      ["Max Capacity", `${detailItem.capacity} tonnes`],
      ["Location", detailItem.location],
      ["Base Daily Rate", `S$${detailItem.baseDailyRate.toLocaleString()}`],
      ["Weekly Rate", `S$${detailItem.weekly.toLocaleString()}`],
      [
        "Availability",
        detailItem.available ? "Available Now" : "Currently On Rent",
      ],
    ];
    return (
      <div className="min-h-screen bg-background text-foreground" style={sans}>
        {/* Nav */}
        <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
            <button
              onClick={onHome}
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
                  src={`https://images.unsplash.com/${detailItem.img}?w=900&h=520&fit=crop&auto=format`}
                  alt={detailItem.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <span
                    className={`px-2.5 py-1 text-xs font-bold border ${detailItem.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                  >
                    {detailItem.available ? "● Available" : "● On Rent"}
                  </span>
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
                      src={`https://images.unsplash.com/${detailItem.img}${q}&auto=format`}
                      alt=""
                      className="w-full h-full object-cover"
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
                  {detailItem.idealFor.map((use) => (
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
                      S${detailItem.weekly.toLocaleString()}
                    </p>
                    <p className="text-xs text-green-400 mt-0.5">
                      Save{" "}
                      {Math.round(
                        (1 -
                          detailItem.weekly / (detailItem.baseDailyRate * 7)) *
                          100,
                      )}
                      % vs daily
                    </p>
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
                  {detailItem.tags.map((tag) => (
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
                {!detailItem.available && (
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
            onClick={onHome}
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
              ? "Matched from your uploaded specs. Set your dates below, then select any machine to add it to your cart."
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
            postalCode={sitePostalCode}
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
              {specsRecs.map((eq, i) => (
                <div
                  key={eq.id}
                  className={`flex items-center gap-3 p-3 bg-card border ${i === 0 ? "border-primary/50" : "border-border"}`}
                >
                  <div className="w-14 h-14 bg-muted overflow-hidden shrink-0">
                    <img
                      src={`https://images.unsplash.com/${eq.img}?w=120&h=120&fit=crop&auto=format`}
                      alt={eq.name}
                      className="w-full h-full object-cover opacity-80"
                    />
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
                    onClick={() =>
                      sharedStartDate &&
                      sharedEndDate &&
                      addToCart({
                        equipment: eq,
                        startDate: sharedStartDate,
                        endDate: sharedEndDate,
                      })
                    }
                    title={
                      !sharedStartDate || !sharedEndDate
                        ? "Set your dates in the bar above first"
                        : undefined
                    }
                    className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6 items-start">
          {/* Equipment grid */}
          <div className="flex-1 min-w-0">
            {/* Category filters */}
            <div className="flex gap-2 flex-wrap mb-6">
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
            {/* Result count */}
            {activeFilter !== "All" && (
              <p className="text-xs text-muted-foreground mb-4" style={mono}>
                {filtered.length} result{filtered.length !== 1 ? "s" : ""} in{" "}
                <span className="text-foreground">{activeFilter}</span>
                <button
                  onClick={() => setActiveFilter("All")}
                  className="ml-2 text-primary hover:text-primary/80 underline underline-offset-2"
                >
                  clear
                </button>
              </p>
            )}
            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="py-20 text-center border border-dashed border-border">
                <Search
                  size={28}
                  className="text-muted-foreground mx-auto mb-3 opacity-40"
                />
                <p className="font-semibold text-foreground mb-1">
                  No equipment found
                </p>
                <p className="text-sm text-muted-foreground">
                  Try a different category.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((item) => {
                const inCart = cart.some((c) => c.equipment.id === item.id);
                return (
                  <div
                    key={item.id}
                    className={`group bg-card border flex flex-col transition-all duration-300 ${highlightId === item.id ? "border-primary shadow-lg shadow-primary/10" : inCart ? "border-primary/40" : "border-border hover:border-primary/30"}`}
                  >
                    {/* Clickable image area → detail page */}
                    <button
                      onClick={() => setDetailItem(item)}
                      className="relative aspect-video bg-muted overflow-hidden text-left w-full"
                    >
                      <img
                        src={`https://images.unsplash.com/${item.img}?w=600&h=340&fit=crop&auto=format`}
                        alt={item.name}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-black/70 text-white text-xs font-bold tracking-widest uppercase px-4 py-2 border border-white/20">
                          View Details
                        </span>
                      </div>
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold border ${item.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                        >
                          {item.available ? "Available" : "Booked"}
                        </span>
                        {inCart && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">
                            In Cart
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="p-4 flex flex-col flex-1">
                      <p
                        className="text-xs text-primary font-semibold tracking-widest uppercase mb-0.5"
                        style={mono}
                      >
                        {item.category}
                      </p>
                      <button
                        onClick={() => setDetailItem(item)}
                        className="text-left"
                      >
                        <h3
                          className="font-black text-lg text-foreground leading-tight mb-1 hover:text-primary transition-colors"
                          style={display}
                        >
                          {item.name}
                        </h3>
                      </button>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                        {item.desc}
                      </p>
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {[
                          `${item.capacity}t`,
                          `${item.purchaseYear}`,
                          item.location.split(",")[0],
                        ].map((t) => (
                          <span
                            key={t}
                            className="text-xs px-2 py-0.5 bg-secondary/60 text-muted-foreground"
                            style={mono}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-2">
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
                        <div className="flex flex-col gap-1.5 items-end">
                          <button
                            disabled={
                              !item.available ||
                              !sharedStartDate ||
                              !sharedEndDate
                            }
                            onClick={() =>
                              sharedStartDate &&
                              sharedEndDate &&
                              addToCart({
                                equipment: item,
                                startDate: sharedStartDate,
                                endDate: sharedEndDate,
                              })
                            }
                            title={
                              !sharedStartDate || !sharedEndDate
                                ? "Set your dates in the bar above first"
                                : undefined
                            }
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Select
                          </button>
                          <button
                            onClick={() => setDetailItem(item)}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                          >
                            View full details →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart */}
          {cartOpen && (
            <div className="w-72 shrink-0 bg-card border border-border sticky top-20">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p
                  className="font-black text-foreground text-lg"
                  style={display}
                >
                  RENTAL PLAN
                </p>
                <button
                  onClick={() => setCartOpen(false)}
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
                            onClick={() =>
                              setCart((prev) =>
                                prev.filter(
                                  (x) => x.equipment.id !== c.equipment.id,
                                ),
                              )
                            }
                            className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {formatDateRange(c.startDate, c.endDate)} ·{" "}
                          {daysBetweenISO(c.startDate, c.endDate)} days
                        </p>
                        <p
                          className="text-sm font-bold text-primary"
                          style={mono}
                        >
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
                        onClick={() => setSiteAddressModalOpen(true)}
                        className="text-xs text-primary hover:text-primary/80 underline underline-offset-2"
                      >
                        {siteAddress ? "Edit" : "Add"}
                      </button>
                    </div>
                    <p className="text-xs text-foreground mb-3 leading-relaxed">
                      {siteAddress
                        ? `${siteAddress}, ${sitePostalCode}`
                        : "No delivery address set yet."}
                    </p>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">
                        Total Estimate
                      </span>
                      <span
                        className="text-xl font-black text-foreground"
                        style={display}
                      >
                        S${totalCost.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setCartOpen(false);
                        setCheckoutOpen(true);
                        setPaymentIntentId(generateFakePaymentIntentId());
                      }}
                      className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
                    >
                      Proceed to Deposit
                    </button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      30% deposit required to hold your reservation.
                    </p>
                  </div>
                </>
              )}
            </div>
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
          onPaid={async () => {
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

// ─── EMPLOYEE DASHBOARD ───────────────────────────────────────────────────────

// ─── DEPOSIT CHECKOUT ─────────────────────────────────────────────────────────

function CheckoutInputField({
  label,
  value,
  onChange,
  placeholder,
  maxLen,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLen?: number;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLen}
        className={`w-full bg-secondary/50 border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors ${error ? "border-red-500/60" : "border-border"}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function DepositCheckout({
  cart,
  totalCost,
  userName,
  paymentIntentId,
  onClose,
  onPaid,
}: {
  cart: CartItem[];
  totalCost: number;
  userName: string;
  paymentIntentId: string;
  onClose: () => void;
  onPaid: () => Promise<void>;
}) {
  const deposit = Math.round(totalCost * 0.3);
  const [step, setStep] = useState<
    "summary" | "payment" | "processing" | "failed"
  >("summary");
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
    if (payMethod === "card" && digits === "4000000000000002") {
      setTimeout(() => {
        setPayment({
          amount: deposit,
          paymentType: "DEPOSIT",
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
        await onPaid();
        setPayment({
          amount: deposit,
          paymentType: "DEPOSIT",
          status: "SUCCESS",
          failureReason: null,
          paidAt: new Date().toISOString(),
          stripePaymentIntentId: paymentIntentId,
        });
      } catch (err) {
        setPayment({
          amount: deposit,
          paymentType: "DEPOSIT",
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
        {step === "processing" && (
          <div className="absolute inset-0 bg-card/95 z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-foreground">
              Processing your deposit…
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
              {step === "summary"
                ? "Step 1 of 2 · Review"
                : "Step 2 of 2 · Payment"}
            </p>
            <h2 className="text-2xl font-black text-foreground" style={display}>
              {step === "summary" ? "BOOKING SUMMARY" : "PAY DEPOSIT"}
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
              <div className="px-4 py-3 border-b border-border">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
                  style={mono}
                >
                  Reserved Equipment
                </p>
              </div>
              <div className="divide-y divide-border">
                {cart.map((c) => {
                  const days = daysBetweenISO(c.startDate, c.endDate);
                  return (
                    <div
                      key={c.equipment.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">
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
                        S${(days * c.equipment.baseDailyRate).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cost breakdown — GST is display-only, computed client-side, never sent to the API;
                deposit stays 30% of the pre-GST subtotal (Spec-ui-heavy-machinery-portal.md §4.4) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground" style={mono}>
                  S${totalCost.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">GST (9%)</span>
                <span className="font-semibold text-foreground" style={mono}>
                  S${Math.round(totalCost * 0.09).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pb-2 border-b border-border">
                <span className="text-foreground font-semibold">
                  Total Payable
                </span>
                <span className="font-semibold text-foreground" style={mono}>
                  S${Math.round(totalCost * 1.09).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pb-2 border-b border-border">
                <span className="text-muted-foreground">
                  Balance due upon mobilisation/completion
                </span>
                <span className="font-semibold text-foreground" style={mono}>
                  S${(Math.round(totalCost * 1.09) - deposit).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Deposit Due Now
                  </p>
                  <p className="text-xs text-muted-foreground">
                    30% of subtotal (pre-GST) — holds your reservation
                  </p>
                </div>
                <p className="text-3xl font-black text-primary" style={display}>
                  S${deposit.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 px-4 py-3 flex gap-3">
              <CheckCircle size={15} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your equipment will be held exclusively for you once your
                deposit is confirmed. The remaining balance is due on the day of
                delivery.
              </p>
            </div>

            <button
              onClick={() => setStep("payment")}
              className="w-full py-3 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              Continue to Payment →
            </button>
          </div>
        )}

        {/* Step 2 — Payment */}
        {step === "payment" && (
          <div className="p-6 flex flex-col gap-5">
            {/* Deposit badge */}
            <div className="flex items-center justify-between bg-secondary/40 border border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">Amount to pay now</p>
              <p className="text-2xl font-black text-primary" style={display}>
                S${deposit.toLocaleString()}
              </p>
            </div>

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
                  <span className="text-foreground font-semibold" style={mono}>
                    201847362K
                  </span>
                </p>
                <p className="text-xs text-muted-foreground pt-2 border-t border-border w-full">
                  Confirm once you've completed the transfer in your banking
                  app. Your reservation will be activated once payment clears.
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
                  ? `Pay S$${deposit.toLocaleString()} Deposit`
                  : "Confirm PayNow Payment"}
              </button>
            </div>
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

// ─── EMPLOYEE DASHBOARD ─────────────────────────────────────────────────────

function EmployeeDashboard({
  userName,
  onLogout,
  onHome,
}: {
  userName: string;
  onLogout: () => void;
  onHome: () => void;
}) {
  const [tab, setTab] = useState<"dashboard" | "assets">("dashboard");
  const equipmentRes = useApiResource(() => equipmentApi.list());
  const equipment = equipmentRes.data ?? [];
  const monthlyUtilRes = useApiResource(() => monthlyUtilizationApi.list());
  const monthlyUtilization = monthlyUtilRes.data ?? [];
  const statusDistRes = useApiResource(() => statusDistributionApi.list());
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
              onClick={onHome}
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

export default function App() {
  const [view, setView] = useState<View>("portal");
  const [initialSession] = useState(restoreSession);
  const [user, setUser] = useState<StoredSession | null>(initialSession.user);
  const [showLogin, setShowLogin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [sessionNotice, setSessionNotice] = useState<string | null>(
    initialSession.notice,
  );
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const equipmentRes = useApiResource(() => equipmentApi.list());
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
    setShowLogin(false);
    setView(
      role === "customer"
        ? "customer"
        : role === "admin"
          ? "admin"
          : "dashboard",
    );
    let id: number | null = null;
    try {
      const users = await userApi.list();
      id = users.find((u) => u.email.toLowerCase() === email)?.id ?? null;
    } catch {
      // no linked account for this email — proceed with id: null (existing behavior)
    }
    const session = issueSession({ id, name, role });
    saveSession(session);
    setAuthToken(session.token);
    setUser(session);
    scheduleExpiry(session);
  };
  const handleLogout = () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    clearSession();
    setAuthToken(null);
    setUser(null);
    setView("portal");
  };

  if (view === "customer" && user)
    return (
      <CustomerPortal
        userName={user.name}
        userId={user.id}
        onLogout={handleLogout}
        onHome={handleLogout}
      />
    );
  if (view === "dashboard" && user)
    return (
      <EmployeeDashboard
        userName={user.name}
        onLogout={handleLogout}
        onHome={handleLogout}
      />
    );
  if (view === "admin" && user)
    return (
      <AdminDashboard
        userName={user.name}
        onLogout={handleLogout}
        onHome={handleLogout}
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
