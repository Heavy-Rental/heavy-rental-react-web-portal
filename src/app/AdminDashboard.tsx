import { useState, useRef } from "react";
import {
  Search, MapPin, Calendar, X, Truck, Wrench,
  CheckCircle, BarChart2, Activity, DollarSign, AlertTriangle,
  User, LogOut, TrendingUp, Lock, RefreshCw, Info,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Font style constants ──
const sans    = { fontFamily: "'DM Sans', sans-serif" };
const display = { fontFamily: "'Barlow Condensed', sans-serif" };
const mono    = { fontFamily: "'DM Mono', monospace" };

// ── Types needed by AdminDashboard ──
type Role = "customer" | "employee" | "admin";
type AdminTab = "overview" | "assets" | "fleet" | "users" | "bookings" | "pricing";
type DeploymentStatus = "Available" | "Booked" | "In-Transit" | "Maintenance";
type LifecycleStatus = "Reserved" | "Preparing" | "Dispatched" | "Active" | "Return Initiated" | "Returned" | "Inspecting" | "Cleared" | "Maintenance";

const EQUIPMENT_LIST = [
  {
    id: 1, name: "CAT 320 Hydraulic Excavator", category: "Excavator",
    daily: 890, weekly: 4200, tons: 20, year: 2022, location: "Houston, TX",
    rating: 4.9, reviews: 37, available: true,
    img: "photo-1630288214173-a119cf823388",
    tags: ["GPS Tracked", "Operator Available"],
    utilization: 82, revenue: 58400, hoursThisMonth: 187,
    desc: "Best for heavy earthmoving, trenching, demolition, and foundation work on large construction sites.",
    maxLoad: 20, idealFor: ["excavation", "demolition", "earthmoving", "foundation", "trenching"],
  },
  {
    id: 2, name: "Liebherr LTM 1100 Mobile Crane", category: "Crane",
    daily: 2400, weekly: 11000, tons: 100, year: 2021, location: "Dallas, TX",
    rating: 4.8, reviews: 19, available: true,
    img: "photo-1653315917834-04a6d84e132e",
    tags: ["Certified Operator", "OSHA Compliant"],
    utilization: 71, revenue: 134400, hoursThisMonth: 162,
    desc: "100-ton capacity mobile crane ideal for steel erection, bridge lifting, and heavy picks.",
    maxLoad: 100, idealFor: ["lifting", "crane", "steel erection", "bridge", "heavy"],
  },
  {
    id: 3, name: "Komatsu D65 Bulldozer", category: "Bulldozer",
    daily: 750, weekly: 3500, tons: 17, year: 2023, location: "Austin, TX",
    rating: 5.0, reviews: 11, available: true,
    img: "photo-1575281923032-f40d94ef6160",
    tags: ["GPS Tracked", "Fuel Included"],
    utilization: 94, revenue: 42000, hoursThisMonth: 214,
    desc: "High-efficiency bulldozer for land clearing, grading, pushing large volumes of earth and debris.",
    maxLoad: 17, idealFor: ["grading", "land clearing", "pushing", "dozing", "site prep"],
  },
  {
    id: 4, name: "Toyota 8FBE15 Electric Forklift", category: "Forklift",
    daily: 320, weekly: 1400, tons: 1.5, year: 2023, location: "San Antonio, TX",
    rating: 4.7, reviews: 44, available: false,
    img: "photo-1664312616511-81fe2e745cb3",
    tags: ["Zero Emissions", "Indoor Safe"],
    utilization: 58, revenue: 17920, hoursThisMonth: 132,
    desc: "Electric forklift for warehouse operations, indoor material handling, and pallet moving.",
    maxLoad: 1.5, idealFor: ["warehouse", "indoor", "pallet", "forklift", "material handling"],
  },
  {
    id: 5, name: "Volvo EC480E Excavator", category: "Excavator",
    daily: 1100, weekly: 5200, tons: 48, year: 2022, location: "Houston, TX",
    rating: 4.8, reviews: 22, available: true,
    img: "photo-1759950345011-ee5a96640e00",
    tags: ["GPS Tracked", "Large Capacity"],
    utilization: 76, revenue: 61600, hoursThisMonth: 174,
    desc: "Large excavator for major earthworks, quarrying, and deep excavation projects.",
    maxLoad: 48, idealFor: ["deep excavation", "quarry", "large earthworks", "mining"],
  },
  {
    id: 6, name: "JLG 1350SJP Telescopic Boom", category: "Boom Lift",
    daily: 580, weekly: 2600, tons: 0.45, year: 2023, location: "Dallas, TX",
    rating: 4.6, reviews: 31, available: true,
    img: "photo-1780054984720-20ccf265317f",
    tags: ["135ft Reach", "4WD"],
    utilization: 68, revenue: 32480, hoursThisMonth: 155,
    desc: "Telescopic boom lift for reaching elevated work areas — construction, maintenance, painting, electrical.",
    maxLoad: 0.45, idealFor: ["aerial work", "height", "painting", "electrical", "maintenance", "elevated"],
  },
];

const CATEGORIES_LIST = ["Excavator", "Crane", "Bulldozer", "Forklift", "Boom Lift"];

const MONTHLY_UTILIZATION = [
  { month: "Feb", utilization: 68, revenue: 189000 },
  { month: "Mar", utilization: 74, revenue: 214000 },
  { month: "Apr", utilization: 79, revenue: 231000 },
  { month: "May", utilization: 85, revenue: 258000 },
  { month: "Jun", utilization: 88, revenue: 271000 },
  { month: "Jul", utilization: 76, revenue: 243000 },
];

interface AssetRecord {
  id: number;
  name: string;
  category: string;
  year: number;
  location: string;
  daily: number;
  weekly: number;
  tons: number;
  available: boolean;
  utilization: number;
  hoursThisMonth: number;
  revenue: number;
  tags: string;
  desc: string;
  serialNo: string;
  lastService: string;
  nextService: string;
  condition: "Excellent" | "Good" | "Fair" | "Needs Repair";
  photo: string | null;
}

interface FleetAsset {
  id: number;
  name: string;
  category: string;
  serialNo: string;
  year: number;
  location: string;
  photo: string;
  deploymentStatus: DeploymentStatus;
  assignedBooking: string;
  assignedCustomer: string;
  currentSite: string;
  lastUpdated: string;
  updatedBy: string;
  notes: string;
  condition: AssetRecord["condition"];
}

interface LifecycleEvent {
  id: string;
  timestamp: string;
  status: LifecycleStatus;
  officer: string;
  notes: string;
  odometer?: string;
  condition?: AssetRecord["condition"] | "";
}

interface RentalLifecycle {
  bookingId: string;
  customer: string;
  equipment: string;
  serialNo: string;
  currentStatus: LifecycleStatus;
  events: LifecycleEvent[];
}

const CONDITIONS = ["Excellent", "Good", "Fair", "Needs Repair"] as const;
const LOCATIONS_LIST = ["Houston, TX", "Dallas, TX", "Austin, TX", "San Antonio, TX", "Fort Worth, TX"];

const EMPTY_ASSET: Omit<AssetRecord, "id"> = {
  name: "", category: "Excavator", year: 2024, location: "Houston, TX",
  daily: 0, weekly: 0, tons: 0, available: true, utilization: 0,
  hoursThisMonth: 0, revenue: 0, tags: "", desc: "",
  serialNo: "", lastService: "", nextService: "",
  condition: "Good", photo: null,
};

// ─── ASSET FORM MODAL ─────────────────────────────────────────────────────────


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
        <p key={String(p.name ?? i)} style={{ color: p.color ?? "#f5a623" }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}


function AssetFormField({
  label, type = "text", placeholder = "", required = false,
  value, error, onChange,
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
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={String(value)}
        onChange={e => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-secondary/50 border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors ${error ? "border-red-500/60" : "border-border"}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export function AssetFormModal({
  asset, onSave, onClose,
}: {
  asset: AssetRecord | null;
  onSave: (a: AssetRecord) => void;
  onClose: () => void;
}) {
  const isNew = !asset;
  const [form, setForm] = useState<Omit<AssetRecord, "id">>(
    asset ? { ...asset } : { ...EMPTY_ASSET }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Omit<AssetRecord, "id">>(field: K, val: Omit<AssetRecord, "id">[K]) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => set("photo", e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.serialNo.trim()) e.serialNo = "Serial number is required";
    if (form.daily <= 0) e.daily = "Daily rate must be greater than 0";
    if (form.tons <= 0) e.tons = "Capacity must be greater than 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...form, id: asset?.id ?? Date.now() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-card border border-border w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto" style={sans}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p className="text-xs text-primary font-semibold tracking-widest uppercase" style={mono}>
              {isNew ? "New Asset" : "Edit Asset"}
            </p>
            <h2 className="text-2xl font-black text-foreground" style={display}>
              {isNew ? "ADD EQUIPMENT RECORD" : "EDIT EQUIPMENT RECORD"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {/* Photo Upload */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3 pb-2 border-b border-border" style={mono}>Equipment Photo <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></p>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); }} />
            {form.photo ? (
              <div className="relative group">
                <img src={form.photo} alt="Asset preview" className="w-full h-48 object-cover border border-border" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button type="button" onClick={() => photoInputRef.current?.click()}
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all">
                    Replace
                  </button>
                  <button type="button" onClick={() => set("photo", null)}
                    className="px-4 py-2 border border-white/30 text-white text-xs font-bold tracking-wider uppercase hover:border-white/60 transition-all">
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handlePhotoFile(f); }}
                onClick={() => photoInputRef.current?.click()}
                className={`border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center py-10 gap-3 ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/30"}`}>
                <div className={`w-10 h-10 border flex items-center justify-center transition-colors ${dragOver ? "border-primary bg-primary/10" : "border-border bg-secondary/50"}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={dragOver ? "text-primary" : "text-muted-foreground"}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{dragOver ? "Drop to upload" : "Upload equipment photo"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Drag & drop or click to browse · JPG, PNG, WEBP</p>
                </div>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3 pb-2 border-b border-border" style={mono}>Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><AssetFormField label="Equipment Name" placeholder="e.g. CAT 320 Hydraulic Excavator" required value={form.name} error={errors.name} onChange={v => set("name", String(v))} /></div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Category<span className="text-primary ml-0.5">*</span></label>
                <select value={form.category} onChange={e => set("category", e.target.value)}
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors">
                  {CATEGORIES_LIST.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <AssetFormField label="Year" type="number" placeholder="2024" required value={form.year} error={errors.year} onChange={v => set("year", Number(v))} />
              <AssetFormField label="Serial Number" placeholder="e.g. CAT-320-2024-00412" required value={form.serialNo} error={errors.serialNo} onChange={v => set("serialNo", String(v))} />
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Location<span className="text-primary ml-0.5">*</span></label>
                <select value={form.location} onChange={e => set("location", e.target.value)}
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors">
                  {LOCATIONS_LIST.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1.5 block">Description</label>
                <textarea value={form.desc} onChange={e => set("desc", e.target.value)} rows={2}
                  placeholder="Brief description of the equipment and best use cases…"
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors resize-none" />
              </div>
            </div>
          </div>

          {/* Specs & Pricing */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3 pb-2 border-b border-border" style={mono}>Specs & Pricing</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <AssetFormField label="Capacity (tons)" type="number" placeholder="20" required value={form.tons} error={errors.tons} onChange={v => set("tons", Number(v))} />
              <AssetFormField label="Daily Rate ($)" type="number" placeholder="890" required value={form.daily} error={errors.daily} onChange={v => set("daily", Number(v))} />
              <AssetFormField label="Weekly Rate ($)" type="number" placeholder="4200" value={form.weekly} error={errors.weekly} onChange={v => set("weekly", Number(v))} />
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Condition</label>
                <select value={form.condition} onChange={e => set("condition", e.target.value as AssetRecord["condition"])}
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors">
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs text-muted-foreground mb-1.5 block">Tags (comma separated)</label>
              <input type="text" value={form.tags} onChange={e => set("tags", e.target.value)}
                placeholder="e.g. GPS Tracked, Operator Available, OSHA Compliant"
                className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors" />
            </div>
          </div>

          {/* Status & Maintenance */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3 pb-2 border-b border-border" style={mono}>Status & Maintenance</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AssetFormField label="Last Service Date" type="date" value={form.lastService} error={errors.lastService} onChange={v => set("lastService", String(v))} />
              <AssetFormField label="Next Service Date" type="date" value={form.nextService} error={errors.nextService} onChange={v => set("nextService", String(v))} />
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Availability</label>
                <div className="flex gap-2 mt-0.5">
                  {[true, false].map(val => (
                    <button key={String(val)} type="button" onClick={() => set("available", val)}
                      className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase border transition-all ${form.available === val ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/40"}`}>
                      {val ? "Available" : "On Rent"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Utilization %</label>
                <input type="number" min={0} max={100} value={form.utilization} onChange={e => set("utilization", Number(e.target.value))}
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors" />
              </div>
              <AssetFormField label="Hours This Month" type="number" value={form.hoursThisMonth} error={errors.hoursThisMonth} onChange={v => set("hoursThisMonth", Number(v))} />
              <AssetFormField label="Revenue This Month ($)" type="number" value={form.revenue} error={errors.revenue} onChange={v => set("revenue", Number(v))} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all">
              {isNew ? "Add Asset" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


const DEPLOYMENT_META: Record<DeploymentStatus, { color: string; bg: string; border: string; dot: string; desc: string }> = {
  "Available":   { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  dot: "bg-green-400",  desc: "Ready for rental at depot" },
  "Booked":      { color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/30",    dot: "bg-primary",    desc: "Reserved — awaiting dispatch" },
  "In-Transit":  { color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30", dot: "bg-violet-400", desc: "En route to or from customer site" },
  "Maintenance": { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    dot: "bg-red-400",    desc: "Out of service — repair or scheduled service" },
};

const buildFleetAssets = (): FleetAsset[] => EQUIPMENT_LIST.map((e, i) => {
  const statuses: DeploymentStatus[] = ["Available", "Booked", "In-Transit", "Available", "Booked", "Maintenance"];
  const bookings = ["", "RNT-4821", "RNT-3904", "", "RNT-3710", ""];
  const customers = ["", "Sarah Mitchell", "Derek Okafor", "", "Priya Nair", ""];
  const sites = ["Houston Depot", "4820 Main St, Houston", "In-transit to Dallas", "Austin Depot", "Reserved — San Antonio", "Service Center, Houston"];
  const notes = [
    "Fully serviced. Ready for next rental.",
    "Booked Jul 14–21. Delivery scheduled morning of Jul 14.",
    "En route to Derek Okafor site. ETA 10:30.",
    "Minor track wear noted. Monitoring.",
    "Deposit received. Awaiting dispatch Jul 25.",
    "Annual service due. Hydraulic seal replacement in progress.",
  ];
  return {
    id: e.id, name: e.name, category: e.category, year: e.year,
    serialNo: `SN-${e.category.slice(0,3).toUpperCase()}-${e.year}-${String(e.id).padStart(4,"0")}`,
    location: e.location,
    photo: `https://images.unsplash.com/photo-${e.img}?w=400&q=80`,
    deploymentStatus: statuses[i],
    assignedBooking: bookings[i],
    assignedCustomer: customers[i],
    currentSite: sites[i],
    lastUpdated: "2025-07-27 08:30",
    updatedBy: "Carlos Vega",
    notes: notes[i],
    condition: (["Excellent","Good","Excellent","Fair","Good","Needs Repair"][i]) as AssetRecord["condition"],
  };
});

const LIFECYCLE_META: Record<LifecycleStatus, { color: string; bg: string; border: string; desc: string }> = {
  Reserved:          { color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/30",    desc: "Deposit paid — equipment held" },
  Preparing:         { color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   desc: "Equipment being serviced & loaded" },
  Dispatched:        { color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30", desc: "In transit to customer site" },
  Active:            { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  desc: "On site — rental period active" },
  "Return Initiated":{ color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30",  desc: "Customer initiated return" },
  Returned:          { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", desc: "Equipment received back at depot" },
  Inspecting:        { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", desc: "Post-return condition inspection" },
  Cleared:           { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  desc: "Cleared — back in available pool" },
  Maintenance:       { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    desc: "Sent for repair / service" },
};

const INITIAL_LIFECYCLES: RentalLifecycle[] = [
  {
    bookingId: "RNT-4821", customer: "Sarah Mitchell",
    equipment: "CAT 320 Hydraulic Excavator", serialNo: "SN-EXC-2022-0001",
    currentStatus: "Active",
    events: [
      { id: "e1", timestamp: "2025-07-13 09:00", status: "Reserved",   officer: "System",        notes: "Deposit of $1,869 received. Booking confirmed.", condition: "" },
      { id: "e2", timestamp: "2025-07-13 14:30", status: "Preparing",  officer: "Carlos Vega",   notes: "Hydraulic fluid topped. Tracks inspected. Loaded on flatbed.", condition: "Excellent" },
      { id: "e3", timestamp: "2025-07-14 07:45", status: "Dispatched", officer: "James Tran",    notes: "Departed depot. Estimated arrival 10:30.", odometer: "12,440 km" },
      { id: "e4", timestamp: "2025-07-14 10:55", status: "Active",     officer: "James Tran",    notes: "Delivered to 4820 Main St site. Customer signed delivery receipt.", condition: "Excellent" },
    ],
  },
  {
    bookingId: "RNT-3904", customer: "Derek Okafor",
    equipment: "Liebherr LTM 1100 Mobile Crane", serialNo: "SN-CRA-2021-0002",
    currentStatus: "Dispatched",
    events: [
      { id: "e5", timestamp: "2025-07-17 10:00", status: "Reserved",   officer: "System",      notes: "Deposit of $2,160 received.", condition: "" },
      { id: "e6", timestamp: "2025-07-17 15:00", status: "Preparing",  officer: "Carlos Vega", notes: "Boom sections inspected. Outrigger pads checked. Pre-delivery checklist complete.", condition: "Good" },
      { id: "e7", timestamp: "2025-07-18 06:30", status: "Dispatched", officer: "James Tran",  notes: "Crane convoy departed. Police escort arranged.", odometer: "8,210 km" },
    ],
  },
  {
    bookingId: "RNT-3602", customer: "Sarah Mitchell",
    equipment: "Komatsu D65 Bulldozer", serialNo: "SN-BUL-2023-0003",
    currentStatus: "Cleared",
    events: [
      { id: "e8",  timestamp: "2025-06-04 09:00", status: "Reserved",           officer: "System",        notes: "Deposit of $900 received.", condition: "" },
      { id: "e9",  timestamp: "2025-06-04 13:00", status: "Preparing",          officer: "Carlos Vega",   notes: "Blade sharpened, tracks lubricated.", condition: "Good" },
      { id: "e10", timestamp: "2025-06-05 07:00", status: "Dispatched",         officer: "James Tran",    notes: "Loaded and en route.", odometer: "5,920 km" },
      { id: "e11", timestamp: "2025-06-05 09:30", status: "Active",             officer: "James Tran",    notes: "Delivered. Customer confirmed receipt.", condition: "Good" },
      { id: "e12", timestamp: "2025-06-09 16:00", status: "Return Initiated",   officer: "System",        notes: "Customer submitted return request via portal." },
      { id: "e13", timestamp: "2025-06-10 08:00", status: "Returned",           officer: "Carlos Vega",   notes: "Collected from site. Minor mud build-up noted.", odometer: "5,952 km" },
      { id: "e14", timestamp: "2025-06-10 11:30", status: "Inspecting",         officer: "Carlos Vega",   notes: "Full wash. Engine hours logged. No structural damage.", condition: "Good" },
      { id: "e15", timestamp: "2025-06-10 14:00", status: "Cleared",            officer: "James Tran",    notes: "Cleared for re-rental. Balance $2,100 collected.", condition: "Good" },
    ],
  },
  {
    bookingId: "RNT-3710", customer: "Priya Nair",
    equipment: "Toyota 8FBE15 Electric Forklift", serialNo: "SN-FOR-2023-0004",
    currentStatus: "Reserved",
    events: [
      { id: "e16", timestamp: "2025-07-20 11:00", status: "Reserved", officer: "System", notes: "Deposit of $576 received. Awaiting preparation.", condition: "" },
    ],
  },
];

const MOCK_USERS = [
  { id: 1, name: "Sarah Mitchell", email: "s.mitchell@email.com", role: "customer" as Role, joined: "Jan 12, 2024", rentals: 5, spent: 18430, status: "Active" },
  { id: 2, name: "Derek Okafor", email: "d.okafor@apexconstruct.com", role: "customer" as Role, joined: "Mar 3, 2024", rentals: 3, spent: 9200, status: "Active" },
  { id: 3, name: "James Tran", email: "j.tran@heavyrental.com", role: "employee" as Role, joined: "Sep 1, 2023", rentals: 0, spent: 0, status: "Active" },
  { id: 4, name: "Priya Nair", email: "p.nair@email.com", role: "customer" as Role, joined: "Jun 20, 2024", rentals: 1, spent: 4200, status: "Inactive" },
  { id: 5, name: "Carlos Vega", email: "c.vega@heavyrental.com", role: "employee" as Role, joined: "Nov 15, 2023", rentals: 0, spent: 0, status: "Active" },
];

const MOCK_BOOKINGS = [
  { id: "RNT-4821", customer: "Sarah Mitchell", equipment: "CAT 320 Hydraulic Excavator", dates: "Jul 14–21, 2025", days: 7, total: 6230, deposit: 1869, status: "Confirmed" },
  { id: "RNT-3904", customer: "Derek Okafor", equipment: "Liebherr LTM 1100 Mobile Crane", dates: "Jul 18–20, 2025", days: 3, total: 7200, deposit: 2160, status: "Confirmed" },
  { id: "RNT-3710", customer: "Priya Nair", equipment: "Toyota 8FBE15 Electric Forklift", dates: "Jul 25–31, 2025", days: 6, total: 1920, deposit: 576, status: "Pending" },
  { id: "RNT-3602", customer: "Sarah Mitchell", equipment: "Komatsu D65 Bulldozer", dates: "Jun 5–9, 2025", days: 4, total: 3000, deposit: 900, status: "Completed" },
  { id: "RNT-3498", customer: "Derek Okafor", equipment: "Volvo EC480E Excavator", dates: "May 28–30, 2025", days: 3, total: 3300, deposit: 990, status: "Completed" },
];

interface PricingRule {
  id: number;
  name: string;
  category: string;
  currentDaily: number;
  currentWeekly: number;
  floorDaily: number;
  ceilDaily: number;
  floorWeekly: number;
  ceilWeekly: number;
  mlRecommendedDaily: number;
  mlRecommendedWeekly: number;
  mlConfidence: number;
  demandSignal: "High" | "Medium" | "Low";
  utilization: number;
  locked: boolean;
}


function FleetUpdateModal({
  asset,
  onClose,
  onSave,
}: {
  asset: FleetAsset;
  onClose: () => void;
  onSave: (id: number, patch: Partial<FleetAsset>) => void;
}) {
  const [status, setStatus] = useState<DeploymentStatus>(asset.deploymentStatus);
  const [site, setSite] = useState(asset.currentSite);
  const [booking, setBooking] = useState(asset.assignedBooking);
  const [customer, setCustomer] = useState(asset.assignedCustomer);
  const [notes, setNotes] = useState(asset.notes);
  const [condition, setCondition] = useState<AssetRecord["condition"]>(asset.condition);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border w-full sm:max-w-lg max-h-[95vh] overflow-y-auto" style={sans}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p className="text-xs text-red-400 font-semibold tracking-widest uppercase" style={mono}>Update Asset Status</p>
            <h2 className="text-xl font-black text-foreground leading-tight" style={display}>{asset.name}</h2>
            <p className="text-xs text-muted-foreground">{asset.serialNo}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>Deployment Status</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DEPLOYMENT_META) as DeploymentStatus[]).map(s => {
                const m = DEPLOYMENT_META[s];
                return (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`flex items-start gap-3 p-3 border transition-all text-left ${status === s ? `${m.bg} ${m.border}` : "border-border bg-secondary/20 hover:border-primary/30"}`}>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${status === s ? m.dot : "bg-muted-foreground/30"}`} />
                    <div>
                      <p className={`text-sm font-bold ${status === s ? m.color : "text-foreground"}`}>{s}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Current Location / Site</label>
            <input value={site} onChange={e => setSite(e.target.value)} placeholder="e.g. Houston Depot / 4820 Main St, Houston"
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors" />
          </div>
          {status !== "Available" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Linked Booking</label>
                <input value={booking} onChange={e => setBooking(e.target.value)} placeholder="RNT-XXXX"
                  className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors" style={mono} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Customer</label>
                <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Full name"
                  className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors" />
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2" style={mono}>Equipment Condition</p>
            <div className="flex gap-2 flex-wrap">
              {(["Excellent","Good","Fair","Needs Repair"] as const).map(c => (
                <button key={c} type="button" onClick={() => setCondition(c)}
                  className={`px-3 py-1.5 text-xs font-bold border transition-all ${condition === c ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Status Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Describe current situation, any issues, or relevant context…"
              className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-red-400/60 transition-colors resize-none" />
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all">Cancel</button>
            <button onClick={() => onSave(asset.id, { deploymentStatus: status, currentSite: site, assignedBooking: booking, assignedCustomer: customer, notes, condition })}
              className="flex-1 py-2.5 bg-red-500 text-white text-xs font-black tracking-widest uppercase hover:bg-red-600 transition-all">Save Status</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ userName, onLogout, onHome }: { userName: string; onLogout: () => void; onHome: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [assets, setAssets] = useState<AssetRecord[]>(
    EQUIPMENT_LIST.map(e => ({
      ...e, tags: e.tags.join(", "),
      serialNo: `SN-${e.category.slice(0,3).toUpperCase()}-${e.year}-${String(e.id).padStart(4,"0")}`,
      lastService: "2025-05-12", nextService: "2025-08-12",
      condition: (["Excellent","Good","Good","Fair"][e.id % 4]) as AssetRecord["condition"],
      photo: `https://images.unsplash.com/photo-${e.img}?w=400&q=80`,
    }))
  );
  const [users, setUsers] = useState(MOCK_USERS);
  const [bookings, setBookings] = useState(MOCK_BOOKINGS);
  const [assetPage, setAssetPage] = useState(1);
  const [bookingPage, setBookingPage] = useState(1);
  const PAGE_SIZE = 5;

  // Asset CRUD state
  const [assetForm, setAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<number | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCatFilter, setAssetCatFilter] = useState("All");

  // User management state
  const [userSearch, setUserSearch] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<typeof MOCK_USERS[0] | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "" });

  // Booking state
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("All");

  // Fleet board state
  const [fleet, setFleet] = useState<FleetAsset[]>(buildFleetAssets);
  const [fleetSelected, setFleetSelected] = useState<FleetAsset | null>(null);
  const [fleetUpdateOpen, setFleetUpdateOpen] = useState(false);
  const [fleetSearch, setFleetSearch] = useState("");
  const [fleetView, setFleetView] = useState<"kanban" | "table">("kanban");

  const handleFleetUpdate = (id: number, patch: Partial<FleetAsset>) => {
    setFleet(prev => prev.map(a => a.id === id ? { ...a, ...patch, lastUpdated: new Date().toLocaleString("en-US", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }).replace(",",""), updatedBy: userName } : a));
    setFleetUpdateOpen(false);
    setFleetSelected(null);
    showToast("Asset status updated.");
  };

  // Lifecycle data (read-only overview feed)
  const [lifecycles] = useState<RentalLifecycle[]>(INITIAL_LIFECYCLES);

  // Pricing state (hoisted to top level — Rules of Hooks)
  const [pricingRules, setPricingRules] = useState<PricingRule[]>(
    assets.map(a => {
      const util = a.utilization;
      const demandSignal: PricingRule["demandSignal"] = util >= 80 ? "High" : util >= 55 ? "Medium" : "Low";
      const demandMultiplier = util >= 80 ? 1.18 : util >= 55 ? 1.05 : 0.92;
      const rawML = Math.round(a.daily * demandMultiplier / 5) * 5;
      const floor = Math.round(a.daily * 0.7 / 5) * 5;
      const ceil = Math.round(a.daily * 1.4 / 5) * 5;
      const mlRec = Math.min(ceil, Math.max(floor, rawML));
      return {
        id: a.id, name: a.name, category: a.category,
        currentDaily: a.daily, currentWeekly: a.weekly,
        floorDaily: floor, ceilDaily: ceil,
        floorWeekly: Math.round(a.weekly * 0.7 / 10) * 10,
        ceilWeekly: Math.round(a.weekly * 1.4 / 10) * 10,
        mlRecommendedDaily: mlRec,
        mlRecommendedWeekly: Math.round(a.weekly * demandMultiplier / 10) * 10,
        mlConfidence: Math.round(60 + util * 0.35),
        demandSignal,
        utilization: util,
        locked: false,
      };
    })
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFloor, setEditFloor] = useState({ daily: 0, weekly: 0 });
  const [editCeil, setEditCeil] = useState({ daily: 0, weekly: 0 });
  const [rerunning, setRerunning] = useState(false);
  const [appliedIds, setAppliedIds] = useState<number[]>([]);

  const [toast, setToast] = useState<{ msg: string; type?: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleAssetSave = (a: AssetRecord) => { setAssets(prev => prev.some(x => x.id === a.id) ? prev.map(x => x.id === a.id ? a : x) : [...prev, a]); setAssetForm(false); setEditingAsset(null); showToast(editingAsset ? "Asset updated." : "New asset added."); };
  const handleAssetDelete = (id: number) => { setAssets(prev => prev.filter(x => x.id !== id)); setDeleteAssetId(null); showToast("Asset deleted.", "error"); };
  const handleUserDelete = (id: number) => { setUsers(prev => prev.filter(x => x.id !== id)); setDeleteUserId(null); showToast("User removed.", "error"); };
  const handleBookingStatus = (id: string, status: string) => { setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b)); showToast(`Booking ${id} marked as ${status}.`); };

  const filteredAssets = assets.filter(a => {
    const q = assetSearch.toLowerCase();
    return (assetCatFilter === "All" || a.category === assetCatFilter) &&
      (!q || a.name.toLowerCase().includes(q) || a.serialNo.toLowerCase().includes(q));
  });

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const filteredBookings = bookings.filter(b => {
    const q = bookingSearch.toLowerCase();
    return (bookingStatusFilter === "All" || b.status === bookingStatusFilter) &&
      (!q || b.id.toLowerCase().includes(q) || b.customer.toLowerCase().includes(q) || b.equipment.toLowerCase().includes(q));
  });
  const totalAssetPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const pagedAssets = filteredAssets.slice((assetPage - 1) * PAGE_SIZE, assetPage * PAGE_SIZE);
  const totalBookingPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const pagedBookings = filteredBookings.slice((bookingPage - 1) * PAGE_SIZE, bookingPage * PAGE_SIZE);

  const conditionColor = (c: AssetRecord["condition"]) => ({ Excellent: "text-green-400 bg-green-500/10 border-green-500/30", Good: "text-blue-400 bg-blue-500/10 border-blue-500/30", Fair: "text-amber-400 bg-amber-500/10 border-amber-500/30", "Needs Repair": "text-red-400 bg-red-500/10 border-red-500/30" }[c]);
  const bookingStatusColor = (s: string) => ({ Confirmed: "text-green-400 bg-green-500/10 border-green-500/30", Pending: "text-amber-400 bg-amber-500/10 border-amber-500/30", Completed: "text-blue-400 bg-blue-500/10 border-blue-500/30", Cancelled: "text-red-400 bg-red-500/10 border-red-500/30" }[s] ?? "text-muted-foreground border-border");

  const TABS: { key: AdminTab; label: string; icon: React.ElementType }[] = [
    { key: "overview",  label: "Overview",      icon: BarChart2 },
    { key: "assets",    label: "Asset Records", icon: Wrench },
    { key: "fleet",     label: "Fleet Board",   icon: Truck },
    { key: "bookings",  label: "Bookings",      icon: Calendar },
    { key: "pricing",   label: "Pricing",       icon: TrendingUp },
    { key: "users",     label: "Users",         icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 border px-4 py-3 text-sm flex items-center gap-2 shadow-xl ${toast.type === "error" ? "bg-card border-red-500/40 text-red-400" : "bg-card border-primary/40 text-foreground"}`}>
          <CheckCircle size={15} className={toast.type === "error" ? "text-red-400" : "text-primary"} />
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {assetForm && <AssetFormModal asset={editingAsset} onSave={handleAssetSave} onClose={() => { setAssetForm(false); setEditingAsset(null); }} />}

      {deleteAssetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 max-w-sm w-full" style={sans}>
            <p className="font-black text-xl text-foreground mb-2" style={display}>DELETE ASSET?</p>
            <p className="text-sm text-muted-foreground mb-6">This permanently removes the asset record. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteAssetId(null)} className="flex-1 py-2 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all">Cancel</button>
              <button onClick={() => handleAssetDelete(deleteAssetId)} className="flex-1 py-2 bg-red-500 text-white text-xs font-bold tracking-wider uppercase hover:bg-red-600 transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 max-w-sm w-full" style={sans}>
            <p className="font-black text-xl text-foreground mb-2" style={display}>REMOVE USER?</p>
            <p className="text-sm text-muted-foreground mb-6">This will permanently delete the user account and all associated data.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUserId(null)} className="flex-1 py-2 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all">Cancel</button>
              <button onClick={() => handleUserDelete(deleteUserId)} className="flex-1 py-2 bg-red-500 text-white text-xs font-bold tracking-wider uppercase hover:bg-red-600 transition-all">Remove</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md" style={sans}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-xl font-black text-foreground" style={display}>EDIT USER</h2>
              <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {(["name","email"] as const).map(field => (
                <div key={field}>
                  <label className="text-xs text-muted-foreground mb-1.5 block capitalize">{field}</label>
                  <input value={editingUser[field]} onChange={e => setEditingUser(u => u ? { ...u, [field]: e.target.value } : u)}
                    className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/60 transition-colors" />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Role</label>
                <select value={editingUser.role} onChange={e => setEditingUser(u => u ? { ...u, role: e.target.value as Role } : u)}
                  className="w-full bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors">
                  <option value="customer">Customer</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                <div className="flex gap-2">
                  {["Active","Inactive"].map(s => (
                    <button key={s} type="button" onClick={() => setEditingUser(u => u ? { ...u, status: s } : u)}
                      className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase border transition-all ${editingUser.status === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingUser(null)} className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all">Cancel</button>
                <button onClick={() => { setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u)); setEditingUser(null); showToast("User updated."); }}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md" style={sans}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-0.5" style={mono}>User Management</p>
                <h2 className="text-xl font-black text-foreground" style={display}>ADD CUSTOMER</h2>
              </div>
              <button onClick={() => { setShowAddUser(false); setNewUser({ name: "", email: "" }); }} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {(["name", "email"] as const).map(field => (
                <div key={field}>
                  <label className="text-xs text-muted-foreground mb-1.5 block capitalize">{field}</label>
                  <input
                    value={newUser[field]}
                    onChange={e => setNewUser(u => ({ ...u, [field]: e.target.value }))}
                    placeholder={field === "name" ? "Full name" : "email@example.com"}
                    className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowAddUser(false); setNewUser({ name: "", email: "" }); }}
                  className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all">Cancel</button>
                <button
                  disabled={!newUser.name.trim() || !newUser.email.trim()}
                  onClick={() => {
                    const today = new Date();
                    const joined = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const nextId = Math.max(...users.map(u => u.id)) + 1;
                    setUsers(prev => [...prev, { id: nextId, name: newUser.name.trim(), email: newUser.email.trim(), role: "customer" as Role, joined, rentals: 0, spent: 0, status: "Active" }]);
                    setShowAddUser(false);
                    setNewUser({ name: "", email: "" });
                    showToast("Customer added.");
                  }}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  Add Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button onClick={onHome} className="text-xl font-black text-primary hover:opacity-80 transition-opacity" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></button>
            <span className="text-xs border border-red-500/30 text-red-400 px-1.5 py-0.5 bg-red-500/10 uppercase tracking-wider" style={mono}>Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full" />System Online</div>
            <span className="text-sm text-muted-foreground">{userName}</span>
            <button onClick={onLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><LogOut size={13} /> Sign out</button>
          </div>
        </div>
        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-0 border-t border-border">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all ${activeTab === key ? "border-red-400 text-red-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (() => {
          // Derived metrics from live state
          const totalAssets = fleet.length;
          const activeRentals = fleet.filter(a => a.deploymentStatus === "Booked" || a.deploymentStatus === "In-Transit").length;
          const availableCount = fleet.filter(a => a.deploymentStatus === "Available").length;
          const inTransitCount = fleet.filter(a => a.deploymentStatus === "In-Transit").length;
          const maintenanceCount = fleet.filter(a => a.deploymentStatus === "Maintenance").length;
          const utilizationRate = Math.round((activeRentals / totalAssets) * 100);
          const monthRevenue = MONTHLY_UTILIZATION[MONTHLY_UTILIZATION.length - 1].revenue;
          const prevMonthRevenue = MONTHLY_UTILIZATION[MONTHLY_UTILIZATION.length - 2].revenue;
          const revChange = Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
          const pendingBookings = bookings.filter(b => b.status === "Pending").length;
          const needsRepair = fleet.filter(a => a.condition === "Needs Repair").length;
          const pendingActions = pendingBookings + needsRepair;

          const fleetHealthData: { name: string; value: number; color: string }[] = [
            { name: "Available",   value: availableCount,   color: "#4ade80" },
            { name: "Booked",      value: fleet.filter(a=>a.deploymentStatus==="Booked").length, color: "#f5a623" },
            { name: "In-Transit",  value: inTransitCount,   color: "#a78bfa" },
            { name: "Maintenance", value: maintenanceCount,  color: "#f87171" },
          ].filter(d => d.value > 0);

          const utilizationByAsset = fleet.map(a => ({
            name: a.name.split(" ").slice(0, 2).join(" "),
            utilization: assets.find(x => x.id === a.id)?.utilization ?? 0,
            status: a.deploymentStatus,
          }));

          const bookingBreakdown = (["Confirmed","Pending","Completed","Cancelled"] as const).map(s => ({
            name: s,
            value: bookings.filter(b => b.status === s).length,
            color: { Confirmed:"#4ade80", Pending:"#f5a623", Completed:"#60a5fa", Cancelled:"#f87171" }[s],
          }));

          const totalDeposits = bookings.reduce((s, b) => s + b.deposit, 0);
          const totalBookingValue = bookings.reduce((s, b) => s + b.total, 0);

          const ALERTS: { level: "critical" | "warning" | "info"; msg: string; action: AdminTab }[] = [
            ...fleet.filter(a => a.condition === "Needs Repair").map(a => ({ level: "critical" as const, msg: `${a.name} requires immediate maintenance.`, action: "fleet" as AdminTab })),
            ...bookings.filter(b => b.status === "Pending").map(b => ({ level: "warning" as const, msg: `Booking ${b.id} (${b.customer}) awaiting approval.`, action: "bookings" as AdminTab })),
            ...fleet.filter(a => a.deploymentStatus === "In-Transit").map(a => ({ level: "info" as const, msg: `${a.name} currently in transit — track in Fleet Board.`, action: "fleet" as AdminTab })),
          ];

          const recentEvents = lifecycles.flatMap(lc =>
            lc.events.slice(-1).map(e => ({ bookingId: lc.bookingId, equipment: lc.equipment, status: e.status, timestamp: e.timestamp, officer: e.officer }))
          ).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);

          const alertColors = { critical: "border-red-500/40 bg-red-500/5", warning: "border-amber-500/40 bg-amber-500/5", info: "border-blue-500/30 bg-blue-500/5" };
          const alertDot = { critical: "bg-red-400", warning: "bg-amber-400", info: "bg-blue-400" };
          const alertText = { critical: "text-red-400", warning: "text-amber-400", info: "text-blue-400" };

          return (
            <>
              {/* Header */}
              <div className="mb-8">
                <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>Admin · Operations Dashboard</p>
                <h1 className="text-5xl font-black text-foreground leading-none" style={display}>OVERVIEW</h1>
                <p className="text-muted-foreground mt-2 text-sm">As of {new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
                {[
                  { icon: Truck,         label: "Total Assets",       value: totalAssets,                        sub: `${availableCount} available`,     accent: false },
                  { icon: Activity,      label: "Active Rentals",      value: activeRentals,                      sub: `${inTransitCount} in transit`,     accent: true },
                  { icon: BarChart2,     label: "Utilization Rate",    value: `${utilizationRate}%`,              sub: "of fleet deployed",               accent: false },
                  { icon: DollarSign,    label: "This Month Revenue",  value: `$${(monthRevenue/1000).toFixed(0)}K`, sub: `${revChange >= 0 ? "+" : ""}${revChange}% vs last month`, accent: false },
                  { icon: AlertTriangle, label: "Pending Actions",     value: pendingActions,                     sub: `${needsRepair} maintenance · ${pendingBookings} bookings`, accent: pendingActions > 0 },
                ].map(({ icon: Icon, label, value, sub, accent }) => (
                  <div key={label} className={`p-5 border flex flex-col gap-3 ${accent ? "bg-primary border-primary" : "bg-card border-border"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold tracking-wider uppercase ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`} style={mono}>{label}</span>
                      <Icon size={15} className={accent ? "text-primary-foreground/70" : "text-muted-foreground"} />
                    </div>
                    <p className={`text-4xl font-black leading-none ${accent ? "text-primary-foreground" : "text-foreground"}`} style={display}>{value}</p>
                    <p className={`text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</p>
                  </div>
                ))}
              </div>

              {/* Row 2: utilization bar + fleet health donut */}
              <div className="grid lg:grid-cols-3 gap-4 mb-4">
                <div className="lg:col-span-2 bg-card border border-border p-6">
                  <p className="text-xs text-muted-foreground mb-1" style={mono}>PER ASSET</p>
                  <h3 className="text-xl font-black text-foreground mb-5" style={display}>UTILIZATION RATE</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={utilizationByAsset} barGap={4}>
                      <XAxis key="adm-ua-xaxis" dataKey="name" tick={{ fill:"#8a8478", fontSize:10 }} axisLine={false} tickLine={false} />
                      <YAxis key="adm-ua-yaxis" domain={[0,100]} tick={{ fill:"#8a8478", fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                      <Tooltip key="adm-ua-tip" content={(p) => <ChartTip active={p.active} payload={p.payload as readonly ChartTipPayloadItem[] | undefined} label={typeof p.label === "string" || typeof p.label === "number" ? p.label : undefined} />} cursor={{ fill:"rgba(255,255,255,0.03)" }} />
                      <Bar key="adm-ua-bar" dataKey="utilization" radius={[2,2,0,0]} name="adm-util-asset">
                        {utilizationByAsset.map((entry, i) => (
                          <Cell key={`adm-ua-${i}`} fill={entry.utilization >= 80 ? "#f5a623" : entry.utilization >= 60 ? "#fbbf24" : "#f87171"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border p-6">
                  <p className="text-xs text-muted-foreground mb-1" style={mono}>LIVE COUNT</p>
                  <h3 className="text-xl font-black text-foreground mb-4" style={display}>FLEET HEALTH</h3>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie key="adm-fh-pie" data={fleetHealthData} cx="50%" cy="50%" innerRadius={42} outerRadius={60} dataKey="value" paddingAngle={2} name="adm-fleet-health">
                        {fleetHealthData.map((d, i) => <Cell key={`adm-fh-${i}`} fill={d.color} />)}
                      </Pie>
                      <Tooltip key="adm-fh-tip" content={(p) => <ChartTip active={p.active} payload={p.payload as readonly ChartTipPayloadItem[] | undefined} label={typeof p.label === "string" || typeof p.label === "number" ? p.label : undefined} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 mt-2">
                    {fleetHealthData.map(({ name, value, color }) => (
                      <div key={name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /><span className="text-xs text-muted-foreground">{name}</span></div>
                        <span className="text-xs font-semibold text-foreground" style={mono}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: revenue trend + booking breakdown */}
              <div className="grid lg:grid-cols-2 gap-4 mb-4">
                <div className="bg-card border border-border p-6">
                  <p className="text-xs text-muted-foreground mb-1" style={mono}>6-MONTH TREND</p>
                  <h3 className="text-xl font-black text-foreground mb-1" style={display}>REVENUE</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-xs font-semibold ${revChange >= 0 ? "text-green-400" : "text-red-400"}`}>{revChange >= 0 ? "▲" : "▼"} {Math.abs(revChange)}%</span>
                    <span className="text-xs text-muted-foreground">vs previous month</span>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={MONTHLY_UTILIZATION}>
                      <XAxis key="adm-rev-xaxis" dataKey="month" tick={{ fill:"#8a8478", fontSize:10 }} axisLine={false} tickLine={false} />
                      <YAxis key="adm-rev-yaxis" tick={{ fill:"#8a8478", fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} />
                      <Tooltip key="adm-rev-tip" content={(p) => <ChartTip active={p.active} payload={p.payload as readonly ChartTipPayloadItem[] | undefined} label={typeof p.label === "string" || typeof p.label === "number" ? p.label : undefined} />} />
                      <Bar key="adm-rev-bar" dataKey="revenue" fill="#f5a623" radius={[2,2,0,0]} name="adm-revenue-trend" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border p-6">
                  <p className="text-xs text-muted-foreground mb-1" style={mono}>ALL BOOKINGS</p>
                  <h3 className="text-xl font-black text-foreground mb-4" style={display}>BOOKING STATUS</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {bookingBreakdown.map(({ name, value, color }) => (
                      <div key={name} className="border border-border bg-secondary/20 px-3 py-3">
                        <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full" style={{ background: color }} /><span className="text-xs text-muted-foreground">{name}</span></div>
                        <p className="text-3xl font-black text-foreground" style={display}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <div><p className="text-xs text-muted-foreground">Total Deposits Collected</p><p className="text-xl font-black text-green-400" style={display}>${totalDeposits.toLocaleString()}</p></div>
                    <div className="text-right"><p className="text-xs text-muted-foreground">Total Booking Value</p><p className="text-xl font-black text-foreground" style={display}>${totalBookingValue.toLocaleString()}</p></div>
                  </div>
                </div>
              </div>

              {/* Row 4: alerts + recent activity */}
              <div className="grid lg:grid-cols-2 gap-4 mb-4">
                {/* Alerts */}
                <div className="bg-card border border-border">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5" style={mono}>REQUIRES ATTENTION</p>
                      <h3 className="text-xl font-black text-foreground" style={display}>ALERTS</h3>
                    </div>
                    {pendingActions > 0 && <span className="w-6 h-6 bg-red-500 text-white text-xs font-black flex items-center justify-center">{pendingActions}</span>}
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
                        <div key={i} className={`px-5 py-3 flex items-start gap-3 border-l-2 ${alertColors[alert.level]} ${alert.level === "critical" ? "border-l-red-500" : alert.level === "warning" ? "border-l-amber-400" : "border-l-blue-400"}`}>
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${alertDot[alert.level]}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{alert.msg}</p>
                            <button onClick={() => setActiveTab(alert.action)} className={`text-xs font-semibold mt-0.5 hover:underline ${alertText[alert.level]}`}>
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
                      <p className="text-xs text-muted-foreground mb-0.5" style={mono}>LATEST TRANSITIONS</p>
                      <h3 className="text-xl font-black text-foreground" style={display}>RECENT ACTIVITY</h3>
                    </div>
                    <button onClick={() => setActiveTab("bookings")} className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold">View all →</button>
                  </div>
                  <div className="divide-y divide-border">
                    {recentEvents.map((ev, i) => {
                      const m = LIFECYCLE_META[ev.status];
                      return (
                        <div key={i} className="px-5 py-3 flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-xs font-bold border shrink-0 ${m.color} ${m.bg} ${m.border}`}>{ev.status}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{ev.equipment.split(" ").slice(0,3).join(" ")}</p>
                            <p className="text-xs text-muted-foreground">{ev.bookingId} · {ev.officer}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0" style={mono}>{ev.timestamp.split(" ")[0]}</span>
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
                    <p className="text-xs text-muted-foreground mb-0.5" style={mono}>FULL FLEET</p>
                    <h3 className="text-xl font-black text-foreground" style={display}>ASSET HEALTH SNAPSHOT</h3>
                  </div>
                  <button onClick={() => setActiveTab("assets")} className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold">Manage assets →</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Asset","Deployment","Utilization","Condition","Location","Last Updated"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap" style={mono}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fleet.map((a, i) => {
                        const util = assets.find(x => x.id === a.id)?.utilization ?? 0;
                        const dm = DEPLOYMENT_META[a.deploymentStatus];
                        return (
                          <tr key={a.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i%2===0?"":"bg-secondary/10"}`}>
                            <td className="px-5 py-3">
                              <p className="font-semibold text-foreground">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{a.year} · {a.serialNo}</p>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold border w-fit ${dm.color} ${dm.bg} ${dm.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dm.dot}`} />{a.deploymentStatus}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width:`${util}%`, background: util>=80?"#f5a623":util>=60?"#fbbf24":"#f87171" }} />
                                </div>
                                <span className="text-xs font-semibold text-foreground" style={mono}>{util}%</span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold ${{ Excellent:"text-green-400", Good:"text-blue-400", Fair:"text-amber-400", "Needs Repair":"text-red-400" }[a.condition]}`}>{a.condition}</span>
                            </td>
                            <td className="px-5 py-3 text-sm text-muted-foreground">{a.currentSite}</td>
                            <td className="px-5 py-3 text-xs text-muted-foreground" style={mono}>{a.lastUpdated}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}

        {/* ── ASSET RECORDS TAB ── */}
        {activeTab === "assets" && (
          <>
            <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
              <div>
                <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>Admin · Asset Management</p>
                <h1 className="text-5xl font-black text-foreground leading-none" style={display}>ASSET RECORDS</h1>
                <p className="text-muted-foreground mt-2 text-sm">{assets.length} assets · {assets.filter(a=>a.available).length} available · {assets.filter(a=>a.condition==="Needs Repair").length} need service</p>
              </div>
              <button onClick={() => { setEditingAsset(null); setAssetForm(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-xs font-bold tracking-widest uppercase hover:bg-red-600 transition-all shrink-0">
                + Add New Asset
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 flex-1 min-w-48">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input type="text" value={assetSearch} onChange={e => { setAssetSearch(e.target.value); setAssetPage(1); }} placeholder="Search by name or serial…"
                  className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full" />
                {assetSearch && <button onClick={() => { setAssetSearch(""); setAssetPage(1); }}><X size={13} className="text-muted-foreground hover:text-foreground" /></button>}
              </div>
              <select value={assetCatFilter} onChange={e => setAssetCatFilter(e.target.value)}
                className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors">
                <option value="All">All Categories</option>
                {CATEGORIES_LIST.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Assets", value: assets.length, color: "text-foreground" },
                { label: "Available", value: assets.filter(a=>a.available).length, color: "text-green-400" },
                { label: "On Rent", value: assets.filter(a=>!a.available).length, color: "text-amber-400" },
                { label: "Need Service", value: assets.filter(a=>a.condition==="Needs Repair").length, color: "text-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-card border border-border px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground" style={mono}>{label}</span>
                  <span className={`text-2xl font-black ${color}`} style={display}>{value}</span>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="bg-card border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["", "Asset", "Serial No.", "Category", "Daily Rate", "Condition", "Status", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap" style={mono}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAssets.map((a, i) => (
                      <tr key={a.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i%2===0?"":"bg-secondary/10"}`}>
                        <td className="pl-4 pr-2 py-3 w-14">
                          {a.photo
                            ? <img src={a.photo} alt={a.name} className="w-12 h-10 object-cover border border-border" />
                            : <div className="w-12 h-10 bg-secondary border border-border flex items-center justify-center"><Truck size={14} className="text-muted-foreground opacity-40" /></div>}
                        </td>
                        <td className="px-4 py-3"><p className="font-semibold text-foreground">{a.name}</p><p className="text-xs text-muted-foreground">{a.year} · {a.tons}t</p></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground" style={mono}>{a.serialNo}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{a.category}</td>
                        <td className="px-4 py-3 font-semibold text-foreground" style={mono}>${a.daily.toLocaleString()}/day</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold border ${conditionColor(a.condition)}`}>{a.condition}</span></td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold border ${a.available?"bg-green-500/10 text-green-400 border-green-500/30":"bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>{a.available?"Available":"On Rent"}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditingAsset(a); setAssetForm(true); }}
                              className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold">Edit</button>
                            <button onClick={() => setDeleteAssetId(a.id)}
                              className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all font-semibold">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground" style={mono}>
                  Showing {pagedAssets.length} of {filteredAssets.length} assets · Page {assetPage} of {totalAssetPages}
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={assetPage === 1} onClick={() => setAssetPage(p => p - 1)}
                    className="px-2.5 py-1 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed">‹ Prev</button>
                  {Array.from({ length: totalAssetPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setAssetPage(p)}
                      className={`w-7 h-7 text-xs font-bold border transition-all ${assetPage === p ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                      {p}
                    </button>
                  ))}
                  <button disabled={assetPage === totalAssetPages} onClick={() => setAssetPage(p => p + 1)}
                    className="px-2.5 py-1 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Next ›</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── FLEET BOARD TAB ── */}
        {activeTab === "fleet" && (() => {
          const filteredFleet = fleet.filter(a => {
            const q = fleetSearch.toLowerCase();
            return !q || a.name.toLowerCase().includes(q) || a.serialNo.toLowerCase().includes(q) || a.currentSite.toLowerCase().includes(q) || a.assignedCustomer.toLowerCase().includes(q);
          });

          const conditionColor = (c: AssetRecord["condition"]) => ({ Excellent: "text-green-400", Good: "text-blue-400", Fair: "text-amber-400", "Needs Repair": "text-red-400" }[c]);

          return (
            <>
              {fleetUpdateOpen && fleetSelected && (
                <FleetUpdateModal
                  asset={fleetSelected}
                  onClose={() => { setFleetUpdateOpen(false); setFleetSelected(null); }}
                  onSave={handleFleetUpdate}
                />
              )}

              {/* Header */}
              <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>Admin · Fleet Deployment Board</p>
                  <h1 className="text-5xl font-black text-foreground leading-none" style={display}>FLEET BOARD</h1>
                  <p className="text-muted-foreground mt-2 text-sm">{fleet.length} assets tracked · last sync {fleet[0]?.lastUpdated}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(["kanban","table"] as const).map(v => (
                    <button key={v} onClick={() => setFleetView(v)}
                      className={`px-4 py-2 text-xs font-bold tracking-widest uppercase border transition-all ${fleetView === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                      {v === "kanban" ? "Board" : "Table"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {(Object.keys(DEPLOYMENT_META) as DeploymentStatus[]).map(s => {
                  const count = fleet.filter(a => a.deploymentStatus === s).length;
                  const m = DEPLOYMENT_META[s];
                  return (
                    <div key={s} className={`border px-4 py-4 ${m.bg} ${m.border}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                        <span className="text-xs text-muted-foreground" style={mono}>{s}</span>
                      </div>
                      <p className={`text-4xl font-black leading-none ${m.color}`} style={display}>{count}</p>
                      <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 bg-card border border-border px-3 py-2.5 mb-6">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input value={fleetSearch} onChange={e => setFleetSearch(e.target.value)} placeholder="Search by asset name, serial, location, or customer…"
                  className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full" />
                {fleetSearch && <button onClick={() => setFleetSearch("")}><X size={13} className="text-muted-foreground hover:text-foreground" /></button>}
              </div>

              {/* ── KANBAN VIEW ── */}
              {fleetView === "kanban" && (
                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {(Object.keys(DEPLOYMENT_META) as DeploymentStatus[]).map(col => {
                    const colAssets = filteredFleet.filter(a => a.deploymentStatus === col);
                    const m = DEPLOYMENT_META[col];
                    return (
                      <div key={col} className="flex flex-col gap-3">
                        {/* Column header */}
                        <div className={`flex items-center justify-between px-3 py-2.5 border ${m.bg} ${m.border}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                            <span className={`text-xs font-black tracking-widest uppercase ${m.color}`} style={mono}>{col}</span>
                          </div>
                          <span className={`text-lg font-black ${m.color}`} style={display}>{colAssets.length}</span>
                        </div>
                        {/* Asset cards */}
                        {colAssets.length === 0 && (
                          <div className="border border-dashed border-border py-10 flex flex-col items-center justify-center text-center">
                            <p className="text-xs text-muted-foreground">No assets</p>
                          </div>
                        )}
                        {colAssets.map(a => (
                          <div key={a.id} className="bg-card border border-border flex flex-col hover:border-primary/30 transition-all">
                            {a.photo && (
                              <div className="h-28 bg-muted overflow-hidden">
                                <img src={a.photo} alt={a.name} className="w-full h-full object-cover opacity-70" />
                              </div>
                            )}
                            <div className="p-3 flex flex-col gap-2">
                              <div>
                                <p className="text-xs text-muted-foreground" style={mono}>{a.serialNo}</p>
                                <p className="font-black text-foreground leading-tight text-sm" style={display}>{a.name}</p>
                                <p className="text-xs text-muted-foreground">{a.year} · {a.category}</p>
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
                                  <p className="text-xs"><span className="text-primary font-semibold" style={mono}>{a.assignedBooking}</span><span className="text-muted-foreground"> · {a.assignedCustomer}</span></p>
                                </div>
                              )}
                              {/* Condition */}
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-semibold ${conditionColor(a.condition)}`}>{a.condition}</span>
                                <span className="text-xs text-muted-foreground">{a.lastUpdated.split(" ")[0]}</span>
                              </div>
                              {a.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2 leading-relaxed line-clamp-2">{a.notes}</p>}
                              <button onClick={() => { setFleetSelected(a); setFleetUpdateOpen(true); }}
                                className="w-full py-2 border border-border text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary/40 transition-all mt-1">
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
                          {["", "Asset", "Serial No.", "Status", "Current Location", "Booking", "Condition", "Last Updated", "Actions"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap" style={mono}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFleet.map((a, i) => {
                          const m = DEPLOYMENT_META[a.deploymentStatus];
                          return (
                            <tr key={a.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i%2===0?"":"bg-secondary/10"}`}>
                              <td className="pl-4 pr-2 py-3 w-14">
                                {a.photo
                                  ? <img src={a.photo} alt={a.name} className="w-12 h-10 object-cover border border-border" />
                                  : <div className="w-12 h-10 bg-secondary border border-border flex items-center justify-center"><Truck size={14} className="text-muted-foreground opacity-40" /></div>}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-foreground">{a.name}</p>
                                <p className="text-xs text-muted-foreground">{a.year} · {a.category}</p>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground" style={mono}>{a.serialNo}</td>
                              <td className="px-4 py-3">
                                <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border w-fit ${m.color} ${m.bg} ${m.border}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{a.deploymentStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm text-foreground">{a.currentSite}</p>
                              </td>
                              <td className="px-4 py-3">
                                {a.assignedBooking
                                  ? <div><p className="text-xs font-semibold text-primary" style={mono}>{a.assignedBooking}</p><p className="text-xs text-muted-foreground">{a.assignedCustomer}</p></div>
                                  : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold ${conditionColor(a.condition)}`}>{a.condition}</span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs text-muted-foreground whitespace-nowrap" style={mono}>{a.lastUpdated}</p>
                                <p className="text-xs text-muted-foreground">{a.updatedBy}</p>
                              </td>
                              <td className="px-4 py-3">
                                <button onClick={() => { setFleetSelected(a); setFleetUpdateOpen(true); }}
                                  className="px-3 py-1.5 border border-border text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
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
                    <p className="text-xs text-muted-foreground" style={mono}>Showing {filteredFleet.length} of {fleet.length} assets</p>
                    <p className="text-xs text-muted-foreground">Updated by: {userName}</p>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* ── BOOKINGS TAB ── */}
        {activeTab === "bookings" && (
          <>
            <div className="mb-8">
              <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>Admin · Booking Management</p>
              <h1 className="text-5xl font-black text-foreground leading-none" style={display}>BOOKINGS</h1>
              <p className="text-muted-foreground mt-2 text-sm">{bookings.length} total bookings · ${bookings.reduce((s,b)=>s+b.deposit,0).toLocaleString()} deposits collected</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {(["Confirmed","Pending","Completed","Cancelled"] as const).map(status => {
                const count = bookings.filter(b=>b.status===status).length;
                const colors = { Confirmed:"text-green-400", Pending:"text-amber-400", Completed:"text-blue-400", Cancelled:"text-red-400" };
                return (
                  <div key={status} className="bg-card border border-border px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground" style={mono}>{status}</span>
                    <span className={`text-2xl font-black ${colors[status]}`} style={display}>{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 flex-1 min-w-48">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input type="text" value={bookingSearch} onChange={e => { setBookingSearch(e.target.value); setBookingPage(1); }} placeholder="Search by ID, customer, or equipment…"
                  className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full" />
                {bookingSearch && <button onClick={() => { setBookingSearch(""); setBookingPage(1); }}><X size={13} className="text-muted-foreground hover:text-foreground" /></button>}
              </div>
              <select value={bookingStatusFilter} onChange={e => { setBookingStatusFilter(e.target.value); setBookingPage(1); }}
                className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-red-400/60 transition-colors">
                <option value="All">All Statuses</option>
                {["Confirmed","Pending","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="bg-card border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Booking ID","Customer","Equipment","Dates","Deposit","Total","Status","Actions"].map(h=>(
                        <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap" style={mono}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBookings.map((b,i)=>(
                      <tr key={b.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i%2===0?"":"bg-secondary/10"}`}>
                        <td className="px-4 py-3 font-semibold text-primary text-xs" style={mono}>{b.id}</td>
                        <td className="px-4 py-3 text-foreground font-medium">{b.customer}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-48 truncate">{b.equipment}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{b.dates}</td>
                        <td className="px-4 py-3 font-semibold text-green-400" style={mono}>${b.deposit.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-foreground" style={mono}>${b.total.toLocaleString()}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold border ${bookingStatusColor(b.status)}`}>{b.status}</span></td>
                        <td className="px-4 py-3">
                          <select value={b.status} onChange={e=>handleBookingStatus(b.id,e.target.value)}
                            className="bg-secondary/50 border border-border px-2 py-1 text-xs text-foreground outline-none focus:border-red-400/60 transition-colors">
                            {["Confirmed","Pending","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground" style={mono}>
                  Showing {pagedBookings.length} of {filteredBookings.length} bookings · Page {bookingPage} of {totalBookingPages}
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={bookingPage === 1} onClick={() => setBookingPage(p => p - 1)}
                    className="px-2.5 py-1 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed">‹ Prev</button>
                  {Array.from({ length: totalBookingPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setBookingPage(p)}
                      className={`w-7 h-7 text-xs font-bold border transition-all ${bookingPage === p ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                      {p}
                    </button>
                  ))}
                  <button disabled={bookingPage === totalBookingPages} onClick={() => setBookingPage(p => p + 1)}
                    className="px-2.5 py-1 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Next ›</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── USERS TAB ── */}
        {activeTab === "users" && (
          <>
            <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
              <div>
                <p className="text-xs text-red-400 font-semibold tracking-widest uppercase mb-2" style={mono}>Admin · User Management</p>
                <h1 className="text-5xl font-black text-foreground leading-none" style={display}>USERS</h1>
                <p className="text-muted-foreground mt-2 text-sm">{users.length} registered users · {users.filter(u=>u.status==="Active").length} active</p>
              </div>
              <button onClick={() => setShowAddUser(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-xs font-bold tracking-widest uppercase hover:bg-red-600 transition-all shrink-0">
                + Add Customer
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Users", value: users.length, color: "text-foreground" },
                { label: "Customers", value: users.filter(u=>u.role==="customer").length, color: "text-primary" },
                { label: "Employees", value: users.filter(u=>u.role==="employee").length, color: "text-blue-400" },
                { label: "Active", value: users.filter(u=>u.status==="Active").length, color: "text-green-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-card border border-border px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground" style={mono}>{label}</span>
                  <span className={`text-2xl font-black ${color}`} style={display}>{value}</span>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 mb-6">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input type="text" value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="Search by name or email…"
                className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full" />
              {userSearch && <button onClick={()=>setUserSearch("")}><X size={13} className="text-muted-foreground hover:text-foreground" /></button>}
            </div>

            <div className="bg-card border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["User","Email","Role","Joined","Rentals","Total Spent","Status","Actions"].map(h=>(
                        <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap" style={mono}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u,i)=>(
                      <tr key={u.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i%2===0?"":"bg-secondary/10"}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-black text-primary shrink-0">{u.name[0]}</div>
                            <p className="font-semibold text-foreground">{u.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground" style={mono}>{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold border ${u.role==="customer"?"bg-primary/10 text-primary border-primary/30":u.role==="employee"?"bg-blue-500/10 text-blue-400 border-blue-500/30":"bg-red-500/10 text-red-400 border-red-500/30"}`}>{u.role}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{u.joined}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground text-center" style={mono}>{u.rentals}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground" style={mono}>{u.spent>0?`$${u.spent.toLocaleString()}`:"—"}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold border ${u.status==="Active"?"bg-green-500/10 text-green-400 border-green-500/30":"bg-secondary text-muted-foreground border-border"}`}>{u.status}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={()=>setEditingUser(u)} className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold">Edit</button>
                            <button onClick={()=>setDeleteUserId(u.id)} className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all font-semibold">Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground" style={mono}>Showing {filteredUsers.length} of {users.length} users</p>
              </div>
            </div>
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "pricing" && (() => {
          const openEdit = (r: PricingRule) => {
            setEditingId(r.id);
            setEditFloor({ daily: r.floorDaily, weekly: r.floorWeekly });
            setEditCeil({ daily: r.ceilDaily, weekly: r.ceilWeekly });
          };

          const saveEdit = (id: number) => {
            setPricingRules(rs => rs.map(r => {
              if (r.id !== id) return r;
              const clampedML = Math.min(editCeil.daily, Math.max(editFloor.daily, r.mlRecommendedDaily));
              return { ...r, floorDaily: editFloor.daily, ceilDaily: editCeil.daily, floorWeekly: editFloor.weekly, ceilWeekly: editCeil.weekly, mlRecommendedDaily: clampedML };
            }));
            setEditingId(null);
          };

          const applyRecommendation = (id: number) => {
            setPricingRules(rs => rs.map(r => r.id !== id ? r : { ...r, currentDaily: r.mlRecommendedDaily, currentWeekly: r.mlRecommendedWeekly }));
            setAppliedIds(ids => [...ids, id]);
            setAssets(prev => prev.map(a => {
              const rule = pricingRules.find(r => r.id === id);
              if (!rule || a.id !== id) return a;
              return { ...a, daily: rule.mlRecommendedDaily, weekly: rule.mlRecommendedWeekly };
            }));
          };

          const applyAll = () => {
            const unlocked = pricingRules.filter(r => !r.locked);
            setPricingRules(rs => rs.map(r => r.locked ? r : { ...r, currentDaily: r.mlRecommendedDaily, currentWeekly: r.mlRecommendedWeekly }));
            setAppliedIds(ids => [...ids, ...unlocked.map(r => r.id)]);
            setAssets(prev => prev.map(a => {
              const rule = pricingRules.find(r => r.id === a.id && !r.locked);
              if (!rule) return a;
              return { ...a, daily: rule.mlRecommendedDaily, weekly: rule.mlRecommendedWeekly };
            }));
          };

          const rerunML = () => {
            setRerunning(true);
            setTimeout(() => {
              setPricingRules(rs => rs.map(r => {
                if (r.locked) return r;
                const jitter = (Math.random() - 0.5) * 0.06;
                const demandMultiplier = (r.utilization >= 80 ? 1.18 : r.utilization >= 55 ? 1.05 : 0.92) + jitter;
                const rawML = Math.round(r.currentDaily * demandMultiplier / 5) * 5;
                const mlRec = Math.min(r.ceilDaily, Math.max(r.floorDaily, rawML));
                const conf = Math.min(99, Math.round(r.mlConfidence + (Math.random() - 0.5) * 6));
                return { ...r, mlRecommendedDaily: mlRec, mlRecommendedWeekly: Math.round(r.currentWeekly * demandMultiplier / 10) * 10, mlConfidence: conf };
              }));
              setAppliedIds([]);
              setRerunning(false);
            }, 1800);
          };

          const demandColor: Record<PricingRule["demandSignal"], string> = {
            High: "text-green-400 bg-green-500/10 border-green-500/30",
            Medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
            Low: "text-red-400 bg-red-500/10 border-red-500/30",
          };

          const overallSavings = pricingRules.reduce((s, r) => s + (r.mlRecommendedDaily - r.currentDaily), 0);
          const pendingCount = pricingRules.filter(r => !r.locked && r.mlRecommendedDaily !== r.currentDaily && !appliedIds.includes(r.id)).length;

          return (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
                <div>
                  <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>Dynamic Pricing · ML-Assisted</p>
                  <h1 className="text-5xl font-black text-foreground leading-none" style={display}>PRICING CONTROLS</h1>
                  <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                    Set floor and ceiling price bounds per asset. The ML model recommends the optimal rate within your boundaries based on utilisation, demand signals, and market conditions.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <button onClick={rerunML} disabled={rerunning}
                    className="flex items-center gap-2 px-4 py-2.5 border border-border text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50">
                    <RefreshCw size={13} className={rerunning ? "animate-spin" : ""} />
                    {rerunning ? "Rerunning Model…" : "Re-run ML Model"}
                  </button>
                  {pendingCount > 0 && (
                    <button onClick={applyAll}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all">
                      Apply All ({pendingCount}) →
                    </button>
                  )}
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Assets Under ML", value: pricingRules.filter(r => !r.locked).length, sub: `${pricingRules.filter(r => r.locked).length} locked by admin`, accent: false },
                  { label: "Pending Updates", value: pendingCount, sub: "ML recommendations not yet applied", accent: pendingCount > 0 },
                  { label: "Avg Confidence", value: `${Math.round(pricingRules.reduce((s,r) => s + r.mlConfidence, 0) / pricingRules.length)}%`, sub: "ML model certainty score", accent: false },
                  { label: "Revenue Impact", value: `${overallSavings >= 0 ? "+" : ""}$${overallSavings.toLocaleString()}`, sub: "vs current pricing /day", accent: overallSavings > 0 },
                ].map(({ label, value, sub, accent }) => (
                  <div key={label} className={`p-5 border flex flex-col gap-2 ${accent ? "bg-primary/10 border-primary/40" : "bg-card border-border"}`}>
                    <p className="text-xs text-muted-foreground tracking-wider uppercase" style={mono}>{label}</p>
                    <p className="text-3xl font-black leading-none" style={display}>{value}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div className="bg-card border border-primary/20 px-5 py-4 mb-6 flex items-start gap-3">
                <Info size={15} className="text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-semibold">How it works: </span>
                  The ML model analyses utilisation rate, booking frequency, seasonal demand, and competitive signals to suggest an optimal daily rate.
                  It will <span className="text-primary font-semibold">never exceed your ceiling</span> and <span className="text-primary font-semibold">never fall below your floor</span>.
                  Lock an asset to freeze its price and exclude it from ML updates.
                </div>
              </div>

              {/* Asset pricing table */}
              <div className="bg-card border border-border">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5" style={mono}>PER-ASSET PRICING RULES</p>
                    <p className="text-sm font-semibold text-foreground">{pricingRules.length} assets · edit bounds, then apply ML recommendation</p>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {pricingRules.map(r => {
                    const isEditing = editingId === r.id;
                    const isApplied = appliedIds.includes(r.id);
                    const mlAboveCurrent = r.mlRecommendedDaily > r.currentDaily;
                    const mlBelowCurrent = r.mlRecommendedDaily < r.currentDaily;
                    const mlPct = Math.round(((r.mlRecommendedDaily - r.currentDaily) / r.currentDaily) * 100);
                    const rangeWidth = r.ceilDaily - r.floorDaily;
                    const currentPos = rangeWidth > 0 ? Math.round(((r.currentDaily - r.floorDaily) / rangeWidth) * 100) : 50;
                    const mlPos = rangeWidth > 0 ? Math.round(((r.mlRecommendedDaily - r.floorDaily) / rangeWidth) * 100) : 50;

                    return (
                      <div key={r.id} className={`px-5 py-5 transition-colors ${r.locked ? "opacity-60 bg-secondary/10" : ""}`}>
                        {/* Row header */}
                        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                          <div className="flex items-center gap-3">
                            {r.locked
                              ? <Lock size={14} className="text-amber-400 shrink-0" />
                              : <TrendingUp size={14} className="text-primary shrink-0" />}
                            <div>
                              <p className="font-black text-foreground" style={display}>{r.name}</p>
                              <p className="text-xs text-muted-foreground">{r.category} · {r.utilization}% utilisation</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs font-bold border ${demandColor[r.demandSignal]}`}>{r.demandSignal} Demand</span>
                            <span className="text-xs text-muted-foreground border border-border px-2 py-0.5" style={mono}>
                              {r.mlConfidence}% confidence
                            </span>
                            <button onClick={() => setPricingRules(rs => rs.map(x => x.id === r.id ? { ...x, locked: !x.locked } : x))}
                              className={`px-3 py-1 text-xs font-bold border transition-all ${r.locked ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"}`}>
                              {r.locked ? "Unlock" : "Lock Price"}
                            </button>
                          </div>
                        </div>

                        {/* Price range visualiser */}
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                            <span style={mono}>Floor ${r.floorDaily}</span>
                            <span style={mono}>Ceiling ${r.ceilDaily}</span>
                          </div>
                          <div className="relative h-5 bg-secondary/40 border border-border rounded-sm overflow-hidden">
                            {/* Allowed range fill */}
                            <div className="absolute inset-0 bg-primary/10" />
                            {/* Current price marker */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground" style={{ left: `${Math.min(98, Math.max(2, currentPos))}%` }} />
                            {/* ML recommendation marker */}
                            {!r.locked && (
                              <div className="absolute top-0 bottom-0 w-1 bg-primary" style={{ left: `${Math.min(97, Math.max(1, mlPos))}%` }} />
                            )}
                          </div>
                          <div className="flex gap-4 mt-1.5 text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="inline-block w-0.5 h-3 bg-muted-foreground" />Current ${r.currentDaily}/day</span>
                            {!r.locked && <span className="flex items-center gap-1.5 text-primary"><span className="inline-block w-1 h-3 bg-primary" />ML ${r.mlRecommendedDaily}/day
                              <span className={`font-semibold ${mlAboveCurrent ? "text-green-400" : mlBelowCurrent ? "text-red-400" : "text-muted-foreground"}`}>
                                {mlPct > 0 ? `+${mlPct}` : mlPct}%
                              </span>
                            </span>}
                          </div>
                        </div>

                        {/* Edit bounds or summary */}
                        {isEditing ? (
                          <div className="bg-secondary/30 border border-border p-4 flex flex-col gap-4">
                            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase" style={mono}>Edit Price Boundaries</p>
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-3">
                                <p className="text-xs text-muted-foreground font-semibold">Daily Rate Bounds</p>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <label className="text-xs text-muted-foreground block mb-1">Floor (min) $/day</label>
                                    <input type="number" value={editFloor.daily} onChange={e => setEditFloor(f => ({ ...f, daily: Number(e.target.value) }))}
                                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs text-muted-foreground block mb-1">Ceiling (max) $/day</label>
                                    <input type="number" value={editCeil.daily} onChange={e => setEditCeil(c => ({ ...c, daily: Number(e.target.value) }))}
                                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" />
                                  </div>
                                </div>
                                {editFloor.daily >= editCeil.daily && (
                                  <p className="text-xs text-red-400">Floor must be less than ceiling.</p>
                                )}
                              </div>
                              <div className="flex flex-col gap-3">
                                <p className="text-xs text-muted-foreground font-semibold">Weekly Rate Bounds</p>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <label className="text-xs text-muted-foreground block mb-1">Floor $/week</label>
                                    <input type="number" value={editFloor.weekly} onChange={e => setEditFloor(f => ({ ...f, weekly: Number(e.target.value) }))}
                                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs text-muted-foreground block mb-1">Ceiling $/week</label>
                                    <input type="number" value={editCeil.weekly} onChange={e => setEditCeil(c => ({ ...c, weekly: Number(e.target.value) }))}
                                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(r.id)} disabled={editFloor.daily >= editCeil.daily}
                                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40">
                                Save Bounds
                              </button>
                              <button onClick={() => setEditingId(null)}
                                className="px-4 py-2 border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex gap-6 text-xs">
                              <div><p className="text-muted-foreground mb-0.5">Daily bounds</p><p className="font-semibold text-foreground" style={mono}>${r.floorDaily} – ${r.ceilDaily}</p></div>
                              <div><p className="text-muted-foreground mb-0.5">Weekly bounds</p><p className="font-semibold text-foreground" style={mono}>${r.floorWeekly} – ${r.ceilWeekly}</p></div>
                              <div><p className="text-muted-foreground mb-0.5">Current rate</p><p className="font-semibold text-foreground" style={mono}>${r.currentDaily}/day · ${r.currentWeekly}/wk</p></div>
                              {!r.locked && <div><p className="text-muted-foreground mb-0.5">ML recommends</p><p className="font-semibold text-primary" style={mono}>${r.mlRecommendedDaily}/day · ${r.mlRecommendedWeekly}/wk</p></div>}
                            </div>
                            <div className="flex gap-2">
                              {!r.locked && !isApplied && r.mlRecommendedDaily !== r.currentDaily && (
                                <button onClick={() => applyRecommendation(r.id)}
                                  className="px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all">
                                  Apply ML Rate
                                </button>
                              )}
                              {isApplied && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={11} /> Applied</span>}
                              <button onClick={() => r.locked ? undefined : openEdit(r)} disabled={r.locked}
                                className="px-3 py-1.5 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                Edit Bounds
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ML model info footer */}
              <div className="mt-6 bg-card border border-border p-5">
                <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>ML Model Signals Used</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { label: "Utilisation Rate", desc: "Higher utilisation → model pushes price toward ceiling", icon: BarChart2 },
                    { label: "Booking Frequency", desc: "Repeat bookings on same asset boost demand confidence", icon: Calendar },
                    { label: "Market Seasonality", desc: "Adjusted for construction peak seasons and weather patterns", icon: TrendingUp },
                  ].map(({ label, desc, icon: Icon }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-0.5">{label}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}


      </div>
    </div>
  );
}


export { AdminDashboard };
