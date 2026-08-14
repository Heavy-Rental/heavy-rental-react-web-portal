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

// lastUpdated values arrive either as raw API timestamps (ISO 8601) or as the
// locale string FleetTab writes on local edits — both parse fine via `new Date`.
function parseTimestamp(value: string): Date | null {
  if (!value || value === "—") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestamp(value: string): string {
  const date = parseTimestamp(value);
  if (!date) return value || "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateOnly(value: string): string {
  const date = parseTimestamp(value);
  if (!date) return value || "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

export type DeploymentStatus =
  | "Available"
  | "Booked"
  | "In-Transit"
  | "Maintenance";

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
    desc: "Reserved — booking confirmed, awaiting dispatch",
  },
  "In-Transit": {
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    dot: "bg-violet-400",
    desc: "En route to or from customer site",
  },
  Maintenance: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    dot: "bg-red-400",
    desc: "Out of service — repair or scheduled service, independent of any booking",
  },
};

export type LifecycleStatus =
  | "Reserved"
  | "Preparing"
  | "Dispatched"
  | "Active"
  | "Return Initiated"
  | "Returned"
  | "Inspecting"
  | "Cleared"
  | "Maintenance";

export const LIFECYCLE_META: Record<
  LifecycleStatus,
  { color: string; bg: string; border: string; desc: string }
> = {
  Reserved: {
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    desc: "Deposit paid — equipment held",
  },
  Preparing: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    desc: "Equipment being serviced & loaded",
  },
  Dispatched: {
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    desc: "In transit to customer site",
  },
  Active: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    desc: "On site — rental period active",
  },
  "Return Initiated": {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    desc: "Customer initiated return",
  },
  Returned: {
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    desc: "Equipment received back at depot",
  },
  Inspecting: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    desc: "Post-return condition inspection",
  },
  Cleared: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    desc: "Cleared — back in available pool",
  },
  Maintenance: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    desc: "Sent for repair / service",
  },
};
