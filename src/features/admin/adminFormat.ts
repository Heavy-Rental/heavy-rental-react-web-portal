import type { BookingStatus, PaidStatus, ConditionType } from "../../app/types";

// Booking lifecycle vs. payment status are two separate fields on the real Booking
// entity (SPEC-entity-repository.md) — status is the lifecycle, paidStatus is payment.
export const BOOKING_STATUSES: BookingStatus[] = [
  "PENDING_DEPOSIT",
  "PENDING_CONFIRMED",
  "CONFIRMED",
  "MOBILISED",
  "COMPLETED",
  "CANCELLED",
];
export function formatBookingStatus(s: BookingStatus): string {
  // Handles multi-word statuses (PENDING_DEPOSIT -> "Pending Deposit"), not just the
  // single-word ones the old single-capitalize version assumed.
  return s
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// Groups the two "money not yet settled" statuses (PENDING_DEPOSIT — no deposit paid
// yet, and PENDING_CONFIRMED — deposit paid, awaiting admin confirmation) under one
// "Pending Payments" bucket, since from an admin's glance they're the same "needs my
// attention before this is a real booking" state. Shared between BookingsTab's stat row
// and the Overview tab's Booking Status panel so both agree on this grouping.
export const BOOKING_STAT_GROUPS: { label: string; statuses: BookingStatus[] }[] = [
  { label: "Pending Payments", statuses: ["PENDING_DEPOSIT", "PENDING_CONFIRMED"] },
  { label: "Confirmed", statuses: ["CONFIRMED"] },
  { label: "Mobilised", statuses: ["MOBILISED"] },
  { label: "Completed", statuses: ["COMPLETED"] },
  { label: "Cancelled", statuses: ["CANCELLED"] },
];

export function bookingStatusColor(s: BookingStatus): string {
  return {
    PENDING_DEPOSIT: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    PENDING_CONFIRMED: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    CONFIRMED: "text-green-400 bg-green-500/10 border-green-500/30",
    MOBILISED: "text-violet-400 bg-violet-500/10 border-violet-500/30",
    COMPLETED: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    CANCELLED: "text-red-400 bg-red-500/10 border-red-500/30",
  }[s];
}

export const PAID_STATUSES: PaidStatus[] = ["UNPAID", "DEPOSIT", "FULL"];
export function formatPaidStatus(s: PaidStatus): string {
  return s[0] + s.slice(1).toLowerCase();
}

export const CONDITIONS: ConditionType[] = [
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "NEEDS_REPAIR",
];

export type DeploymentStatus = "Available" | "Booked" | "In-Transit" | "Maintenance";

export const DEPLOYMENT_META: Record<
  DeploymentStatus,
  { color: string; bg: string; border: string; dot: string; desc: string }
> = {
  Available: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    dot: "bg-green-400",
    desc: "Ready for rental at depot",
  },
  Booked: {
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    dot: "bg-primary",
    desc: "Reserved — booking confirmed, awaiting dispatch (Booking.status = CONFIRMED)",
  },
  "In-Transit": {
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    dot: "bg-violet-400",
    desc: "En route to or from customer site (Booking.status = MOBILISED)",
  },
  Maintenance: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    dot: "bg-red-400",
    desc: "Out of service — repair or scheduled service, independent of any booking",
  },
};

