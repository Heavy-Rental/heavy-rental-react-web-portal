import { useState } from "react";
import { BarChart2, Wrench, Truck, Calendar, User, LogOut, CheckCircle } from "lucide-react";
import { sans, display, mono } from "../../lib/styles";
import { AdminDataProvider, useAdminData, type AdminTab } from "./AdminDataContext";
import { OverviewTab } from "./overview/OverviewTab";
import { AssetsTab } from "./assets/AssetsTab";
import { FleetTab } from "./fleet/FleetTab";
import { BookingsTab } from "./bookings/BookingsTab";
import { UsersTab } from "./users/UsersTab";

function AdminDashboardContent({
  userName,
  onLogout,
}: {
  userName: string;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  // Clicking the logo returns to the overview tab — it must never touch
  // auth/session state (see handleLogout in App.tsx).
  const goHome = () => setActiveTab("overview");
  const data = useAdminData();

  if (data.dataStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={sans}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (data.dataStatus === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center" style={sans}>
        <div>
          <p className="text-foreground font-semibold mb-2">Couldn't reach the mock API.</p>
          <p className="text-sm text-muted-foreground">{data.dataError}</p>
        </div>
      </div>
    );
  }

  const TABS: { key: AdminTab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: BarChart2 },
    { key: "assets", label: "Asset Records", icon: Wrench },
    { key: "fleet", label: "Fleet Board", icon: Truck },
    { key: "bookings", label: "Bookings", icon: Calendar },
    { key: "users", label: "Users", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {/* Toast */}
      {data.toast && (
        <div
          className={`fixed top-4 right-4 z-50 border px-4 py-3 text-sm flex items-center gap-2 shadow-xl ${data.toast.type === "error" ? "bg-card border-red-500/40 text-red-400" : "bg-card border-primary/40 text-foreground"}`}
        >
          <CheckCircle
            size={15}
            className={data.toast.type === "error" ? "text-red-400" : "text-primary"}
          />
          {data.toast.msg}
        </div>
      )}

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={goHome}
              className="text-xl font-black text-primary hover:opacity-80 transition-opacity"
              style={display}
            >
              HEAVY<span className="text-foreground"> RENTAL</span>
            </button>
            <span
              className="text-xs border border-red-500/30 text-red-400 px-1.5 py-0.5 bg-red-500/10 uppercase tracking-wider"
              style={mono}
            >
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              System Online
            </div>
            <span className="text-sm text-muted-foreground">{userName}</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-0 border-t border-border">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all ${activeTab === key ? "border-red-400 text-red-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {activeTab === "overview" && (
          <OverviewTab
            fleet={data.fleet}
            assets={data.assets}
            monthlyUtilization={data.monthlyUtilization}
            bookings={data.bookings}
            users={data.users}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === "assets" && (
          <AssetsTab
            assets={data.assets}
            setAssets={data.setAssets}
            categories={data.categories}
            onRentAssetIds={data.onRentAssetIds}
            showToast={data.showToast}
          />
        )}
        {activeTab === "fleet" && (
          <FleetTab
            fleet={data.fleet}
            setFleet={data.setFleet}
            assets={data.assets}
            setAssets={data.setAssets}
            userName={userName}
            showToast={data.showToast}
          />
        )}
        {activeTab === "bookings" && (
          <BookingsTab
            bookings={data.bookings}
            setBookings={data.setBookings}
            showToast={data.showToast}
          />
        )}
        {activeTab === "users" && (
          <UsersTab users={data.users} setUsers={data.setUsers} showToast={data.showToast} />
        )}
      </div>
    </div>
  );
}

export function AdminDashboard(props: { userName: string; onLogout: () => void }) {
  return (
    <AdminDataProvider>
      <AdminDashboardContent {...props} />
    </AdminDataProvider>
  );
}
