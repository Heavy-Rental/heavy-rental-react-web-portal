import type {
  Asset,
  Booking,
  Depot,
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

// Thrown for any non-2xx response whose body parses as the backend's
// {"error": "<code>", "message": "<text>"} envelope — callers switch on `code`
// (e.g. "forbidden"/"conflict"/"payload_too_large") instead of string-matching text.
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
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
    const raw = await res.text().catch(() => "");
    let envelope: { error?: string; message?: string } | null = null;
    try {
      if (raw) envelope = JSON.parse(raw);
    } catch {
      // not a JSON error envelope — fall through to the raw-text Error below
    }
    if (envelope?.error && envelope?.message) {
      throw new ApiError(envelope.error, envelope.message);
    }
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}${raw ? ` — ${raw}` : ""}`);
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
export function logout(): Promise<void> {
  return request("/auth/logout", { method: "POST" });
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

export const assetApi = {
  ...resource<Asset>("/assets"),
  list: (params?: { startDate?: string; endDate?: string }, signal?: AbortSignal) => {
    const qs = params?.startDate && params?.endDate ? `?startDate=${params.startDate}&endDate=${params.endDate}` : "";
    return request<Asset[]>(`/assets${qs}`, { signal });
  },
  // SPEC-equipment-browse-api.md §7.6 (paraphrased in TASKS-frontend-admin-asset-records.md —
  // the spec file itself isn't present in this repo): body carries base64 with no "data:" prefix,
  // response is the full updated AssetResponse with `img` set to a data URI.
  uploadImage: (id: number, dataUri: string) =>
    request<Asset>(`/assets/${id}/image`, {
      method: "PUT",
      body: JSON.stringify({ image: dataUri.replace(/^data:[^,]*,/, "") }),
    }),
};

export const depotApi = resource<Depot>("/depots");
export interface UserCreateResult extends User {
  // Backend generates this server-side on create and never stores/emails it —
  // it's the only place it's ever surfaced, so the caller must show it once.
  temporaryPassword: string;
}

export const userApi = {
  ...resource<User>("/users"),
  create: (body: Omit<User, "id">) =>
    request<UserCreateResult | [UserCreateResult]>("/users", {
      method: "POST",
      body: JSON.stringify(body),
    }).then(unwrapCreateResponse),
};
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

// ─── Project-spec recommendations ──────────────────────────────────────────
// POST /api/recommendations/project-spec (Call 1). Two hops on the same path:
//   JSON  — camelCase body matching Spring SubmitProjectSpecRequest
//   multipart — camelCase form parts + optional file
// Response is the Instant Quotation DTO (quote + ranked equipment items).

export interface CreateProjectSpecRequest {
  projectText: string;
  startDate?: string;
  endDate?: string;
  userName?: string;
  query?: string;
  topK?: number;
}

export interface ProjectSpecNeed {
  needId: string;
  description: string;
  equipmentHints: string[];
  quantity: number;
}

export interface ProjectSpecBudget {
  amount: number;
  currency: string;
  source: string;
}

// Nested fleet card on each recommendation item — the fields Instant Quotation
// returns, not the full Asset catalog record (min/max rates, ratings, etc.).
// Live Spring omits / nulls weekly and may send a non-URL img placeholder.
export type ProjectSpecEquipment = Omit<
  Pick<
    Asset,
    | "id"
    | "name"
    | "category"
    | "baseDailyRate"
    | "weekly"
    | "capacity"
    | "platformHeight"
    | "purchaseYear"
    | "location"
    | "available"
    | "img"
    | "desc"
    | "tags"
  >,
  "weekly"
> & {
  weekly?: number | null;
};

export interface ProjectSpecRecommendationItem {
  rankOrder: number;
  matchScore: number;
  reason: string;
  lineTotal: number;
  quantity: number;
  equipment: ProjectSpecEquipment;
}

export interface CreateProjectSpecResponse {
  recommendationId: number;
  ingestId: string;
  userRequirementSummary: string;
  tentativeStartDate?: string | null;
  tentativeEndDate?: string | null;
  needsSummary: ProjectSpecNeed[];
  expectedBudget?: ProjectSpecBudget | null;
  warnings: string[];
  correlationId: string;
  quoteRef: string;
  confidenceScore: number;
  days?: number | null;
  estimatedTotal: number;
  specSummary: string;
  rationale: string;
  items: ProjectSpecRecommendationItem[];
}

export interface CreateProjectSpecMultipartRequest {
  file?: File;
  projectText?: string;
  startDate?: string;
  endDate?: string;
  userName?: string;
  query?: string;
  topK?: number;
  correlationId?: string;
}

// Multipart hop of the same POST /recommendations/project-spec path.
// Must not go through request() — that helper forces Content-Type: application/json
// and would break the FormData boundary. Omit Content-Type so the browser sets it.
async function postProjectSpecMultipart(
  req: CreateProjectSpecMultipartRequest,
  signal?: AbortSignal,
): Promise<CreateProjectSpecResponse> {
  const form = new FormData();
  if (req.file) form.append("file", req.file);
  if (req.projectText != null) form.append("projectText", req.projectText);
  if (req.startDate != null) form.append("startDate", req.startDate);
  if (req.endDate != null) form.append("endDate", req.endDate);
  if (req.userName != null) form.append("userName", req.userName);
  if (req.query != null) form.append("query", req.query);
  if (req.topK != null) form.append("topK", String(req.topK));

  const res = await fetch(`${BASE}/recommendations/project-spec`, {
    method: "POST",
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      "X-Correlation-Id": req.correlationId ?? crypto.randomUUID(),
    },
    body: form,
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`POST /recommendations/project-spec failed: ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
  const payload = (await res.json()) as CreateProjectSpecResponse | [CreateProjectSpecResponse];
  return unwrapCreateResponse(payload);
}

export const recommendationApi = {
  createFromProjectSpec: (req: CreateProjectSpecRequest, signal?: AbortSignal) =>
    request<CreateProjectSpecResponse | [CreateProjectSpecResponse]>("/recommendations/project-spec", {
      method: "POST",
      body: JSON.stringify(req),
      signal,
    }).then(unwrapCreateResponse),
  createFromProjectSpecMultipart: (req: CreateProjectSpecMultipartRequest, signal?: AbortSignal) =>
    postProjectSpecMultipart(req, signal),
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
