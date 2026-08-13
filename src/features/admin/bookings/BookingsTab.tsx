import { useState, type Dispatch, type SetStateAction } from "react";
import { Search, X } from "lucide-react";
import { bookingApi } from "../../../app/api";
import type { BookingStatus } from "../../../app/types";
import { mono, display } from "../../../lib/styles";
import { BOOKING_STATUSES, formatBookingStatus } from "../adminFormat";
import type { BookingRow } from "../AdminDataContext";

const PAGE_SIZE = 5;

function bookingStatusColor(s: BookingStatus) {
  return {
    PENDING_DEPOSIT: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    PENDING_CONFIRMED: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    CONFIRMED: "text-green-400 bg-green-500/10 border-green-500/30",
    MOBILISED: "text-violet-400 bg-violet-500/10 border-violet-500/30",
    COMPLETED: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    CANCELLED: "text-red-400 bg-red-500/10 border-red-500/30",
  }[s];
}

// The stats row groups the two "money not yet settled" statuses (PENDING_DEPOSIT —
// no deposit paid yet, and PENDING_CONFIRMED — deposit paid, awaiting admin
// confirmation) under a single "Pending Payments" card, since from an admin's glance
// they're the same "needs my attention before this is a real booking" bucket. The
// status filter dropdown and each row's inline editor still expose both individually —
// only this summary card collapses them.
const BOOKING_STAT_GROUPS: { label: string; statuses: BookingStatus[]; color: string }[] = [
  { label: "Pending Payments", statuses: ["PENDING_DEPOSIT", "PENDING_CONFIRMED"], color: "text-amber-400" },
  { label: "Confirmed", statuses: ["CONFIRMED"], color: "text-green-400" },
  { label: "Mobilised", statuses: ["MOBILISED"], color: "text-violet-400" },
  { label: "Completed", statuses: ["COMPLETED"], color: "text-blue-400" },
  { label: "Cancelled", statuses: ["CANCELLED"], color: "text-red-400" },
];
export function BookingsTab({
  bookings,
  setBookings,
  showToast,
}: {
  bookings: BookingRow[];
  setBookings: Dispatch<SetStateAction<BookingRow[]>>;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("All");
  const [bookingPage, setBookingPage] = useState(1);

  const handleBookingStatus = async (apiId: number, status: BookingStatus) => {
    try {
      await bookingApi.update(apiId, { status });
      setBookings((prev) =>
        prev.map((b) => (b.apiId === apiId ? { ...b, status } : b)),
      );
      showToast(`Booking marked as ${formatBookingStatus(status)}.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update booking status.",
        "error",
      );
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const q = bookingSearch.toLowerCase();
    return (
      (bookingStatusFilter === "All" || b.status === bookingStatusFilter) &&
      (!q ||
        b.id.toLowerCase().includes(q) ||
        b.customer.toLowerCase().includes(q) ||
        b.equipment.toLowerCase().includes(q))
    );
  });
  const totalBookingPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const pagedBookings = filteredBookings.slice(
    (bookingPage - 1) * PAGE_SIZE,
    bookingPage * PAGE_SIZE,
  );

  return (
    <>
      <div className="mb-8">
        <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>
          Admin · Booking Management
        </p>
        <h1 className="text-5xl font-black text-foreground leading-none" style={display}>
          BOOKINGS
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {bookings.length} total bookings · S$
          {bookings.reduce((s, b) => s + b.deposit, 0).toLocaleString()} deposits collected
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {BOOKING_STAT_GROUPS.map(({ label, statuses, color }) => {
          const count = bookings.filter((b) => statuses.includes(b.status)).length;
          return (
            <div key={label} className="bg-card border border-border px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground" style={mono}>
                {label}
              </span>
              <span className={`text-2xl font-black ${color}`} style={display}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 flex-1 min-w-48">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={bookingSearch}
            onChange={(e) => {
              setBookingSearch(e.target.value);
              setBookingPage(1);
            }}
            placeholder="Search by ID, customer, or equipment…"
            className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full"
          />
          {bookingSearch && (
            <button
              onClick={() => {
                setBookingSearch("");
                setBookingPage(1);
              }}
            >
              <X size={13} className="text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <select
          value={bookingStatusFilter}
          onChange={(e) => {
            setBookingStatusFilter(e.target.value);
            setBookingPage(1);
          }}
          className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors"
        >
          <option value="All">All Statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatBookingStatus(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Booking ID", "Customer", "Equipment", "Depot", "Dates", "Deposit", "Total", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap"
                      style={mono}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {pagedBookings.map((b, i) => (
                <tr
                  key={b.id}
                  className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                >
                  <td className="px-4 py-3 font-semibold text-primary text-xs" style={mono}>
                    {b.id}
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">{b.customer}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-48 truncate">{b.equipment}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{b.depot}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{b.dates}</td>
                  <td className="px-4 py-3 font-semibold text-green-400" style={mono}>
                    S${b.deposit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground" style={mono}>
                    S${b.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={b.status}
                      onChange={(e) => handleBookingStatus(b.apiId, e.target.value as BookingStatus)}
                      className={`px-2 py-0.5 text-xs font-semibold border outline-none bg-transparent ${bookingStatusColor(b.status)}`}
                    >
                      {BOOKING_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-card text-foreground">
                          {formatBookingStatus(s)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground" style={mono}>
            Showing {pagedBookings.length} of {filteredBookings.length} bookings · Page {bookingPage} of{" "}
            {totalBookingPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={bookingPage === 1}
              onClick={() => setBookingPage((p) => p - 1)}
              className="px-2.5 py-1 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹ Prev
            </button>
            {Array.from({ length: totalBookingPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setBookingPage(p)}
                className={`w-7 h-7 text-xs font-bold border transition-all ${bookingPage === p ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={bookingPage === totalBookingPages}
              onClick={() => setBookingPage((p) => p + 1)}
              className="px-2.5 py-1 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next ›
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
