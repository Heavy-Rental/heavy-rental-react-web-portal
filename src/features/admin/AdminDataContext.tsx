import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  Asset,
  User as ApiUser,
  RentalPlan as ApiRentalPlan,
  Booking as ApiBooking,
  Depot,
  BookingStatus,
  PaidStatus,
  Role,
  ConditionType,
} from "../../app/types";
import {
  assetApi,
  depotApi,
  userApi,
  rentalPlanApi,
  bookingApi,
  monthlyUtilizationApi,
  type CreateBookingResponse,
} from "../../app/api";
import { useApiResource } from "../../app/useApiResource";
import { deriveAssetRecord, resolvePhoto, formatCondition, type AssetRecord } from "../../app/assetRecord";
import { todayISO } from "../../lib/dateFormat";
import type { DeploymentStatus } from "./adminFormat";

/* eslint-disable react-refresh/only-export-components -- Same rationale as CartContext: the
   provider, its hook, and the domain types/seed-derivation helpers it exposes are one cohesive
   admin data-layer module; splitting them wouldn't change behavior, only Fast Refresh granularity. */

export type AdminTab = "overview" | "assets" | "fleet" | "users" | "bookings";

// User/booking view-models joined from the normalized API resources, for display.
export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  rentals: number;
  spent: number;
  status: "Active" | "Inactive";
}

export interface BookingRow {
  id: string;
  apiId: number;
  customer: string;
  equipment: string;
  depot: string;
  dates: string;
  days: number;
  total: number;
  deposit: number;
  status: BookingStatus;
  paidStatus: PaidStatus;
}

export interface FleetAsset {
  id: number;
  name: string;
  category: string;
  serialno: string;
  purchaseYear: number;
  location: string;
  photo: string;
  deploymentStatus: DeploymentStatus;
  assignedBooking: string;
  assignedCustomer: string;
  currentSite: string;
  lastUpdated: string;
  updatedBy: string;
  notes: string;
  condition: ConditionType;
}

// Real backend's GET /bookings returns a flat, denormalized shape (no rentalPlanId/
// depotId/equipmentIds join keys — customer/asset info is inlined instead). This guard
// lets the builders below branch per-item so both this API-mode shape and the mock's
// normalized Booking shape produce the same UserRow/BookingRow view-models.
function isApiBookingRecord(
  b: ApiBooking | CreateBookingResponse,
): b is CreateBookingResponse {
  return "bookingId" in b;
}

const ACTIVE_BOOKING_STATUSES = new Set(["CONFIRMED", "MOBILISED"]);

// Asset.available is a manually-set admin flag (AssetFormModal's Availability toggle) with
// no automatic tie to bookings, so it drifts from reality (e.g. an asset can sit "Available"
// while a confirmed booking has it out today). This cross-references live bookings against
// today's date instead, for a status the Assets tab can actually trust.
function buildOnRentAssetIds(
  apiBookings: (ApiBooking | CreateBookingResponse)[],
  equipment: Asset[],
  today: string,
): Set<number> {
  const ids = new Set<number>();
  for (const b of apiBookings) {
    if (today < b.startDate || today > b.endDate) continue;
    if (isApiBookingRecord(b)) {
      if (!ACTIVE_BOOKING_STATUSES.has(b.bookingStatus)) continue;
      // Real backend booking items carry serialNumber, not assetId (dto/BookingItemLine.java,
      // HR-113) — join on serial number instead.
      for (const item of b.items ?? []) {
        const asset = equipment.find((e) => e.serialno === item.serialNumber);
        if (asset) ids.add(asset.id);
      }
    } else {
      if (!ACTIVE_BOOKING_STATUSES.has(b.status)) continue;
      for (const id of b.equipmentIds) ids.add(id);
    }
  }
  return ids;
}

interface AssetDeployment {
  status: DeploymentStatus;
  bookingId: string;
  customer: string;
  site: string;
  note: string;
}

