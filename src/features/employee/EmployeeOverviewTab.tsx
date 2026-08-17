import {
  ArrowRight,
  Activity,
  DollarSign,
  Truck,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { mono, display } from "../../lib/styles";
import type { AssetRecord } from "../../app/assetRecord";
import type { MonthlyUtilization, StatusDistribution } from "../../app/types";

interface ChartTipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly ChartTipPayloadItem[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border px-3 py-2 text-xs">
      <p className="text-foreground font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={String(p.name ?? i)} style={{ color: p.color ?? "#f5a623" }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function EmployeeOverviewTab({
  assets,
  monthlyUtilization,
  statusDist,
  onManageAssets,
}: {
  assets: AssetRecord[];
  monthlyUtilization: MonthlyUtilization[];
  statusDist: StatusDistribution[];
  onManageAssets: () => void;
}) {
  const totalRevenue = assets.reduce((s, e) => s + e.revenue, 0);
  const avgUtilization = assets.length
    ? Math.round(assets.reduce((s, e) => s + e.utilization, 0) / assets.length)
    : 0;
  const totalHours = assets.reduce((s, e) => s + e.hoursThisMonth, 0);
  const utilizationData = assets.map((e) => ({
    name: e.name.split(" ").slice(0, 2).join(" "),
    utilization: e.utilization,
    target: 80,
  }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-10">
        <p
          className="text-xs text-primary font-semibold tracking-widest uppercase mb-2"
          style={mono}
        >
          Fleet Management · July 2025
        </p>
        <h1
          className="text-5xl font-black text-foreground leading-none"
          style={display}
        >
          FLEET PERFORMANCE
        </h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          {
            icon: Activity,
            label: "Avg Utilization",
            value: `${avgUtilization}%`,
            sub: "+4% vs last month",
            accent: true,
          },
          {
            icon: DollarSign,
            label: "Total Revenue",
            value: `S$${(totalRevenue / 1000).toFixed(0)}K`,
            sub: "This month",
          },
          {
            icon: Truck,
            label: "Operating Hours",
            value: totalHours.toLocaleString(),
            sub: "Across all machines",
          },
          {
            icon: AlertTriangle,
            label: "Maintenance Alerts",
            value: "2",
            sub: "Action required",
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
                size={16}
                className={
                  accent ? "text-primary-foreground/70" : "text-muted-foreground"
                }
              />
            </div>
            <p
              className={`text-4xl font-black leading-none ${accent ? "text-primary-foreground" : "text-foreground"}`}
              style={display}
            >
              {value}
            </p>
            <p
              className={`text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}
            >
              {sub}
            </p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-card border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1" style={mono}>
            PER-MACHINE
          </p>
          <h3 className="text-xl font-black text-foreground mb-5" style={display}>
            UTILIZATION RATE
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart id="emp-util-bar" data={utilizationData} barGap={6}>
              <XAxis
                dataKey="name"
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={(p) => (
                  <ChartTip
                    active={p.active}
                    payload={
                      p.payload as readonly ChartTipPayloadItem[] | undefined
                    }
                    label={
                      typeof p.label === "string" || typeof p.label === "number"
                        ? p.label
                        : undefined
                    }
                  />
                )}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="utilization" fill="#f5a623" radius={[2, 2, 0, 0]} />
              <Bar
                dataKey="target"
                fill="rgba(255,255,255,0.06)"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1" style={mono}>
            FLEET STATUS
          </p>
          <h3 className="text-xl font-black text-foreground mb-4" style={display}>
            DISTRIBUTION
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart id="emp-status-pie">
              <Pie
                data={statusDist}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                dataKey="value"
                paddingAngle={2}
              >
                {statusDist.map((entry, i) => (
                  <Cell key={`emp-sd-${i}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={(p) => (
                  <ChartTip
                    active={p.active}
                    payload={
                      p.payload as readonly ChartTipPayloadItem[] | undefined
                    }
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
            {statusDist.map(({ name, value, color }) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{name}</span>
                </div>
                <span className="text-xs font-semibold text-foreground" style={mono}>
                  {value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1" style={mono}>
            6-MONTH TREND
          </p>
          <h3 className="text-xl font-black text-foreground mb-4" style={display}>
            UTILIZATION
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart id="emp-util-line" data={monthlyUtilization}>
              <XAxis
                dataKey="month"
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[50, 100]}
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={(p) => (
                  <ChartTip
                    active={p.active}
                    payload={
                      p.payload as readonly ChartTipPayloadItem[] | undefined
                    }
                    label={
                      typeof p.label === "string" || typeof p.label === "number"
                        ? p.label
                        : undefined
                    }
                  />
                )}
              />
              <Line
                type="monotone"
                dataKey="utilization"
                stroke="#f5a623"
                strokeWidth={2}
                dot={{ fill: "#f5a623", r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1" style={mono}>
            6-MONTH TREND
          </p>
          <h3 className="text-xl font-black text-foreground mb-4" style={display}>
            REVENUE
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart id="emp-revenue-bar" data={monthlyUtilization}>
              <XAxis
                dataKey="month"
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#8a8478", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `S$${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                content={(p) => (
                  <ChartTip
                    active={p.active}
                    payload={
                      p.payload as readonly ChartTipPayloadItem[] | undefined
                    }
                    label={
                      typeof p.label === "string" || typeof p.label === "number"
                        ? p.label
                        : undefined
                    }
                  />
                )}
              />
              <Bar dataKey="revenue" fill="#f5a623" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-card border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5" style={mono}>
              ALL MACHINES
            </p>
            <h3 className="text-xl font-black text-foreground" style={display}>
              MACHINE BREAKDOWN
            </h3>
          </div>
          <button
            onClick={onManageAssets}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-semibold"
          >
            Manage assets <ArrowRight size={13} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Machine",
                  "Category",
                  "Location",
                  "Utilization",
                  "Op Hours",
                  "Revenue",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase"
                    style={mono}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((e, i) => (
                <tr
                  key={e.id}
                  className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                >
                  <td className="px-5 py-3">
                    <p className="font-semibold text-foreground text-sm">
                      {e.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.purchaseYear}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-sm">
                    {e.category}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-sm">
                    {e.location}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${e.utilization}%`,
                            background:
                              e.utilization >= 80
                                ? "#f5a623"
                                : e.utilization >= 60
                                  ? "#fbbf24"
                                  : "#f87171",
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-semibold text-foreground"
                        style={mono}
                      >
                        {e.utilization}%
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-5 py-3 text-sm font-medium text-foreground"
                    style={mono}
                  >
                    {e.hoursThisMonth}h
                  </td>
                  <td
                    className="px-5 py-3 text-sm font-semibold text-foreground"
                    style={mono}
                  >
                    S${e.revenue.toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold border ${e.available ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}
                    >
                      {e.available ? "Available" : "On Rent"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
