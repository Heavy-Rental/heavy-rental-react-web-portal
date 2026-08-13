import { useState, type Dispatch, type SetStateAction } from "react";
import { Search, X, Truck } from "lucide-react";
import type { AssetRecord, ConditionType } from "../../../app/assetRecord";
import { formatCondition, deriveAssetRecord } from "../../../app/assetRecord";
import { assetApi, ApiError } from "../../../app/api";
import type { Asset } from "../../../app/types";
import { mono, display, sans } from "../../../lib/styles";
import { AssetFormModal } from "./AssetFormModal";

const PAGE_SIZE = 5;

function conditionColor(c: ConditionType) {
  return {
    EXCELLENT: "text-green-400 bg-green-500/10 border-green-500/30",
    GOOD: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    FAIR: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    NEEDS_REPAIR: "text-red-400 bg-red-500/10 border-red-500/30",
  }[c];
}

export function AssetsTab({
  assets,
  setAssets,
  categories,
  showToast,
}: {
  assets: AssetRecord[];
  setAssets: Dispatch<SetStateAction<AssetRecord[]>>;
  categories: string[];
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [assetForm, setAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [assetNameError, setAssetNameError] = useState<string | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<number | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCatFilter, setAssetCatFilter] = useState("All");
  const [assetPage, setAssetPage] = useState(1);

  const openAssetForm = (a: AssetRecord | null) => {
    setEditingAsset(a);
    setAssetNameError(null);
    setAssetForm(true);
  };

  const closeAssetForm = () => {
    setAssetForm(false);
    setEditingAsset(null);
    setAssetNameError(null);
  };

  const handleAssetSave = async (a: AssetRecord) => {
    const isNew = !assets.some((x) => x.id === a.id);
    const previous = assets.find((x) => x.id === a.id);
    const photoChanged = !!a.photo?.startsWith("data:") && a.photo !== previous?.photo;
    setAssetNameError(null);
    try {
      let saved: Asset;
      if (isNew) {
        saved = await assetApi.create({
          name: a.name,
          category: a.category,
          baseDailyRate: a.baseDailyRate,
          minDailyRate: a.minDailyRate,
          maxDailyRate: a.maxDailyRate,
          weekly: a.weekly,
          capacity: a.capacity,
          platformHeight: a.platformHeight,
          purchaseYear: a.purchaseYear,
          location: a.location,
          rating: 0,
          reviews: 0,
          available: a.available,
          img: "photo-1630288214173-a119cf823388",
          tags: a.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          utilization: a.utilization,
          revenue: a.revenue,
          hoursThisMonth: a.hoursThisMonth,
          desc: a.desc,
          idealFor: [],
          serialno: a.serialno,
          condition: a.condition,
          lastConditionUpdatedAt: null,
        });
      } else {
        saved = await assetApi.update(a.id, {
          name: a.name,
          category: a.category,
          baseDailyRate: a.baseDailyRate,
          minDailyRate: a.minDailyRate,
          maxDailyRate: a.maxDailyRate,
          weekly: a.weekly,
          capacity: a.capacity,
          platformHeight: a.platformHeight,
          purchaseYear: a.purchaseYear,
          location: a.location,
          available: a.available,
          utilization: a.utilization,
          revenue: a.revenue,
          hoursThisMonth: a.hoursThisMonth,
          desc: a.desc,
          serialno: a.serialno,
          condition: a.condition,
        });
      }

      let photoWarning: string | null = null;
      if (photoChanged && a.photo) {
        try {
          saved = await assetApi.uploadImage(saved.id, a.photo);
        } catch (err) {
          if (err instanceof ApiError && err.code === "payload_too_large") {
            photoWarning = "the photo was too large to upload";
          } else {
            throw err;
          }
        }
      }

      const record = deriveAssetRecord(saved);
      setAssets((prev) =>
        isNew ? [...prev, record] : prev.map((x) => (x.id === record.id ? record : x)),
      );
      closeAssetForm();
      const baseMsg = isNew ? "New asset added." : "Asset updated.";
      showToast(photoWarning ? `${baseMsg} However, ${photoWarning}.` : baseMsg, photoWarning ? "error" : "success");
    } catch (err) {
      if (err instanceof ApiError && err.code === "forbidden") {
        showToast("You don't have permission to do this.", "error");
      } else if (err instanceof ApiError && err.code === "conflict") {
        setAssetNameError(err.message);
      } else {
        showToast(
          err instanceof Error ? err.message : "Failed to save asset.",
          "error",
        );
      }
    }
  };

  const handleAssetDelete = async (id: number) => {
    try {
      await assetApi.remove(id);
      setAssets((prev) => prev.filter((x) => x.id !== id));
      setDeleteAssetId(null);
      showToast("Asset deleted.", "error");
    } catch (err) {
      if (err instanceof ApiError && err.code === "forbidden") {
        showToast("You don't have permission to do this.", "error");
      } else {
        showToast(
          err instanceof Error ? err.message : "Failed to delete asset.",
          "error",
        );
      }
    }
  };

  const filteredAssets = assets.filter((a) => {
    const q = assetSearch.toLowerCase();
    return (
      (assetCatFilter === "All" || a.category === assetCatFilter) &&
      (!q ||
        a.name.toLowerCase().includes(q) ||
        a.serialno.toLowerCase().includes(q))
    );
  });
  const totalAssetPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const pagedAssets = filteredAssets.slice(
    (assetPage - 1) * PAGE_SIZE,
    assetPage * PAGE_SIZE,
  );

  return (
    <>
      {assetForm && (
        <AssetFormModal
          asset={editingAsset}
          onSave={handleAssetSave}
          onClose={closeAssetForm}
          nameError={assetNameError}
        />
      )}

      {deleteAssetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 max-w-sm w-full" style={sans}>
            <p className="font-black text-xl text-foreground mb-2" style={display}>
              DELETE ASSET?
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              This permanently removes the asset record. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteAssetId(null)}
                className="flex-1 py-2 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssetDelete(deleteAssetId)}
                className="flex-1 py-2 bg-red-500 text-white text-xs font-bold tracking-wider uppercase hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>
            Admin · Asset Management
          </p>
          <h1 className="text-5xl font-black text-foreground leading-none" style={display}>
            ASSET RECORDS
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {assets.length} assets · {assets.filter((a) => a.available).length} available ·{" "}
            {assets.filter((a) => a.condition === "NEEDS_REPAIR").length} need service
          </p>
        </div>
        <button
          onClick={() => openAssetForm(null)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-xs font-bold tracking-widest uppercase hover:bg-red-600 transition-all shrink-0"
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
            value={assetSearch}
            onChange={(e) => {
              setAssetSearch(e.target.value);
              setAssetPage(1);
            }}
            placeholder="Search by name or serial…"
            className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full"
          />
          {assetSearch && (
            <button
              onClick={() => {
                setAssetSearch("");
                setAssetPage(1);
              }}
            >
              <X size={13} className="text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <select
          value={assetCatFilter}
          onChange={(e) => setAssetCatFilter(e.target.value)}
          className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors"
        >
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Assets", value: assets.length, color: "text-foreground" },
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
          <div key={label} className="bg-card border border-border px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground" style={mono}>
              {label}
            </span>
            <span className={`text-2xl font-black ${color}`} style={display}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["", "Asset", "Serial No.", "Category", "Base Daily Rate", "Condition", "Status", "Actions"].map(
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
              {pagedAssets.map((a, i) => (
                <tr
                  key={a.id}
                  className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}
                >
                  <td className="pl-4 pr-2 py-3 w-14">
                    {a.photo ? (
                      <img
                        src={a.photo}
                        alt={a.name}
                        className="w-12 h-10 object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-10 bg-secondary border border-border flex items-center justify-center">
                        <Truck size={14} className="text-muted-foreground opacity-40" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.purchaseYear} · {a.capacity}t
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" style={mono}>
                    {a.serialno}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{a.category}</td>
                  <td className="px-4 py-3 font-semibold text-foreground" style={mono}>
                    S${a.baseDailyRate.toLocaleString()}/day
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold border ${conditionColor(a.condition)}`}>
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
                        onClick={() => openAssetForm(a)}
                        className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteAssetId(a.id)}
                        className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground" style={mono}>
            Showing {pagedAssets.length} of {filteredAssets.length} assets · Page {assetPage} of{" "}
            {totalAssetPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={assetPage === 1}
              onClick={() => setAssetPage((p) => p - 1)}
              className="px-2.5 py-1 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹ Prev
            </button>
            {Array.from({ length: totalAssetPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setAssetPage(p)}
                className={`w-7 h-7 text-xs font-bold border transition-all ${assetPage === p ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={assetPage === totalAssetPages}
              onClick={() => setAssetPage((p) => p + 1)}
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