// Per-asset current deployment, derived from real bookings covering today — mirrors
// buildOnRentAssetIds's date-window check but also distinguishes CONFIRMED (awaiting
// dispatch) from MOBILISED (in transit) and carries the booking/customer/site detail
// the Fleet Board displays alongside the status.
function buildAssetDeployments(
  apiBookings: (ApiBooking | CreateBookingResponse)[],
  equipment: Asset[],
  rentalPlans: ApiRentalPlan[],
  apiUsers: ApiUser[],
  today: string,
): Map<number, AssetDeployment> {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  const map = new Map<number, AssetDeployment>();

  for (const b of apiBookings) {
    if (today < b.startDate || today > b.endDate) continue;
    const status = isApiBookingRecord(b) ? b.bookingStatus : b.status;
    if (!ACTIVE_BOOKING_STATUSES.has(status)) continue;

    const depStatus: DeploymentStatus = status === "MOBILISED" ? "In-Transit" : "Booked";
    const bookingId = `RNT-${String(isApiBookingRecord(b) ? b.bookingId : b.id).padStart(4, "0")}`;
    let customer: string;
    if (isApiBookingRecord(b)) {
      customer = b.customerName;
    } else {
      const plan = rentalPlans.find((p) => p.id === b.rentalPlanId);
      const user = plan ? apiUsers.find((u) => u.id === plan.userId) : undefined;
      customer = user?.name ?? "Unknown";
    }
    const note =
      depStatus === "In-Transit"
        ? `En route — return due ${fmt(b.endDate)}.`
        : `Confirmed — delivery due ${fmt(b.startDate)}.`;

    const ids: number[] = isApiBookingRecord(b)
      ? (b.items ?? [])
          .map((item) => equipment.find((e) => e.serialno === item.serialNumber)?.id)
          .filter((id): id is number => id !== undefined)
      : b.equipmentIds;

    for (const id of ids) {
      const existing = map.get(id);
      // An asset shouldn't match two bookings on the same day, but if it does, In-Transit
      // (equipment physically moving) takes priority over Booked (still at depot).
      if (!existing || (depStatus === "In-Transit" && existing.status !== "In-Transit")) {
        map.set(id, { status: depStatus, bookingId, customer, site: b.siteAddress, note });
      }
    }
  }
  return map;
}

function buildUserRows(
  apiUsers: ApiUser[],
  rentalPlans: ApiRentalPlan[],
  bookings: (ApiBooking | CreateBookingResponse)[],
): UserRow[] {
  return apiUsers.map((u) => {
    const planIds = new Set(
      rentalPlans.filter((p) => p.userId === u.id).map((p) => p.id),
    );
    // No rentalPlanId to join on for the flat API-mode shape — approximate via
    // customerName === user.name instead (fragile on duplicate display names, but
    // it's the only link the real backend's booking response actually carries).
    const userBookings = bookings.filter((b) =>
      isApiBookingRecord(b)
        ? b.customerName === u.name
        : planIds.has(b.rentalPlanId),
    );
    // "Active" means the customer has a booking currently in progress (CONFIRMED
    // or MOBILISED — i.e. not yet COMPLETED/CANCELLED, and not just a pending deposit).
    // Previously checked rentalPlan.status === "active", a mock-server-only value; the
    // real backend's RentalPlan.status is DRAFT/SAVED/QUOTED/CONVERTED and never matched,
    // so every user always showed Inactive.
    const inProgressBookingStatuses = new Set<BookingStatus>([
      "CONFIRMED",
      "MOBILISED",
    ]);
    const hasInProgressBooking = userBookings.some((b) =>
      inProgressBookingStatuses.has(
        (isApiBookingRecord(b) ? b.bookingStatus : b.status) as BookingStatus,
      ),
    );
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      rentals: userBookings.length,
      spent: userBookings.reduce((s, b) => s + b.totalAmount, 0),
      status: hasInProgressBooking ? "Active" : "Inactive",
    };
  });
}

