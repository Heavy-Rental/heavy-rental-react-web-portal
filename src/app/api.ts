import type {
  Asset,
  Booking,
  Depot,
  MonthlyUtilization,
  RentalPlan,
  RentalPlanResponse,
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

// ─── REAL BACKEND: RentalPlan cart persistence (api-contract-for-frontend.md §1-3, 5.5, 7;
// RentalPlanController.java, RentalPlanService.java, RentalPlanCreateRequest.java) ──
// Distinct from `rentalPlanApi` above (generic CRUD over the mock's `RentalPlan` shape) —
// these hit the same `/rentalPlans` routes but speak the real backend's response shape
// (`RentalPlanResponse`) and its item-level mutation endpoints, which the mock server
// doesn't implement. There's no server-side "active plan" filter (§7) — `list()` +
// client-side filtering for `status` not in `("CONVERTED", "CANCELLED")` is the only way
// to find the caller's one active plan (the backend itself 409s a second `create()` while
// one exists; cancelling, like converting, frees the slot again).

export interface CreateRentalPlanRequest {
  startDate: string; // ISO YYYY-MM-DD, optional server-side but always sent here
  endDate: string; // ISO YYYY-MM-DD, optional server-side but always sent here
  // Optional (specification/features/spring contract/rental-plan-site-address.md) — omit
  // entirely to create the plan with siteAddress: null ("Skip for now"). When provided, still
  // validated exactly as before: must end in a 6-digit postal code, or 400s as
  // validation_failed.
  siteAddress?: string;
}

export interface UpdateRentalPlanSiteAddressRequest {
  siteAddress: string;
}

export const rentalPlanCartApi = {
  list: (signal?: AbortSignal) =>
    request<RentalPlanResponse[]>("/rentalPlans", { signal }),
  create: (body: CreateRentalPlanRequest) =>
    request<RentalPlanResponse>("/rentalPlans", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  // Response reflects the updated status/totalAmount/items/updatedAt in the same call —
  // no follow-up GET needed (§3: this also succeeds, reverting a QUOTED plan to DRAFT,
  // instead of the 409 it returns today).
  addItem: (planId: number, assetId: number) =>
    request<RentalPlanResponse>(`/rentalPlans/${planId}/items`, {
      method: "POST",
      body: JSON.stringify({ assetId }),
    }),
  removeItem: (planId: number, itemId: number) =>
    request<RentalPlanResponse>(`/rentalPlans/${planId}/items/${itemId}`, {
      method: "DELETE",
    }),
  // Allowed from DRAFT/SAVED/QUOTED; 409 already_converted on a CONVERTED plan,
  // 409 already_cancelled if already cancelled (api-contract-for-frontend.md §5.5).
  cancel: (planId: number) =>
    request<RentalPlanResponse>(`/rentalPlans/${planId}/cancel`, {
      method: "POST",
    }),
  // Spring-only arithmetic today; may reflect a live ML price instead once the
  // backend-only pricing.dynamic-enabled flag flips on in an environment
  // (specification/frontend-handoff.md) — field names/shape are unchanged either way,
  // and this call can take noticeably longer (up to ~20s) once that happens.
  quote: (planId: number) =>
    request<RentalPlanResponse>(`/rentalPlans/${planId}/quote`, {
      method: "POST",
    }),
  // Sets/changes siteAddress on an already-created plan (siteAddress-only PATCH, not a
  // general update — specification/features/spring contract/rental-plan-site-address.md).
  // ⚠️ Load-bearing: on a QUOTED plan, this silently reverts status to DRAFT and clears
  // totalAmount in the same response — same rule already true for item add/remove on a
  // quoted plan. Callers must not assume a previously-displayed price survives this call,
  // and must not call quote() again until after this one resolves (quoting first, then
  // patching, would discard the fresh quote).
  updateSiteAddress: (planId: number, siteAddress: string) =>
    request<RentalPlanResponse>(`/rentalPlans/${planId}`, {
      method: "PATCH",
      body: JSON.stringify({ siteAddress } satisfies UpdateRentalPlanSiteAddressRequest),
    }),
};

// ─── REAL BACKEND: postal code validation (specification/features/postal-code-validation.md) ──
// Real-time Singapore postal code lookup, meant to be called while a site-address form is still
// being filled in (before final submit) — purely additive, doesn't change the siteAddress submit
// payload on any of the routes above. VALID/INVALID both come back as 200 — branch on `status`,
// not the HTTP status, to tell "field is genuinely invalid" apart from "lookup unavailable" (503,
// which is a distinct status precisely so it can be told apart without parsing the body).
export interface PostalCodeLookupResponse {
  status: "VALID" | "INVALID";
  postalCode: string;
  address?: string;
  message?: string;
}

export const postalCodeApi = {
  lookup: (postalCode: string, signal?: AbortSignal) =>
    request<PostalCodeLookupResponse>(`/postalCodes/${postalCode}`, { signal }),
};

// Converts a QUOTED RentalPlan into a Booking (api-contract-for-frontend.md §5) — items/dates
// are derived server-side from the plan and ignored if sent, so they're not part of this
// shape; siteAddress is still required separately. The response's totalAmount is guaranteed
// to equal the plan's quoted amount exactly (no independent recomputation), which is what
// keeps the amount charged in sync with the amount shown at checkout (frontend-handoff.md).
export interface CreateBookingFromPlanRequest {
  rentalPlanId: number;
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

export function createBookingFromPlan(req: CreateBookingFromPlanRequest): Promise<CreateBookingResponse> {
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

// Fetches the real backend's authoritative view of a booking — used to confirm
// `bookingStatus` actually flipped off PENDING_DEPOSIT after a Stripe payment
// succeeds client-side (the webhook that does this runs asynchronously, see
// Spec-stripe-payment-checkout.md's post-2026-08-20 change log) and to rebuild the
// confirmation screen after a Stripe redirect-based payment method sends the
// customer back to the app with no client-held cart state left in memory.
export function getBooking(bookingId: number): Promise<CreateBookingResponse> {
  return request<CreateBookingResponse>(`/bookings/${bookingId}`);
}

// Gives the deposit-succeeded webhook a brief head start before the frontend trusts
// its own "confirmed" screen: polls GET /bookings/{id} until `bookingStatus` moves off
// PENDING_DEPOSIT or the timeout elapses. Best-effort — on timeout this still returns
// the last (possibly still-PENDING_DEPOSIT) booking rather than throwing, since the
// caller has already decided to proceed on the trust-Stripe-but-wait-briefly model
// (Spec-stripe-payment-checkout.md) rather than blocking the customer indefinitely on
// a webhook delivery this environment can't guarantee.
export async function waitForBookingConfirmed(
  bookingId: number,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<CreateBookingResponse> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const intervalMs = options?.intervalMs ?? 1500;
  const deadline = Date.now() + timeoutMs;
  let booking = await getBooking(bookingId);
  while (booking.bookingStatus === "PENDING_DEPOSIT" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    booking = await getBooking(bookingId);
  }
  return booking;
}

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
