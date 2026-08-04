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

export interface Equipment {
  id: number;
  name: string;
  category: string;
  daily: number;
  weekly: number;
  tons: number;
  year: number;
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
  maxLoad: number;
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
  startDay: number;
  endDay: number;
  month: number;
  year: number;
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

export type BookingStatus = "pending-deposit" | "deposit-paid" | "completed" | "cancelled";

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
  depositPaid: boolean;
  fullPaymentDueDate: string;
  status: BookingStatus;
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
