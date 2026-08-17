import { useState } from "react";
import { BarChart2, Wrench, LogOut, CheckCircle } from "lucide-react";
import { assetApi, monthlyUtilizationApi, statusDistributionApi } from "../../app/api";
import { useApiResource } from "../../app/useApiResource";
import { deriveAssetRecord, type AssetRecord } from "../../app/assetRecord";
import { mono, display, sans } from "../../lib/styles";
import { AssetFormModal } from "../admin/assets/AssetFormModal";
import { EmployeeOverviewTab } from "./EmployeeOverviewTab";
import { EmployeeAssetsTab } from "./EmployeeAssetsTab";

export function EmployeeDashboard({
  userName,
  onLogout,
}: {
  userName: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"dashboard" | "assets">("dashboard");
  // Clicking the logo returns to the dashboard tab — it must never touch
  // auth/session state (see handleLogout in App).
  const goHome = () => setTab("dashboard");
  const equipmentRes = useApiResource((signal) => assetApi.list(undefined, signal));
  const equipment = equipmentRes.data ?? [];
  const monthlyUtilRes = useApiResource((signal) => monthlyUtilizationApi.list(signal));
  const monthlyUtilization = monthlyUtilRes.data ?? [];
  const statusDistRes = useApiResource((signal) => statusDistributionApi.list(signal));
  const statusDist = statusDistRes.data ?? [];
  const categories = Array.from(new Set(equipment.map((e) => e.category)));

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [seededFrom, setSeededFrom] = useState<typeof equipmentRes.data>(null);
  if (equipmentRes.status === "success" && equipmentRes.data !== seededFrom) {
    setSeededFrom(equipmentRes.data);
    setAssets(equipmentRes.data.map(deriveAssetRecord));
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = (a: AssetRecord) => {
    setAssets((prev) =>
      prev.some((x) => x.id === a.id)
        ? prev.map((x) => (x.id === a.id ? a : x))
        : [...prev, a],
    );
    setFormOpen(false);
    setEditingAsset(null);
    showToast(
      editingAsset ? "Asset updated successfully." : "New asset added to fleet.",
    );
  };

  const handleDelete = (id: number) => {
    setAssets((prev) => prev.filter((x) => x.id !== id));
    setDeleteId(null);
    showToast("Asset removed from fleet.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-card border border-primary/40 px-4 py-3 text-sm text-foreground flex items-center gap-2 shadow-xl">
          <CheckCircle size={15} className="text-primary shrink-0" />
          {toast}
        </div>
      )}

      {/* Asset form modal */}
      {formOpen && (
        <AssetFormModal
          asset={editingAsset}
          onSave={handleSave}
          onClose={() => {
            setFormOpen(false);
            setEditingAsset(null);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div
            className="bg-card border border-border p-6 max-w-sm w-full"
            style={sans}
          >
            <p className="font-black text-xl text-foreground mb-2" style={display}>
              REMOVE ASSET?
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently remove the asset record from the fleet. This
              action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 py-2 bg-red-500 text-white text-xs font-bold tracking-wider uppercase hover:bg-red-600 transition-all"
              >
                Remove
              </button>
            </div>
          </div>
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
              className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10 uppercase tracking-wider"
              style={mono}
            >
              Employee
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Live
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
          {[
            { key: "dashboard", icon: BarChart2, label: "Dashboard" },
            { key: "assets", icon: Wrench, label: "Asset Records" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as "dashboard" | "assets")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "dashboard" && (
        <EmployeeOverviewTab
          assets={assets}
          monthlyUtilization={monthlyUtilization}
          statusDist={statusDist}
          onManageAssets={() => setTab("assets")}
        />
      )}

      {tab === "assets" && (
        <EmployeeAssetsTab
          assets={assets}
          categories={categories}
          search={search}
          setSearch={setSearch}
          filterCat={filterCat}
          setFilterCat={setFilterCat}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          onAddNew={() => {
            setEditingAsset(null);
            setFormOpen(true);
          }}
          onEdit={(a) => {
            setEditingAsset(a);
            setFormOpen(true);
          }}
          onDelete={(id) => setDeleteId(id)}
        />
      )}
    </div>
  );
}
