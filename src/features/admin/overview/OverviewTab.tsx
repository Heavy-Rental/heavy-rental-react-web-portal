import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Truck, Activity, BarChart2, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import type { AssetRecord } from "../../../app/assetRecord";
import { formatCondition } from "../../../app/assetRecord";
import { mono, display } from "../../../lib/styles";
import {
  BOOKING_STATUSES,
  formatBookingStatus,
  DEPLOYMENT_META,
  LIFECYCLE_META,
  formatTimestamp,
} from "../adminFormat";
import type { AdminTab, FleetAsset, BookingRow, RentalLifecycle } from "../AdminDataContext";

interface ChartTipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
}

function ChartTip({
  active,
  payload,
  label,
  unit,
  valueFormatter,
}: {
  active?: boolean;
  payload?: readonly ChartTipPayloadItem[];
  label?: string | number;
  unit?: string;
  valueFormatter?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs">
      <p className="text-foreground font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={String(p.name ?? i)} style={{ color: p.color ?? "#f5a623" }}>
          {p.name}: {valueFormatter ? valueFormatter(p.value ?? "") : `${p.value}${unit ?? ""}`}
        </p>
      ))}
    </div>
  );
}

export function OverviewTab({
  fleet,
  assets,
  monthlyUtilization,
  bookings,
  lifecycles,
  onNavigate,
}: {
  fleet: FleetAsset[];
  assets: AssetRecord[];
  monthlyUtilization: { id: number; month: string; utilization: number; revenue: number }[];
  bookings: BookingRow[];
  lifecycles: RentalLifecycle[];
  onNavigate: (tab: AdminTab) => void;
}) {
  // Derived metrics from live state
  const totalAssets = fleet.length;
  const activeRentals = fleet.filter(
    (a) => a.deploymentStatus === "Booked" || a.deploymentStatus === "In-Transit",
  ).length;
  const availableCount = fleet.filter(
    (a) => a.deploymentStatus === "Available",
  ).length;
  const inTransitCount = fleet.filter(
    (a) => a.deploymentStatus === "In-Transit",
  ).length;
  const maintenanceCount = fleet.filter(
    (a) => a.deploymentStatus === "Maintenance",
  ).length;
  const utilizationRate = Math.round((activeRentals / totalAssets) * 100);
  const monthRevenue = monthlyUtilization[monthlyUtilization.length - 1].revenue;
  const prevMonthRevenue = monthlyUtilization[monthlyUtilization.length - 2].revenue;
  const revChange = Math.round(
    ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100,
  );
  const pendingBookings = bookings.filter((b) => b.paidStatus === "UNPAID").length;
  const needsRepair = fleet.filter((a) => a.condition === "NEEDS_REPAIR").length;
  const pendingActions = pendingBookings + needsRepair;

  const fleetHealthData: { name: string; value: number; color: string }[] = [
    { name: "Available", value: availableCount, color: "#4ade80" },
    {
      name: "Booked",
      value: fleet.filter((a) => a.deploymentStatus === "Booked").length,
      color: "#f5a623",
    },
    { name: "In-Transit", value: inTransitCount, color: "#a78bfa" },
    { name: "Maintenance", value: maintenanceCount, color: "#f87171" },
  ].filter((d) => d.value > 0);

  const utilizationByAsset = fleet.map((a) => ({
    name: a.name.split(" ").slice(0, 2).join(" "),
    utilization: Math.round(assets.find((x) => x.id === a.id)?.utilization ?? 0),
    status: a.deploymentStatus,
  }));

  const bookingBreakdown = BOOKING_STATUSES.map((s) => ({
    name: formatBookingStatus(s),
    value: bookings.filter((b) => b.status === s).length,
    color: {
      PENDING: "#f5a623",
      CONFIRMED: "#4ade80",
      MOBILISED: "#a78bfa",
      COMPLETED: "#60a5fa",
      CANCELLED: "#f87171",
    }[s],
  }));

  const totalDeposits = bookings.reduce((s, b) => s + b.deposit, 0);
  const totalBookingValue = bookings.reduce((s, b) => s + b.total, 0);

  const ALERTS: {
    level: "critical" | "warning" | "info";
    msg: string;
    action: AdminTab;
  }[] = [
    ...fleet
      .filter((a) => a.condition === "NEEDS_REPAIR")
      .map((a) => ({
        level: "critical" as const,
        msg: `${a.name} requires immediate maintenance.`,
        action: "fleet" as AdminTab,
      })),
    ...bookings
      .filter((b) => b.paidStatus === "UNPAID")
      .map((b) => ({
        level: "warning" as const,
        msg: `Booking ${b.id} (${b.customer}) awaiting deposit.`,
        action: "bookings" as AdminTab,
      })),
    ...fleet
      .filter((a) => a.deploymentStatus === "In-Transit")
      .map((a) => ({
        level: "info" as const,
        msg: `${a.name} currently in transit — track in Fleet Board.`,
        action: "fleet" as AdminTab,
      })),
  ];

  const recentEvents = lifecycles
    .flatMap((lc) =>
      lc.events.slice(-1).map((e) => ({
        bookingId: lc.bookingId,
        equipment: lc.equipment,
        status: e.status,
        timestamp: e.timestamp,
        officer: e.officer,
      })),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);

  const alertColors = {
    critical: "border-red-500/40 bg-red-500/5",
    warning: "border-amber-500/40 bg-amber-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
  };
  const alertDot = {
    critical: "bg-red-400",
    warning: "bg-amber-400",
    info: "bg-blue-400",
  };
  const alertText = {
    critical: "text-red-400",
    warning: "text-amber-400",
    info: "text-blue-400",
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <p
          className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2"
          style={mono}
        >
          Admin · Operations Dashboard
        </p>
        <h1 className="text-5xl font-black text-foreground leading-none" style={display}>
          OVERVIEW
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          As of{" "}
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
        {[
          {
            icon: Truck,
            label: "Total Assets",
            value: totalAssets,
            sub: `${availableCount} available`,
            accent: false,
          },
          {
            icon: Activity,
            label: "Active Rentals",
            value: activeRentals,
            sub: `${inTransitCount} in transit`,
            accent: true,
          },
          {
            icon: BarChart2,
            label: "Utilization Rate",
            value: `${utilizationRate}%`,
            sub: "of fleet deployed",
            accent: false,
          },
          {
            icon: DollarSign,
            label: "This Month Revenue",
            value: `S$${(monthRevenue / 1000).toFixed(0)}K`,
            sub: `${revChange >= 0 ? "+" : ""}${revChange}% vs last month`,
            accent: false,
          },
          {
            icon: AlertTriangle,
            label: "Pending Actions",
            value: pendingActions,
            sub: `${needsRepair} maintenance · ${pendingBookings} bookings`,
            accent: pendingActions > 0,
          },
        ].map(({ icon: Icon, label, value, sub, accent }) => (
          <div
            key={label}
            className={`p-5 border flex flex-col gap-3 ${accent ? "bg-primary border-primary" : "bg-card border-border"}`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold tracking-wider uppercase ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                style={mono}
              >
                {label}
              </span>
              <Icon
                size={15}
                className={accent ? "text-primary-foreground/70" : "text-muted-foreground"}
              />
            </div>
            <p
              className={`text-4xl font-black leading-none ${accent ? "text-primary-foreground" : "text-foreground"}`}
              style={display}
            >
              {value}
            </p>
            <p className={`text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {sub}
            </p>
          </div>
        ))}
      </div>

      {/* Row 2: utilization bar + fleet health donut */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-card border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1" style={mono}>
            PER ASSET
          </p>
          <h3 className="text-xl font-black text-foreground mb-5" style={display}>
            UTILIZATION RATE
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={utilizationByAsset} barGap={4}>
              <XAxis
                key="adm-ua-xaxis"
                dataKey="name"
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                key="adm-ua-yaxis"
                domain={[0, 100]}
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                key="adm-ua-tip"
                content={(p) => (
                  <ChartTip
                    active={p.active}
                    payload={p.payload as readonly ChartTipPayloadItem[] | undefined}
                    label={
                      typeof p.label === "string" || typeof p.label === "number"
                        ? p.label
                        : undefined
                    }
                    unit="%"
                  />
                )}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar key="adm-ua-bar" dataKey="utilization" radius={[2, 2, 0, 0]} name="Utilization">
                {utilizationByAsset.map((entry, i) => (
                  <Cell
                    key={`adm-ua-${i}`}
                    fill={
                      entry.utilization >= 80
                        ? "#f5a623"
                        : entry.utilization >= 60
                          ? "#fbbf24"
                          : "#f87171"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1" style={mono}>
            LIVE COUNT
          </p>
          <h3 className="text-xl font-black text-foreground mb-4" style={display}>
            FLEET HEALTH
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                key="adm-fh-pie"
                data={fleetHealthData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={60}
                dataKey="value"
                paddingAngle={2}
                name="adm-fleet-health"
              >
                {fleetHealthData.map((d, i) => (
                  <Cell key={`adm-fh-${i}`} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                key="adm-fh-tip"
                content={(p) => (
                  <ChartTip
                    active={p.active}
                    payload={p.payload as readonly ChartTipPayloadItem[] | undefined}
                    label={
                      typeof p.label === "string" || typeof p.label === "number"
                        ? p.label
                        : undefined
                    }
                  />
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 mt-2">
            {fleetHealthData.map(({ name, value, color }) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{name}</span>
                </div>
                <span className="text-xs font-semibold text-foreground" style={mono}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: revenue trend + booking breakdown */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-card border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1" style={mono}>
            6-MONTH TREND
          </p>
          <h3 className="text-xl font-black text-foreground mb-1" style={display}>
            REVENUE
          </h3>
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-semibold ${revChange >= 0 ? "text-green-400" : "text-red-400"}`}>
              {revChange >= 0 ? "▲" : "▼"} {Math.abs(revChange)}%
            </span>
            <span className="text-xs text-muted-foreground">vs previous month</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyUtilization}>
              <XAxis
                key="adm-rev-xaxis"
                dataKey="month"
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                key="adm-rev-yaxis"
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `S$${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                key="adm-rev-tip"
                content={(p) => (
                  <ChartTip
                    active={p.active}
                    payload={p.payload as readonly ChartTipPayloadItem[] | undefined}
                    label={
                      typeof p.label === "string" || typeof p.label === "number"
                        ? p.label
                        : undefined
                    }
                    valueFormatter={(v) => `S$${Number(v).toLocaleString()}`}
                  />
                )}
              />
              <Bar
                key="adm-rev-bar"
                dataKey="revenue"
                fill="#f5a623"
                radius={[2, 2, 0, 0]}
                name="Revenue"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1" style={mono}>
            ALL BOOKINGS
          </p>
          <h3 className="text-xl font-black text-foreground mb-4" style={display}>
            BOOKING STATUS
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {bookingBreakdown.map(({ name, value, color }) => (
              <div key={name} className="border border-border bg-secondary/20 px-3 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{name}</span>
                </div>
                <p className="text-3xl font-black text-foreground" style={display}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Deposits Collected</p>
              <p className="text-xl font-black text-green-400" style={display}>
                S${totalDeposits.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Booking Value</p>
              <p className="text-xl font-black text-foreground" style={display}>
                S${totalBookingValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: alerts + recent activity */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Alerts */}
        <div className="bg-card border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5" style={mono}>
                REQUIRES ATTENTION
              </p>
              <h3 className="text-xl font-black text-foreground" style={display}>
                ALERTS
              </h3>
            </div>
            {pendingActions > 0 && (
              <span className="w-6 h-6 bg-red-500 text-white text-xs font-black flex items-center justify-center">
                {pendingActions}
              </span>
            )}
          </div>
          {ALERTS.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-foreground font-semibold">All clear</p>
              <p className="text-xs text-muted-foreground mt-1">No alerts at this time.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ALERTS.map((alert, i) => (
                <div
                  key={i}
                  className={`px-5 py-3 flex items-start gap-3 border-l-2 ${alertColors[alert.level]} ${alert.level === "critical" ? "border-l-red-500" : alert.level === "warning" ? "border-l-amber-400" : "border-l-blue-400"}`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${alertDot[alert.level]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{alert.msg}</p>
                    <button
                      onClick={() => onNavigate(alert.action)}
                      className={`text-xs font-semibold mt-0.5 hover:underline ${alertText[alert.level]}`}
                    >
                      Go to {alert.action} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent lifecycle events */}
        <div className="bg-card border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5" style={mono}>
                LATEST TRANSITIONS
              </p>
              <h3 className="text-xl font-black text-foreground" style={display}>
                RECENT ACTIVITY
              </h3>
            </div>
            <button
              onClick={() => onNavigate("bookings")}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-border">
            {recentEvents.map((ev, i) => {
              const m = LIFECYCLE_META[ev.status];
              return (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-bold border shrink-0 ${m.color} ${m.bg} ${m.border}`}>
                    {ev.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {ev.equipment.split(" ").slice(0, 3).join(" ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ev.bookingId} · {ev.officer}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0" style={mono}>
                    {ev.timestamp.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 5: asset condition breakdown table */}
      <div className="bg-card border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5" style={mono}>
              FULL FLEET
            </p>
            <h3 className="text-xl font-black text-foreground" style={display}>
              ASSET HEALTH SNAPSHOT
            </h3>
          </div>
          <button
            onClick={() => onNavigate("assets")}
            className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold"
          >
            Manage assets →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Asset", "Deployment", "Utilization", "Condition", "Location", "Last Updated"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap"
                      style={mono}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {fleet.map((a, i) => {
                const util = assets.find((x) => x.id === a.id)?.utilization ?? 0;
                const dm = DEPLOYMENT_META[a.deploymentStatus];
                return (
                  <tr
                    key={a.id}
                    className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.purchaseYear} · {a.serialno}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold border w-fit ${dm.color} ${dm.bg} ${dm.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dm.dot}`} />
                        {a.deploymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${util}%`,
                              background: util >= 80 ? "#f5a623" : util >= 60 ? "#fbbf24" : "#f87171",
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-foreground" style={mono}>
                          {util}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-semibold ${{ EXCELLENT: "text-green-400", GOOD: "text-blue-400", FAIR: "text-amber-400", NEEDS_REPAIR: "text-red-400" }[a.condition]}`}
                      >
                        {formatCondition(a.condition)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{a.currentSite}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground" style={mono}>
                      {formatTimestamp(a.lastUpdated)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
