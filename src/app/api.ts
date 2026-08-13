import type {
  Booking,
  Depot,
  Equipment,
  MonthlyUtilization,
  RentalPlan,
  StatusDistribution,
  User,
} from "./types";

const BASE = "/api";

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}


// ← ADD THIS: real backend login (interim token → login → access token).
// Uses raw fetch instead of request() because getBearerToken returns plain text, not JSON.
export async function login(email: string, password: string): Promise<{ accessToken: string; expiresIn: number; username: string }> {
  const interim = await fetch(`${BASE}/auth/getBearerToken`).then((r) => r.text());
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${interim}` },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}





// The mock server's POST handler wraps the created resource in a single-element array
// instead of returning it bare (unlike its own GET/PATCH/PUT responses, which are all
// bare objects) — unwrap defensively so callers can rely on create() returning T, not T[].
function unwrapCreateResponse<T>(body: T | [T]): T {
  return Array.isArray(body) ? body[0] : body;
}

function resource<T extends { id: number }>(path: string) {
  return {
    list: (signal?: AbortSignal) => request<T[]>(path, { signal }),
    get: (id: number, signal?: AbortSignal) => request<T>(`${path}/${id}`, { signal }),
    create: (body: Omit<T, "id">) =>
      request<T | [T]>(path, { method: "POST", body: JSON.stringify(body) }).then(unwrapCreateResponse),
    replace: (id: number, body: Omit<T, "id">) =>
      request<T>(`${path}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Omit<T, "id">>) =>
      request<T>(`${path}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: number) => request<void>(`${path}/${id}`, { method: "DELETE" }),
  };
}

function readOnlyResource<T extends { id: number }>(path: string) {
  return {
    list: (signal?: AbortSignal) => request<T[]>(path, { signal }),
    get: (id: number, signal?: AbortSignal) => request<T>(`${path}/${id}`, { signal }),
  };
}

//export const equipmentApi = resource<Equipment>("/equipment"); tricia
export const equipmentApi = {
  ...resource<Equipment>("/equipment"),
  list: (params?: { startDate?: string; endDate?: string }, signal?: AbortSignal) => {
    const qs = params?.startDate && params?.endDate ? `?startDate=${params.startDate}&endDate=${params.endDate}` : "";
    return request<Equipment[]>(`/equipment${qs}`, { signal });
  },
};

export const depotApi = resource<Depot>("/depots");
export const userApi = resource<User>("/users");
export const rentalPlanApi = resource<RentalPlan>("/rentalPlans");
export const bookingApi = {
  ...resource<Booking>("/bookings"),
  // Real backend's GET /bookings returns the flat CreateBookingResponse shape (defined
  // below), not the mock's normalized Booking shape — callers must narrow per-item.
  list: (signal?: AbortSignal) => request<(Booking | CreateBookingResponse)[]>("/bookings", { signal }),
  // The generic resource().update() above PATCHes /bookings/{id} with an arbitrary
  // partial body — there's no backend route for that (405). Status changes go through
  // the real PATCH /bookings/{id}/status endpoint instead, matching how
  // deliveries/returns already do status updates, with the field name (bookingStatus,
  // not status) the backend's StatusUpdateRequest actually expects.
  updateStatus: (id: number, status: string) =>
    request<Booking | CreateBookingResponse>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ bookingStatus: status }),
    }),
};
export const monthlyUtilizationApi = readOnlyResource<MonthlyUtilization>("/monthly-utilization");
export const statusDistributionApi = readOnlyResource<StatusDistribution>("/status-distribution");

// ─── REAL BACKEND: booking + deposit-payment (MODE === "api" only) ─────────
// STRIPE_INTEGRATION_HANDOFF.md §2/§5 — a different contract against the same
// `/api/bookings` path than the mock resource above (mock and real backend are
// never targeted in the same MODE, so the two never collide at runtime).

export interface CreateBookingRequest {
  items: { assetId: number }[];
  startDate: string;
  endDate: string;
  siteAddress: string;
  deliveryNotes?: string;
}

export interface BookingItemLine {
  assetName: string;
  serialNumber: string;
}

export interface CreateBookingResponse {
  bookingId: number;
  customerName: string;
  startDate: string;
  endDate: string;
  bookingStatus: string;
  siteAddress: string;
  // Was a flat assetName/serialNumber pair; the real backend's BookingResponse now
  // carries one row per booked item (dto/BookingItemLine.java, HR-113) — a booking can
  // cover more than one asset. Reading the old flat fields here was silently undefined
  // at runtime (TS didn't catch it, nothing enforces the interface against live JSON),
  // which crashed the admin Bookings search the moment `.toLowerCase()` ran on it.
  items: BookingItemLine[];
  deliveryNotes: string;
  totalAmount: number;
  depositAmount: number;
  remainingBalance: number;
}

export function createDepositBooking(req: CreateBookingRequest): Promise<CreateBookingResponse> {
  return request<CreateBookingResponse>("/bookings", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export interface CreateDepositIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export const paymentApi = {
  createDepositIntent: (bookingId: number) =>
    request<CreateDepositIntentResponse>("/payments/deposit-intent", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    }),
};

// ─── BUSINESS RULES (Spec-ui-heavy-machinery-portal.md §4.4, Spec-mock-api-server.md FR-007/FR-008) ─

export const DEPOSIT_RATE = 0.3;

export function calcDeposit(totalAmount: number): number {
  return Math.round(totalAmount * DEPOSIT_RATE);
}

export function calcFullPaymentDueDate(deliveryDateISO: string): string {
  const d = new Date(`${deliveryDateISO}T00:00:00`);
  d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
}
