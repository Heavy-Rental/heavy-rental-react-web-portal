// ─── SHARED UI VOCABULARY ──────────────────────────────────────────────────────

export type Role = "customer" | "employee" | "admin";
export type View = "portal" | "customer" | "dashboard" | "admin" | "safety" | "about" | "projects";
export type OnboardingMode = "know" | "browse" | "specs" | null;

// Client-simulated bearer-token session (Spec-frontend-authentication.md) —
// token/issuedAt/expiresAt are generated and enforced entirely client-side.
export interface StoredSession {
  token: string;
  id: number | null;
  name: string;
  role: Role;
  issuedAt: number;
  expiresAt: number;
}

// ─── API RESOURCE TYPES (mirror mock/db.json field-for-field) ─────────────────

export type ConditionType = "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_REPAIR";

export interface Asset {
  id: number;
  name: string;
  category: string;
  baseDailyRate: number;
  minDailyRate: number;
  maxDailyRate: number;
  weekly: number;
  capacity: number;
  platformHeight: number | null;
  purchaseYear: number;
  location: string;
  rating: number;
  reviews: number;
  available: boolean;
  img: string;
  tags: string[];
  utilization: number;
  revenue: number;
  hoursThisMonth: number;
  desc: string;
  idealFor: string[];
  serialno: string;
  condition: ConditionType | null;
  lastConditionUpdatedAt: string | null;
}

export interface Depot {
  id: number;
  name: string;
  region: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface RentalPlanItem {
  equipmentId: number;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;   // ISO YYYY-MM-DD
}

export type RentalPlanStatus = "active" | "completed";

export interface RentalPlan {
  id: number;
  userId: number;
  status: RentalPlanStatus;
  depotId: number;
  items: RentalPlanItem[];
  createdAt: string;
}

export type BookingStatus = "PENDING_DEPOSIT" | "PENDING_CONFIRMED" | "CONFIRMED" | "MOBILISED" | "COMPLETED" | "CANCELLED";
export type PaidStatus = "UNPAID" | "DEPOSIT" | "FULL";
// Which way the customer chooses to pay at checkout (DepositCheckout.tsx) — DEPOSIT
// remains the default/primary flow, FULL is an opt-in alternative that settles the
// booking (PaidStatus "FULL") in one shot instead of deposit-now/balance-later.
export type PaymentOption = "DEPOSIT" | "FULL";

export interface Booking {
  id: number;
  rentalPlanId: number;
  depotId: number;
  equipmentIds: number[];
  startDate: string;
  endDate: string;
  deliveryDate: string;
  returnDate: string;
  totalAmount: number;
  depositAmount: number;
  fullPaymentDueDate: string;
  status: BookingStatus;
  paidStatus: PaidStatus;
  siteAddress: string;
  sitePostalCode: string;
  deliveryNotes: string;
}

// ─── REAL BACKEND: RentalPlan cart persistence (api-contract-for-frontend.md §1-2) ─
// Distinct from `RentalPlan` above (the mock server's shape, still used by mock mode
// and the account "my rental plans" view) — MODE === "api" only, wired by
// `rentalPlanCartApi` in api.ts. Wire status is uppercase; `SAVED` is declared but
// never appears on a live plan. `CANCELLED` (§5.5) is a terminal status set by
// `POST /rentalPlans/{id}/cancel` — treat it like `CONVERTED` for "is this plan
// still active" checks (both free up the one-active-plan slot).
export type RentalPlanApiStatus = "DRAFT" | "SAVED" | "QUOTED" | "CONVERTED" | "CANCELLED";

export interface RentalPlanItemResponse {
  id: number;
  assetId: number;
  assetName: string;
  dailyRate: number;
  subtotal: number;
}

// totalAmount is null whenever status !== "QUOTED" — including immediately after an
// item add/remove reverts a previously-QUOTED plan back to DRAFT.
export interface RentalPlanResponse {
  id: number;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  siteAddress: string | null;
  status: RentalPlanApiStatus;
  totalAmount: number | null;
  items: RentalPlanItemResponse[];
  updatedAt: string; // ISO local-date-time, no offset — repurposed as "last quoted at"
  createdAt: string;
}

export interface MonthlyUtilization {
  id: number;
  month: string;
  utilization: number;
  revenue: number;
}

export interface StatusDistribution {
  id: number;
  name: string;
  value: number;
  color: string;
}
