import { ChevronLeft, User, LogOut } from "lucide-react";
import { mono, display, sans } from "../../lib/styles";
import type { MyBooking } from "./myBookings";
import { formatBookingStatus, bookingStatusColor } from "../admin/adminFormat";

export interface ProfileForm {
  name: string;
  email: string;
  phone: string;
  company: string;
}

export function CustomerProfilePage({
  userName,
  goHome,
  onLogout,
  profileForm,
  setProfileForm,
  editMode,
  setEditMode,
  bookings,
  onBack,
}: {
  userName: string;
  goHome: () => void;
  onLogout: () => void;
  profileForm: ProfileForm;
  setProfileForm: (update: (prev: ProfileForm) => ProfileForm) => void;
  editMode: boolean;
  setEditMode: (open: boolean) => void;
  bookings: MyBooking[];
  onBack: () => void;
}) {
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navBar = (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
        <button
          onClick={goHome}
          className="text-xl font-black text-primary hover:opacity-80 transition-opacity"
          style={display}
        >
          HEAVY<span className="text-foreground"> RENTAL</span>
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div className="w-6 h-6 bg-primary/20 border border-primary/40 flex items-center justify-center">
              <User size={12} className="text-primary" />
            </div>
            <span>{userName}</span>
            <span
              className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10"
              style={mono}
            >
              CUSTOMER
            </span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {navBar}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group"
        >
          <ChevronLeft
            size={14}
            className="group-hover:-translate-x-0.5 transition-transform"
          />{" "}
          Back to Catalog
        </button>

        {/* Header */}
        <div className="flex items-start gap-6 mb-10">
          <div className="w-20 h-20 bg-primary/20 border-2 border-primary/40 flex items-center justify-center shrink-0">
            <span className="text-3xl font-black text-primary" style={display}>
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-xs text-primary font-semibold tracking-widest uppercase mb-1"
              style={mono}
            >
              Customer Account
            </p>
            <h1
              className="text-5xl font-black text-foreground leading-none mb-1"
              style={display}
            >
              {userName.toUpperCase()}
            </h1>
            <p className="text-sm text-muted-foreground">
              {profileForm.company} · Member since Jan 2024
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left col */}
          <div className="flex flex-col gap-5">
            {/* Personal info */}
            <div className="bg-card border border-border">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
                  style={mono}
                >
                  Personal Information
                </p>
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-3 py-1 text-xs font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditMode(false)}
                      className="px-3 py-1 text-xs font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="px-3 py-1 text-xs font-bold tracking-widest uppercase bg-primary text-primary-foreground hover:brightness-110 transition-all"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: "Full Name", key: "name" as const },
                  { label: "Email", key: "email" as const },
                  { label: "Phone", key: "phone" as const },
                  { label: "Company", key: "company" as const },
                ].map(({ label, key }) => (
                  <div key={key} className="px-5 py-3">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {label}
                    </p>
                    {editMode ? (
                      <input
                        value={profileForm[key]}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="w-full bg-secondary/50 border border-border px-2 py-1 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
                      />
                    ) : (
                      <p className="text-sm font-medium text-foreground">
                        {profileForm[key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-card border border-border p-5">
              <p
                className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4"
                style={mono}
              >
                Account Stats
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Bookings", value: bookings.length },
                  {
                    label: "Days Rented",
                    value: bookings.reduce((s, b) => s + b.days, 0),
                  },
                  {
                    label: "Total Spent",
                    value: `S$${bookings.reduce((s, b) => s + b.deposit, 0).toLocaleString()}`,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-secondary/40 border border-border px-3 py-3"
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {label}
                    </p>
                    <p
                      className="text-2xl font-black text-foreground"
                      style={display}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* My Bookings */}
            <div className="bg-card border border-border">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <p
                  className="text-xs font-semibold text-muted-foreground tracking-widest uppercase"
                  style={mono}
                >
                  My Bookings
                </p>
                <span className="text-xs text-muted-foreground">
                  {bookings.length}{" "}
                  {bookings.length === 1 ? "booking" : "bookings"}
                </span>
              </div>
              {bookings.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-muted-foreground text-sm">
                    No bookings yet.
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Bookings appear here once you complete a deposit payment.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="px-5 py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className="text-sm font-black text-foreground tracking-wide"
                            style={mono}
                          >
                            {b.id}
                          </p>
                          <span
                            className={`px-1.5 py-0.5 text-xs font-semibold border ${bookingStatusColor(b.status)}`}
                          >
                            {formatBookingStatus(b.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {b.equipment}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {b.dates}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            Deposit
                          </p>
                          <p
                            className="text-sm font-black text-foreground"
                            style={display}
                          >
                            S${b.deposit.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            Total
                          </p>
                          <p
                            className="text-lg font-black text-foreground"
                            style={display}
                          >
                            S${b.total.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deactivate — bottom of page, low visibility */}
        <div className="mt-16 pt-6 border-t border-border/40 flex justify-center">
          <button className="text-xs text-muted-foreground/40 hover:text-red-400/70 transition-colors underline underline-offset-4">
            Deactivate account
          </button>
        </div>
      </div>
    </div>
  );
}