function buildBookingRows(
  apiBookings: (ApiBooking | CreateBookingResponse)[],
  rentalPlans: ApiRentalPlan[],
  apiUsers: ApiUser[],
  equipment: Asset[],
  depots: Depot[],
): BookingRow[] {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return apiBookings.map((b) => {
    const start = new Date(`${b.startDate}T00:00:00`);
    const end = new Date(`${b.endDate}T00:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const dates = `${fmt(b.startDate)} – ${fmt(b.endDate)}`;

    if (isApiBookingRecord(b)) {
      // API-mode shape: customer is already inlined, no join needed. `items` can cover
      // more than one asset per booking (dto/BookingItemLine.java, HR-113) — join every
      // item's name rather than assuming a single flat assetName (that field no longer
      // exists on the real response; reading it was undefined and crashed the search
      // filter's `.toLowerCase()` call the moment a booking without a fallback showed up).
      // depot and paidStatus have no real equivalent here — approximated from
      // siteAddress and remainingBalance respectively.
      const equipment =
        (b.items ?? []).map((i) => i.assetName).join(", ") || "—";
      return {
        id: `RNT-${String(b.bookingId).padStart(4, "0")}`,
        apiId: b.bookingId,
        customer: b.customerName,
        equipment,
        depot: b.siteAddress,
        dates,
        days,
        total: b.totalAmount,
        deposit: b.depositAmount,
        status: b.bookingStatus as BookingStatus,
        paidStatus:
          b.remainingBalance === 0
            ? "FULL"
            : b.depositAmount > 0
              ? "DEPOSIT"
              : "UNPAID",
      };
    }

    const plan = rentalPlans.find((p) => p.id === b.rentalPlanId);
    const user = plan ? apiUsers.find((u) => u.id === plan.userId) : undefined;
    return {
      id: `RNT-${String(b.id).padStart(4, "0")}`,
      apiId: b.id,
      customer: user?.name ?? "Unknown",
      equipment: b.equipmentIds
        .map(
          (id) =>
            equipment.find((e) => e.id === id)?.name ?? `Equipment #${id}`,
        )
        .join(", "),
      depot:
        depots.find((d) => d.id === b.depotId)?.name ?? `Depot #${b.depotId}`,
      dates,
      days,
      total: b.totalAmount,
      deposit: b.depositAmount,
      status: b.status,
      paidStatus: b.paidStatus,
    };
  });
}

// Format matches handleFleetUpdate's manual-edit timestamp (FleetTab.tsx) so seeded and
// admin-updated rows read consistently.
const fmtLastUpdated = (iso: string) =>
  new Date(iso)
    .toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");

const buildFleetAssets = (
  equipment: Asset[],
  apiBookings: (ApiBooking | CreateBookingResponse)[],
  rentalPlans: ApiRentalPlan[],
  apiUsers: ApiUser[],
  today: string,
): FleetAsset[] => {
  const deployments = buildAssetDeployments(apiBookings, equipment, rentalPlans, apiUsers, today);
  return equipment.map((e) => {
    const condition = e.condition ?? "GOOD";
    const lastUpdated = e.lastConditionUpdatedAt ? fmtLastUpdated(e.lastConditionUpdatedAt) : "";

    if (condition === "NEEDS_REPAIR") {
      return {
        id: e.id,
        name: e.name,
        category: e.category,
        purchaseYear: e.purchaseYear,
        serialno: e.serialno,
        location: e.location,
        photo: resolvePhoto(e.img),
        deploymentStatus: "Maintenance",
        assignedBooking: "",
        assignedCustomer: "",
        currentSite: `Service Center, ${e.location}`,
        lastUpdated,
        updatedBy: "",
        notes: `Condition: ${formatCondition(condition)} — scheduled for service.`,
        condition,
      };
    }

    const d = deployments.get(e.id);
    return {
      id: e.id,
      name: e.name,
      category: e.category,
      purchaseYear: e.purchaseYear,
      serialno: e.serialno,
      location: e.location,
      photo: resolvePhoto(e.img),
      deploymentStatus: d?.status ?? "Available",
      assignedBooking: d?.bookingId ?? "",
      assignedCustomer: d?.customer ?? "",
      currentSite: d?.site ?? `${e.location} Depot`,
      lastUpdated,
      updatedBy: "",
      notes: d?.note ?? "",
      condition,
    };
  });
};

