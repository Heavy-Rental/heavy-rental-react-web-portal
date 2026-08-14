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
import { deriveAssetRecord, resolvePhoto, type AssetRecord } from "../../app/assetRecord";
import { todayISO } from "../../lib/dateFormat";
import type { DeploymentStatus, LifecycleStatus } from "./adminFormat";

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

export interface LifecycleEvent {
  id: string;
  timestamp: string;
  status: LifecycleStatus;
  officer: string;
  notes: string;
  odometer?: string;
  condition?: ConditionType | "";
}

export interface RentalLifecycle {
  bookingId: string;
  customer: string;
  equipment: string;
  serialno: string;
  currentStatus: LifecycleStatus;
  events: LifecycleEvent[];
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

const buildFleetAssets = (equipment: Asset[]): FleetAsset[] =>
  equipment.map((e, i) => {
    const statuses: DeploymentStatus[] = [
      "Available",
      "Booked",
      "In-Transit",
      "Maintenance",
    ];
    const bookings = ["", "RNT-0001", "RNT-0002", ""];
    const customers = ["", "Alex Tan", "Mei Lin Goh", ""];
    const sites = [
      "Jurong Port Depot",
      "En route to customer site",
      "Reserved — Marina South",
      "Service Center, Tuas",
    ];
    const notes = [
      "Fully serviced. Ready for next rental.",
      "Booked — delivery scheduled shortly.",
      "En route to customer site.",
      "Annual service due.",
    ];
    const idx = i % statuses.length;
    return {
      id: e.id,
      name: e.name,
      category: e.category,
      purchaseYear: e.purchaseYear,
      serialno: e.serialno,
      location: e.location,
      photo: resolvePhoto(e.img),
      deploymentStatus: statuses[idx],
      assignedBooking: bookings[idx],
      assignedCustomer: customers[idx],
      currentSite: sites[idx],
      lastUpdated: "2026-08-01 08:30",
      updatedBy: "Carlos Vega",
      notes: notes[idx],
      condition: e.condition ?? "GOOD",
    };
  });

// Read-only overview feed — no API resource backs rental lifecycle events, so this stays
// client-local, deterministic seed data (mirrors the shape a future Lifecycle entity would take).
const INITIAL_LIFECYCLES: RentalLifecycle[] = [
  {
    bookingId: "RNT-4821",
    customer: "Sarah Mitchell",
    equipment: "CAT 320 Hydraulic Excavator",
    serialno: "SN-EXC-2022-0001",
    currentStatus: "Active",
    events: [
      {
        id: "e1",
        timestamp: "2025-07-13 09:00",
        status: "Reserved",
        officer: "System",
        notes: "Deposit of S$1,869 received. Booking confirmed.",
        condition: "",
      },
      {
        id: "e2",
        timestamp: "2025-07-13 14:30",
        status: "Preparing",
        officer: "Carlos Vega",
        notes: "Hydraulic fluid topped. Tracks inspected. Loaded on flatbed.",
        condition: "EXCELLENT",
      },
      {
        id: "e3",
        timestamp: "2025-07-14 07:45",
        status: "Dispatched",
        officer: "James Tran",
        notes: "Departed depot. Estimated arrival 10:30.",
        odometer: "12,440 km",
      },
      {
        id: "e4",
        timestamp: "2025-07-14 10:55",
        status: "Active",
        officer: "James Tran",
        notes:
          "Delivered to 4820 Main St site. Customer signed delivery receipt.",
        condition: "EXCELLENT",
      },
    ],
  },
  {
    bookingId: "RNT-3904",
    customer: "Derek Okafor",
    equipment: "JLG 1350SJP Telescopic Boom",
    serialno: "SN-BOO-2023-0002",
    currentStatus: "Dispatched",
    events: [
      {
        id: "e5",
        timestamp: "2025-07-17 10:00",
        status: "Reserved",
        officer: "System",
        notes: "Deposit of S$2,160 received.",
        condition: "",
      },
      {
        id: "e6",
        timestamp: "2025-07-17 15:00",
        status: "Preparing",
        officer: "Carlos Vega",
        notes:
          "Boom sections inspected. Outrigger pads checked. Pre-delivery checklist complete.",
        condition: "GOOD",
      },
      {
        id: "e7",
        timestamp: "2025-07-18 06:30",
        status: "Dispatched",
        officer: "James Tran",
        notes: "Boom lift departed on flatbed. Route cleared.",
        odometer: "8,210 km",
      },
    ],
  },
  {
    bookingId: "RNT-3602",
    customer: "Sarah Mitchell",
    equipment: "Genie GS-1932 Scissors Lift",
    serialno: "SN-SCI-2024-0003",
    currentStatus: "Cleared",
    events: [
      {
        id: "e8",
        timestamp: "2025-06-04 09:00",
        status: "Reserved",
        officer: "System",
        notes: "Deposit of S$900 received.",
        condition: "",
      },
      {
        id: "e9",
        timestamp: "2025-06-04 13:00",
        status: "Preparing",
        officer: "Carlos Vega",
        notes: "Blade sharpened, tracks lubricated.",
        condition: "GOOD",
      },
      {
        id: "e10",
        timestamp: "2025-06-05 07:00",
        status: "Dispatched",
        officer: "James Tran",
        notes: "Loaded and en route.",
        odometer: "5,920 km",
      },
      {
        id: "e11",
        timestamp: "2025-06-05 09:30",
        status: "Active",
        officer: "James Tran",
        notes: "Delivered. Customer confirmed receipt.",
        condition: "GOOD",
      },
      {
        id: "e12",
        timestamp: "2025-06-09 16:00",
        status: "Return Initiated",
        officer: "System",
        notes: "Customer submitted return request via portal.",
      },
      {
        id: "e13",
        timestamp: "2025-06-10 08:00",
        status: "Returned",
        officer: "Carlos Vega",
        notes: "Collected from site. Minor mud build-up noted.",
        odometer: "5,952 km",
      },
      {
        id: "e14",
        timestamp: "2025-06-10 11:30",
        status: "Inspecting",
        officer: "Carlos Vega",
        notes: "Full wash. Engine hours logged. No structural damage.",
        condition: "GOOD",
      },
      {
        id: "e15",
        timestamp: "2025-06-10 14:00",
        status: "Cleared",
        officer: "James Tran",
        notes: "Cleared for re-rental. Balance S$2,100 collected.",
        condition: "GOOD",
      },
    ],
  },
  {
    bookingId: "RNT-3710",
    customer: "Priya Nair",
    equipment: "Toyota 8FBE15 Electric Fork Lift",
    serialno: "SN-FOR-2023-0004",
    currentStatus: "Reserved",
    events: [
      {
        id: "e16",
        timestamp: "2025-07-20 11:00",
        status: "Reserved",
        officer: "System",
        notes: "Deposit of S$576 received. Awaiting preparation.",
        condition: "",
      },
    ],
  },
];

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
  lifecycles: RentalLifecycle[];
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
  const [fleetSeededFrom, setFleetSeededFrom] =
    useState<typeof equipmentRes.data>(null);
  if (
    equipmentRes.status === "success" &&
    equipmentRes.data !== fleetSeededFrom
  ) {
    setFleetSeededFrom(equipmentRes.data);
    setFleet(buildFleetAssets(equipmentRes.data));
  }

  const [lifecycles] = useState<RentalLifecycle[]>(INITIAL_LIFECYCLES);

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
        lifecycles,
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
