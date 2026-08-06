import { useState, type Dispatch, type SetStateAction } from "react";
import { Search, X, MapPin, Calendar, Truck } from "lucide-react";
import type { ConditionType } from "../../../app/assetRecord";
import { formatCondition } from "../../../app/assetRecord";
import { mono, display } from "../../../lib/styles";
import { DEPLOYMENT_META, type DeploymentStatus } from "../adminFormat";
import type { FleetAsset } from "../AdminDataContext";
import { FleetUpdateModal } from "./FleetUpdateModal";

export function FleetTab({
  fleet,
  setFleet,
  userName,
  showToast,
}: {
  fleet: FleetAsset[];
  setFleet: Dispatch<SetStateAction<FleetAsset[]>>;
  userName: string;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [fleetSelected, setFleetSelected] = useState<FleetAsset | null>(null);
  const [fleetUpdateOpen, setFleetUpdateOpen] = useState(false);
  const [fleetSearch, setFleetSearch] = useState("");
  const [fleetView, setFleetView] = useState<"kanban" | "table">("kanban");

  const handleFleetUpdate = (id: number, patch: Partial<FleetAsset>) => {
    // No API resource backs deployment/lifecycle tracking fields — stays fully client-local.
    setFleet((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...patch,
              lastUpdated: new Date()
                .toLocaleString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
                .replace(",", ""),
              updatedBy: userName,
            }
          : a,
      ),
    );
    setFleetUpdateOpen(false);
    setFleetSelected(null);
    showToast("Asset status updated.");
  };

  const filteredFleet = fleet.filter((a) => {
    const q = fleetSearch.toLowerCase();
    return (
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.serialno.toLowerCase().includes(q) ||
      a.currentSite.toLowerCase().includes(q) ||
      a.assignedCustomer.toLowerCase().includes(q)
    );
  });

  const conditionColor = (c: ConditionType) =>
    ({
      EXCELLENT: "text-green-400",
      GOOD: "text-blue-400",
      FAIR: "text-amber-400",
      NEEDS_REPAIR: "text-red-400",
    })[c];

  return (
    <>
      {fleetUpdateOpen && fleetSelected && (
        <FleetUpdateModal
          asset={fleetSelected}
          onClose={() => {
            setFleetUpdateOpen(false);
            setFleetSelected(null);
          }}
          onSave={handleFleetUpdate}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>
            Admin · Fleet Deployment Board
          </p>
          <h1 className="text-5xl font-black text-foreground leading-none" style={display}>
            FLEET BOARD
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {fleet.length} assets tracked · last refreshed {fleet[0]?.lastUpdated}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["kanban", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFleetView(v)}
              className={`px-4 py-2 text-xs font-bold tracking-widest uppercase border transition-all ${fleetView === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
            >
              {v === "kanban" ? "Board" : "Table"}
            </button>
          ))}
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(Object.keys(DEPLOYMENT_META) as DeploymentStatus[]).map((s) => {
          const count = fleet.filter((a) => a.deploymentStatus === s).length;
          const m = DEPLOYMENT_META[s];
          return (
            <div key={s} className={`border px-4 py-4 ${m.bg} ${m.border}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                <span className="text-xs text-muted-foreground" style={mono}>
                  {s}
                </span>
              </div>
              <p className={`text-4xl font-black leading-none ${m.color}`} style={display}>
                {count}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
            </div>
          );
        })}
      </div>

      {/* System indicator */}
      <div className="flex items-center gap-2 text-xs text-primary mb-4">
        <span>⚡ Deployment status is a simulated view derived from asset & booking data</span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card border border-border px-3 py-2.5 mb-6">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          value={fleetSearch}
          onChange={(e) => setFleetSearch(e.target.value)}
          placeholder="Search by asset name, serial, location, or customer…"
          className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full"
        />
        {fleetSearch && (
          <button onClick={() => setFleetSearch("")}>
            <X size={13} className="text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* ── KANBAN VIEW ── */}
      {fleetView === "kanban" && (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(Object.keys(DEPLOYMENT_META) as DeploymentStatus[]).map((col) => {
            const colAssets = filteredFleet.filter((a) => a.deploymentStatus === col);
            const m = DEPLOYMENT_META[col];
            return (
              <div key={col} className="flex flex-col gap-3">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2.5 border ${m.bg} ${m.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                    <span className={`text-xs font-black tracking-widest uppercase ${m.color}`} style={mono}>
                      {col}
                    </span>
                  </div>
                  <span className={`text-lg font-black ${m.color}`} style={display}>
                    {colAssets.length}
                  </span>
                </div>
                {/* Asset cards */}
                {colAssets.length === 0 && (
                  <div className="border border-dashed border-border py-10 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-muted-foreground">No assets</p>
                  </div>
                )}
                {colAssets.map((a) => (
                  <div
                    key={a.id}
                    className="bg-card border border-border flex flex-col hover:border-primary/30 transition-all"
                  >
                    {a.photo && (
                      <div className="h-28 bg-muted overflow-hidden">
                        <img src={a.photo} alt={a.name} className="w-full h-full object-cover opacity-70" />
                      </div>
                    )}
                    <div className="p-3 flex flex-col gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground" style={mono}>
                          {a.serialno}
                        </p>
                        <p className="font-black text-foreground leading-tight text-sm" style={display}>
                          {a.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.purchaseYear} · {a.category}
                        </p>
                      </div>
                      {/* Location */}
                      <div className="flex items-start gap-1.5">
                        <MapPin size={11} className="text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">{a.currentSite}</p>
                      </div>
                      {/* Booking link */}
                      {a.assignedBooking && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="text-muted-foreground shrink-0" />
                          <p className="text-xs">
                            <span className="text-primary font-semibold" style={mono}>
                              {a.assignedBooking}
                            </span>
                            <span className="text-muted-foreground"> · {a.assignedCustomer}</span>
                          </p>
                        </div>
                      )}
                      {/* Condition */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${conditionColor(a.condition)}`}>
                          {formatCondition(a.condition)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {a.lastUpdated.split(" ")[0]}
                        </span>
                      </div>
                      {a.notes && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2 leading-relaxed line-clamp-2">
                          {a.notes}
                        </p>
                      )}
                      <button
                        onClick={() => {
                          setFleetSelected(a);
                          setFleetUpdateOpen(true);
                        }}
                        className="w-full py-2 border border-border text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary/40 transition-all mt-1"
                      >
                        Update Status
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {fleetView === "table" && (
        <div className="bg-card border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "",
                    "Asset",
                    "Serial No.",
                    "Status",
                    "Current Location",
                    "Booking",
                    "Condition",
                    "Last Updated",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap"
                      style={mono}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFleet.map((a, i) => {
                  const m = DEPLOYMENT_META[a.deploymentStatus];
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                    >
                      <td className="pl-4 pr-2 py-3 w-14">
                        {a.photo ? (
                          <img src={a.photo} alt={a.name} className="w-12 h-10 object-cover border border-border" />
                        ) : (
                          <div className="w-12 h-10 bg-secondary border border-border flex items-center justify-center">
                            <Truck size={14} className="text-muted-foreground opacity-40" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.purchaseYear} · {a.category}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground" style={mono}>
                        {a.serialno}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border w-fit ${m.color} ${m.bg} ${m.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                          {a.deploymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">{a.currentSite}</p>
                      </td>
                      <td className="px-4 py-3">
                        {a.assignedBooking ? (
                          <div>
                            <p className="text-xs font-semibold text-primary" style={mono}>
                              {a.assignedBooking}
                            </p>
                            <p className="text-xs text-muted-foreground">{a.assignedCustomer}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold ${conditionColor(a.condition)}`}>
                          {formatCondition(a.condition)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-muted-foreground whitespace-nowrap" style={mono}>
                          {a.lastUpdated}
                        </p>
                        <p className="text-xs text-muted-foreground">{a.updatedBy}</p>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setFleetSelected(a);
                            setFleetUpdateOpen(true);
                          }}
                          className="px-3 py-1.5 border border-border text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground" style={mono}>
              Showing {filteredFleet.length} of {fleet.length} assets
            </p>
            <p className="text-xs text-muted-foreground">Updated by: {userName}</p>
          </div>
        </div>
      )}
    </>
  );
}