interface AdminDataValue {
  dataStatus: "loading" | "success" | "error";
  dataError: string | null;
  categories: string[];
  assets: AssetRecord[];
  setAssets: Dispatch<SetStateAction<AssetRecord[]>>;
  users: UserRow[];
  setUsers: Dispatch<SetStateAction<UserRow[]>>;
  bookings: BookingRow[];
  setBookings: Dispatch<SetStateAction<BookingRow[]>>;
  onRentAssetIds: Set<number>;
  fleet: FleetAsset[];
  setFleet: Dispatch<SetStateAction<FleetAsset[]>>;
  monthlyUtilization: {
    id: number;
    month: string;
    utilization: number;
    revenue: number;
  }[];
  toast: { msg: string; type?: "success" | "error" } | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const equipmentRes = useApiResource((signal) => assetApi.list(undefined, signal));
  const equipment = equipmentRes.data ?? [];
  const depotsRes = useApiResource((signal) => depotApi.list(signal));
  const usersRes = useApiResource((signal) => userApi.list(signal));
  const bookingsRes = useApiResource((signal) => bookingApi.list(signal));
  const rentalPlansRes = useApiResource((signal) => rentalPlanApi.list(signal));
  const monthlyUtilRes = useApiResource((signal) =>
    monthlyUtilizationApi.list(signal),
  );
  const monthlyUtilization = monthlyUtilRes.data ?? [];
  const categories = Array.from(new Set(equipment.map((e) => e.category)));

  const onRentAssetIds = useMemo(
    () =>
      bookingsRes.data && equipmentRes.data
        ? buildOnRentAssetIds(bookingsRes.data, equipmentRes.data, todayISO())
        : new Set<number>(),
    [bookingsRes.data, equipmentRes.data],
  );

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetsSeededFrom, setAssetsSeededFrom] =
    useState<typeof equipmentRes.data>(null);
  if (
    equipmentRes.status === "success" &&
    equipmentRes.data !== assetsSeededFrom
  ) {
    setAssetsSeededFrom(equipmentRes.data);
    setAssets(equipmentRes.data.map(deriveAssetRecord));
  }

  const [users, setUsers] = useState<UserRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [userBookingsSeeded, setUserBookingsSeeded] = useState(false);
  if (
    !userBookingsSeeded &&
    usersRes.status === "success" &&
    bookingsRes.status === "success" &&
    rentalPlansRes.status === "success" &&
    equipmentRes.status === "success" &&
    depotsRes.status === "success"
  ) {
    setUserBookingsSeeded(true);
    setUsers(
      buildUserRows(usersRes.data, rentalPlansRes.data, bookingsRes.data),
    );
    setBookings(
      buildBookingRows(
        bookingsRes.data,
        rentalPlansRes.data,
        usersRes.data,
        equipmentRes.data,
        depotsRes.data,
      ),
    );
  }

  const [fleet, setFleet] = useState<FleetAsset[]>([]);
  const [fleetSeeded, setFleetSeeded] = useState(false);
  if (
    !fleetSeeded &&
    equipmentRes.status === "success" &&
    bookingsRes.status === "success" &&
    rentalPlansRes.status === "success" &&
    usersRes.status === "success"
  ) {
    setFleetSeeded(true);
    setFleet(
      buildFleetAssets(
        equipmentRes.data,
        bookingsRes.data,
        rentalPlansRes.data,
        usersRes.data,
        todayISO(),
      ),
    );
  }

  const [toast, setToast] = useState<{
    msg: string;
    type?: "success" | "error";
  } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const statuses = [
    equipmentRes.status,
    depotsRes.status,
    usersRes.status,
    bookingsRes.status,
    rentalPlansRes.status,
    monthlyUtilRes.status,
  ];
  const dataStatus: AdminDataValue["dataStatus"] = statuses.includes("loading")
    ? "loading"
    : statuses.includes("error")
      ? "error"
      : "success";
  const dataError =
    equipmentRes.error ??
    depotsRes.error ??
    usersRes.error ??
    bookingsRes.error ??
    rentalPlansRes.error ??
    monthlyUtilRes.error ??
    null;

  return (
    <AdminDataContext.Provider
      value={{
        dataStatus,
        dataError,
        categories,
        assets,
        setAssets,
        users,
        setUsers,
        bookings,
        setBookings,
        onRentAssetIds,
        fleet,
        setFleet,
        monthlyUtilization,
        toast,
        showToast,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminDataValue {
  const ctx = useContext(AdminDataContext);
  if (!ctx)
    throw new Error("useAdminData must be used within an AdminDataProvider");
  return ctx;
}
