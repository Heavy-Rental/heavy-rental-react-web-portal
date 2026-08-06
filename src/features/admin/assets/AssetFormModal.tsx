import { useState, useRef } from "react";
import { X } from "lucide-react";
import type { AssetRecord } from "../../../app/assetRecord";
import { formatCondition } from "../../../app/assetRecord";
import type { ConditionType } from "../../../app/types";
import { mono, display, sans } from "../../../lib/styles";
import { CONDITIONS } from "../adminFormat";

// The 4 approved equipment categories and Singapore depots (Spec-ui-heavy-machinery-portal.md
// §§4.1, 4.6) — fixed by business rule, used here (not the fetched equipment list) since
// AssetFormModal is a standalone component shared with App.tsx's EmployeeDashboard.
const CATEGORIES_LIST = ["Boom Lift", "Scissors Lift", "Fork Lift", "Excavator"];
const LOCATIONS_LIST = ["Jurong Port", "Pioneer", "Tuas", "Marina South"];

const EMPTY_ASSET: Omit<AssetRecord, "id"> = {
  name: "",
  category: "Excavator",
  purchaseYear: 2024,
  location: "Jurong Port",
  baseDailyRate: 0,
  minDailyRate: 0,
  maxDailyRate: 0,
  weekly: 0,
  capacity: 0,
  platformHeight: null,
  available: true,
  utilization: 0,
  hoursThisMonth: 0,
  revenue: 0,
  tags: "",
  desc: "",
  serialno: "",
  condition: "GOOD",
  lastConditionUpdatedAt: "",
  photo: null,
};

