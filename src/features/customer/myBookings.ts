import type {
  Asset,
  Booking,
  BookingStatus,
  RentalPlan as ApiRentalPlan,
} from "../../app/types";
import type { CreateBookingResponse } from "../../app/api";
import { daysBetweenISO } from "../../lib/dateFormat";

export interface MyBooking {
  id: string;
  apiId: number;
  equipment: string;
  dates: string;
  days: number;
  status: BookingStatus;
  total: number;
  deposit: number;
}

// Real backend's GET /bookings returns the flat CreateBookingResponse shape (one row
// per booked item under `items`), not the mock's normalized Booking shape — same
// distinction AdminDataContext's isApiBookingRecord() makes for the admin Bookings tab.
function isApiBookingRecord(
  b: Booking | CreateBookingResponse,
): b is CreateBookingResponse {
  return "bookingId" in b;
}

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Builds the signed-in customer's own booking history for the profile page.
// The real backend already scopes GET /bookings to the caller (verified live: a
// customer-role token only ever gets their own records), so API-shape rows need no
// further filtering here — good, because a customer session's `userId` is always null
// in API mode (App.tsx: GET /api/users is ROLE_ADMIN-only, so customer logins never
// resolve one). The mock server has no such server-side scoping, so mock-shape rows
// are joined through rentalPlans (Booking.rentalPlanId -> RentalPlan.userId) instead —
// that branch only matches when a userId is actually available.
export function buildMyBookings(
  apiBookings: (Booking | CreateBookingResponse)[],
  rentalPlans: ApiRentalPlan[],
  equipment: Asset[],
  userId: number | null,
): MyBooking[] {
  return apiBookings
    .filter((b) => {
      if (isApiBookingRecord(b)) return true;
      if (userId === null) return false;
      const plan = rentalPlans.find((p) => p.id === b.rentalPlanId);
      return plan?.userId === userId;
    })
    .map((b): MyBooking => {
      if (isApiBookingRecord(b)) {
        return {
          id: `RNT-${String(b.bookingId).padStart(4, "0")}`,
          apiId: b.bookingId,
          equipment: (b.items ?? []).map((i) => i.assetName).join(", ") || "—",
          dates: `${fmt(b.startDate)} – ${fmt(b.endDate)}`,
          days: daysBetweenISO(b.startDate, b.endDate),
          status: b.bookingStatus as BookingStatus,
          total: b.totalAmount,
          deposit: b.depositAmount,
        };
      }
      const equipmentNames =
        b.equipmentIds
          .map((id) => equipment.find((e) => e.id === id)?.name ?? `Equipment #${id}`)
          .join(", ") || "—";
      return {
        id: `RNT-${String(b.id).padStart(4, "0")}`,
        apiId: b.id,
        equipment: equipmentNames,
        dates: `${fmt(b.startDate)} – ${fmt(b.endDate)}`,
        days: daysBetweenISO(b.startDate, b.endDate),
        status: b.status,
        total: b.totalAmount,
        deposit: b.depositAmount,
      };
    })
    .sort((a, b) => b.apiId - a.apiId);
}
