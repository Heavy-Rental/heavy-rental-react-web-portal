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

export interface Equipment {
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

export type BookingStatus = "PENDING" | "CONFIRMED" | "MOBILISED" | "COMPLETED" | "CANCELLED";
export type PaidStatus = "UNPAID" | "DEPOSIT" | "FULL";

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