function AssetFormField({
  label,
  type = "text",
  placeholder = "",
  required = false,
  value,
  error,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string | number | boolean;
  error?: string;
  onChange: (val: string | number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={String(value)}
        onChange={(e) =>
          onChange(type === "number" ? Number(e.target.value) : e.target.value)
        }
        placeholder={placeholder}
        className={`w-full bg-secondary/50 border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors ${error ? "border-red-500/60" : "border-border"}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export function AssetFormModal({
  asset,
  onSave,
  onClose,
}: {
  asset: AssetRecord | null;
  onSave: (a: AssetRecord) => void;
  onClose: () => void;
}) {
  const isNew = !asset;
  const [form, setForm] = useState<Omit<AssetRecord, "id">>(
    asset ? { ...asset } : { ...EMPTY_ASSET },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Omit<AssetRecord, "id">>(
    field: K,
    val: Omit<AssetRecord, "id">[K],
  ) => setForm((prev) => ({ ...prev, [field]: val }));

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => set("photo", e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.serialno.trim()) e.serialno = "Serial number is required";
    if (form.baseDailyRate <= 0)
      e.baseDailyRate = "Base daily rate must be greater than 0";
    if (form.minDailyRate <= 0)
      e.minDailyRate = "Min daily rate must be greater than 0";
    if (form.maxDailyRate <= 0)
      e.maxDailyRate = "Max daily rate must be greater than 0";
    if (
      form.minDailyRate > 0 &&
      form.maxDailyRate > 0 &&
      form.minDailyRate > form.maxDailyRate
    ) {
      e.maxDailyRate = "Max daily rate must be at least the min daily rate";
    } else if (
      form.baseDailyRate > 0 &&
      (form.baseDailyRate < form.minDailyRate ||
        form.baseDailyRate > form.maxDailyRate)
    ) {
      e.baseDailyRate = "Base daily rate must fall between min and max";
    }
    if (form.capacity <= 0) e.capacity = "Capacity must be greater than 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const conditionChanged = !asset || asset.condition !== form.condition;
    onSave({
      ...form,
      id: asset?.id ?? Date.now(),
      lastConditionUpdatedAt: conditionChanged
        ? new Date().toISOString()
        : form.lastConditionUpdatedAt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="bg-card border border-border w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto"
        style={sans}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p
              className="text-xs text-primary font-semibold tracking-widest uppercase"
              style={mono}
            >
              {isNew ? "New Asset" : "Edit Asset"}
            </p>
            <h2 className="text-2xl font-black text-foreground" style={display}>
              {isNew ? "ADD EQUIPMENT RECORD" : "EDIT EQUIPMENT RECORD"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {/* Photo Upload */}
          <div>
            <p
              className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3 pb-2 border-b border-border"
              style={mono}
            >
              Equipment Photo{" "}
              <span className="normal-case font-normal text-muted-foreground/60">
                (optional)
              </span>
            </p>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhotoFile(f);
              }}
            />
            {form.photo ? (
              <div className="relative group">
                <img
                  src={form.photo}
                  alt="Asset preview"
                  className="w-full h-48 object-cover border border-border"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => set("photo", null)}
                    className="px-4 py-2 border border-white/30 text-white text-xs font-bold tracking-wider uppercase hover:border-white/60 transition-all"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handlePhotoFile(f);
                }}
                onClick={() => photoInputRef.current?.click()}
                className={`border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center py-10 gap-3 ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/30"}`}
              >
                <div
                  className={`w-10 h-10 border flex items-center justify-center transition-colors ${dragOver ? "border-primary bg-primary/10" : "border-border bg-secondary/50"}`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={dragOver ? "text-primary" : "text-muted-foreground"}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {dragOver ? "Drop to upload" : "Upload equipment photo"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Drag & drop or click to browse · JPG, PNG, WEBP
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div>
            <p
              className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3 pb-2 border-b border-border"
              style={mono}
            >
              Basic Information
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <AssetFormField
                  label="Equipment Name"
                  placeholder="e.g. CAT 320 Hydraulic Excavator"
                  required
                  value={form.name}
                  error={errors.name}
                  onChange={(v) => set("name", String(v))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Category<span className="text-primary ml-0.5">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
                >
                  {CATEGORIES_LIST.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <AssetFormField
                label="Purchase Year"
                type="number"
                placeholder="2024"
                required
                value={form.purchaseYear}
                error={errors.purchaseYear}
                onChange={(v) => set("purchaseYear", Number(v))}
              />
              <AssetFormField
                label="Serial Number"
                placeholder="e.g. SN-EXC-2024-0412"
                required
                value={form.serialno}
                error={errors.serialno}
                onChange={(v) => set("serialno", String(v))}
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Location<span className="text-primary ml-0.5">*</span>
                </label>
                <select
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
                >
                  {LOCATIONS_LIST.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={form.desc}
                  onChange={(e) => set("desc", e.target.value)}
                  rows={2}
                  placeholder="Brief description of the equipment and best use cases…"
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          {/* Specs & Pricing */}
          <div>
            <p
              className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3 pb-2 border-b border-border"
              style={mono}
            >
              Specs & Pricing
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <AssetFormField
                label="Capacity (tons)"
                type="number"
                placeholder="20"
                required
                value={form.capacity}
                error={errors.capacity}
                onChange={(v) => set("capacity", Number(v))}
              />
              <AssetFormField
                label="Platform Height (m)"
                type="number"
                placeholder="20"
                value={form.platformHeight ?? ""}
                error={errors.platformHeight}
                onChange={(v) =>
                  set("platformHeight", v === "" ? null : Number(v))
                }
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Condition
                </label>
                <select
                  value={form.condition}
                  onChange={(e) =>
                    set("condition", e.target.value as ConditionType)
                  }
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {formatCondition(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              <AssetFormField
                label="Base Daily Rate (S$)"
                type="number"
                placeholder="890"
                required
                value={form.baseDailyRate}
                error={errors.baseDailyRate}
                onChange={(v) => set("baseDailyRate", Number(v))}
              />
              <AssetFormField
                label="Min Daily Rate (S$)"
                type="number"
                placeholder="410"
                required
                value={form.minDailyRate}
                error={errors.minDailyRate}
                onChange={(v) => set("minDailyRate", Number(v))}
              />
              <AssetFormField
                label="Max Daily Rate (S$)"
                type="number"
                placeholder="760"
                required
                value={form.maxDailyRate}
                error={errors.maxDailyRate}
                onChange={(v) => set("maxDailyRate", Number(v))}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <p
              className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3 pb-2 border-b border-border"
              style={mono}
            >
              Status
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Availability
              </label>
              <div className="flex gap-2 mt-0.5 max-w-xs">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => set("available", val)}
                    className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase border transition-all ${form.available === val ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/40"}`}
                  >
                    {val ? "Available" : "On Rent"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
            >
              {isNew ? "Add Asset" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
