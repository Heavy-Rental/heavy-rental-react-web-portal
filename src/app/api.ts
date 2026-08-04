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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function resource<T extends { id: number }>(path: string) {
  return {
    list: () => request<T[]>(path),
    get: (id: number) => request<T>(`${path}/${id}`),
    create: (body: Omit<T, "id">) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    replace: (id: number, body: Omit<T, "id">) =>
      request<T>(`${path}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Omit<T, "id">>) =>
      request<T>(`${path}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: number) => request<void>(`${path}/${id}`, { method: "DELETE" }),
  };
}

function readOnlyResource<T extends { id: number }>(path: string) {
  return {
    list: () => request<T[]>(path),
    get: (id: number) => request<T>(`${path}/${id}`),
  };
}

export const equipmentApi = resource<Equipment>("/equipment");
export const depotApi = resource<Depot>("/depots");
export const userApi = resource<User>("/users");
export const rentalPlanApi = resource<RentalPlan>("/rental-plans");
export const bookingApi = resource<Booking>("/bookings");
export const monthlyUtilizationApi = readOnlyResource<MonthlyUtilization>("/monthly-utilization");
export const statusDistributionApi = readOnlyResource<StatusDistribution>("/status-distribution");

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
