import { Search, X, Wrench, Truck } from "lucide-react";
import { mono, display } from "../../lib/styles";
import type { AssetRecord } from "../../app/assetRecord";
import { formatCondition } from "../../app/assetRecord";

const conditionColor = (c: AssetRecord["condition"]) =>
  ({
    EXCELLENT: "text-green-400 bg-green-500/10 border-green-500/30",
    GOOD: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    FAIR: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    NEEDS_REPAIR: "text-red-400 bg-red-500/10 border-red-500/30",
  })[c];

export function EmployeeAssetsTab({
  assets,
  categories,
  search,
  setSearch,
  filterCat,
  setFilterCat,
  filterStatus,
  setFilterStatus,
  onAddNew,
  onEdit,
  onDelete,
}: {
  assets: AssetRecord[];
  categories: string[];
  search: string;
  setSearch: (v: string) => void;
  filterCat: string;
  setFilterCat: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  onAddNew: () => void;
  onEdit: (asset: AssetRecord) => void;
  onDelete: (id: number) => void;
}) {
  const filteredAssets = assets.filter((a) => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.serialno.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || a.category === filterCat;
    const matchStatus =
      filterStatus === "All" ||
      (filterStatus === "Available" ? a.available : !a.available);
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p
            className="text-xs text-primary font-semibold tracking-widest uppercase mb-2"
            style={mono}
          >
            Fleet Registry
          </p>
          <h1
            className="text-5xl font-black text-foreground leading-none"
            style={display}
          >
            ASSET RECORDS
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {assets.length} assets registered ·{" "}
            {assets.filter((a) => a.available).length} available
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all shrink-0"
        >
          + Add New Asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 flex-1 min-w-48">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or serial no…"
            className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
        >
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
        >
          <option value="All">All Statuses</option>
          <option value="Available">Available</option>
          <option value="On Rent">On Rent</option>
        </select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total Assets",
            value: assets.length,
            color: "text-foreground",
          },
          {
            label: "Available",
            value: assets.filter((a) => a.available).length,
            color: "text-green-400",
          },
          {
            label: "On Rent",
            value: assets.filter((a) => !a.available).length,
            color: "text-amber-400",
          },
          {
            label: "Need Service",
            value: assets.filter((a) => a.condition === "NEEDS_REPAIR").length,
            color: "text-red-400",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-card border border-border px-4 py-3 flex items-center justify-between"
          >
            <span className="text-xs text-muted-foreground" style={mono}>
              {label}
            </span>
            <span className={`text-2xl font-black ${color}`} style={display}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Asset table */}
      {filteredAssets.length === 0 ? (
        <div className="bg-card border border-border p-16 text-center">
          <Wrench
            size={32}
            className="text-muted-foreground mx-auto mb-4 opacity-40"
          />
          <p className="text-foreground font-semibold mb-1">No assets found</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "",
                    "Asset",
                    "Serial No.",
                    "Category",
                    "Location",
                    "Daily Rate",
                    "Condition",
                    "Status",
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
                {filteredAssets.map((a, i) => (
                  <tr
                    key={a.id}
                    className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                  >
                    <td className="pl-4 pr-2 py-3 w-14">
                      {a.photo ? (
                        <img
                          src={a.photo}
                          alt={a.name}
                          className="w-12 h-10 object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-10 bg-secondary border border-border flex items-center justify-center shrink-0">
                          <Truck
                            size={16}
                            className="text-muted-foreground opacity-40"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.purchaseYear} · {a.capacity}t capacity
                      </p>
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-muted-foreground"
                      style={mono}
                    >
                      {a.serialno}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {a.category}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {a.location}
                    </td>
                    <td
                      className="px-4 py-3 font-semibold text-foreground"
                      style={mono}
                    >
                      S${a.baseDailyRate.toLocaleString()}/day
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold border ${conditionColor(a.condition)}`}
                      >
                        {formatCondition(a.condition)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold border ${a.available ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}
                      >
                        {a.available ? "Available" : "On Rent"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEdit(a)}
                          className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(a.id)}
                          className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground" style={mono}>
              Showing {filteredAssets.length} of {assets.length} assets
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
