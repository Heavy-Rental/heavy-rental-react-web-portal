import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, Calendar, ArrowRight, Star,
  Phone, Mail, Menu, X, Truck, Wrench,
  CheckCircle, ChevronLeft, ChevronRight,
  BarChart2, Activity, DollarSign, AlertTriangle,
  MessageCircle, Send, User, LogOut, ShoppingCart, Trash2, Bot,
  Upload,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { CustomerOnboarding } from "./app/CustomerOnboarding";
import { AdminDashboard, AssetFormModal } from "./app/AdminDashboard";
import { SafetyPage } from "./app/SafetyPage";
import { AboutPage } from "./app/AboutPage";
import { ProjectsPage } from "./app/ProjectsPage";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type Role = "customer" | "employee" | "admin";
type View = "portal" | "customer" | "dashboard" | "admin" | "safety" | "about" | "projects";
type DayStatus = "available" | "booked" | "maintenance";
type OnboardingMode = "know" | "browse" | "specs" | null;

interface CartItem {
  equipment: EquipmentItem;
  startDay: number;
  endDay: number;
  month: number;
  year: number;
}

interface ChatMessage {
  from: "bot" | "user";
  text: string;
}

interface RentalPlanItem {
  equipmentName: string;
  category: string;
  dailyRate: number;
  days: number;
  startDay: number;
  endDay: number;
  month: number;
  year: number;
}

interface RentalPlan {
  id: string;
  paidAt: string;
  items: RentalPlanItem[];
  totalCost: number;
  depositPaid: number;
  balanceDue: number;
  status: "Active" | "Completed";
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

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

type EquipmentItem = typeof EQUIPMENT_LIST[0];

const CATEGORIES = [
  { label: "Excavators", count: 48, img: "photo-1630288214173-a119cf823388" },
  { label: "Cranes", count: 22, img: "photo-1653315917834-04a6d84e132e" },
  { label: "Bulldozers", count: 17, img: "photo-1575281923032-f40d94ef6160" },
  { label: "Forklifts", count: 35, img: "photo-1664312616511-81fe2e745cb3" },
  { label: "Dump Trucks", count: 29, img: "photo-1780054984720-20ccf265317f" },
  { label: "Compactors", count: 14, img: "photo-1759950345011-ee5a96640e00" },
];

const TESTIMONIALS = [
  { name: "Marcus Delgado", role: "Site Manager — Ironclad Construction", quote: "We needed a 100-ton crane on 48-hour notice. Heavy Rental delivered, certified operator included. Saved our project timeline.", rating: 5 },
  { name: "Jennifer Okafor", role: "Operations Director — Vertex Earthworks", quote: "We run 12+ excavators through Heavy Rental month over month. Billing is clean, equipment is well-maintained.", rating: 5 },
  { name: "Brian Stellrecht", role: "Owner — Stellrecht Grading Co.", quote: "As a small contractor, Heavy Rental lets me bid on jobs I'd have had to turn down before.", rating: 5 },
];

const STATS = [
  { value: "1,200+", label: "Equipment Units" },
  { value: "98%", label: "On-Time Delivery" },
  { value: "340+", label: "Active Clients" },
  { value: "24/7", label: "Support Available" },
];

const MONTHLY_UTILIZATION = [
  { month: "Feb", utilization: 68, revenue: 189000 },
  { month: "Mar", utilization: 74, revenue: 214000 },
  { month: "Apr", utilization: 79, revenue: 231000 },
  { month: "May", utilization: 85, revenue: 258000 },
  { month: "Jun", utilization: 88, revenue: 271000 },
  { month: "Jul", utilization: 76, revenue: 243000 },
];

const STATUS_DIST = [
  { name: "Rented Out", value: 68, color: "#f5a623" },
  { name: "Available", value: 22, color: "#4ade80" },
  { name: "Maintenance", value: 7, color: "#f87171" },
  { name: "In Transit", value: 3, color: "#60a5fa" },
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── CHATBOT LOGIC ────────────────────────────────────────────────────────────

type ChatStep = "greeting" | "task" | "load" | "location" | "result";
interface ChatState { step: ChatStep; task: string; load: number | null; location: string; }

function getBotResponse(state: ChatState, userInput: string): { reply: string; nextState: ChatState; suggestions?: string[]; recommended?: EquipmentItem[] } {
  if (state.step === "greeting") {
    return {
      reply: "Great! What kind of work are you planning? For example: excavation, lifting, grading, warehouse, or aerial work.",
      nextState: { ...state, step: "task" },
      suggestions: ["Excavation / Trenching", "Lifting / Crane work", "Land grading / Clearing", "Warehouse / Indoor", "Aerial / Elevated work", "Demolition"],
    };
  }
  if (state.step === "task") {
    return {
      reply: "Got it. What's the approximate load or material weight you need to handle?",
      nextState: { ...state, step: "load", task: userInput },
      suggestions: ["Under 2 tons", "2–20 tons", "20–50 tons", "50–100 tons", "Not sure"],
    };
  }
  if (state.step === "load") {
    const input = userInput.toLowerCase();
    let loadNum: number | null = null;
    if (input.includes("under 2") || input.includes("1 ton")) loadNum = 1.5;
    else if (input.includes("2") && input.includes("20")) loadNum = 10;
    else if (input.includes("20") && input.includes("50")) loadNum = 30;
    else if (input.includes("50") || input.includes("100")) loadNum = 80;
    return {
      reply: "Almost there — which city or region is your jobsite in?",
      nextState: { ...state, step: "location", load: loadNum },
      suggestions: ["Houston, TX", "Dallas, TX", "Austin, TX", "San Antonio, TX", "Other"],
    };
  }
  if (state.step === "location") {
    const task = state.task.toLowerCase();
    const load = state.load;
    const scored = EQUIPMENT_LIST.map(e => ({
      ...e,
      score: e.idealFor.reduce((s, kw) => s + (task.includes(kw) ? 3 : 0), 0)
        + (load !== null && e.maxLoad >= load ? 2 : 0)
        + (e.available ? 1 : 0),
    })).sort((a, b) => b.score - a.score);
    return {
      reply: `Based on your project in ${userInput}, here are my top recommendations:`,
      nextState: { ...state, step: "result", location: userInput },
      recommended: scored.slice(0, 2),
    };
  }
  return {
    reply: "Would you like to start over and find a different machine?",
    nextState: { step: "greeting", task: "", load: null, location: "" },
    suggestions: ["Start over"],
  };
}

// ─── CALENDAR HELPERS ─────────────────────────────────────────────────────────

function generateCalendarData(machineId: number, year: number, month: number): Record<number, DayStatus> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: Record<number, DayStatus> = {};
  const seed = (machineId * 7 + month * 3 + year) % 29;
  const bookedRanges: [number, number][] = [
    [((3 + seed) % daysInMonth) + 1, ((8 + seed) % daysInMonth) + 1],
    [((14 + seed) % daysInMonth) + 1, ((18 + seed) % daysInMonth) + 1],
  ];
  const maintenanceDays = [((10 + seed) % daysInMonth) + 1];
  for (let d = 1; d <= daysInMonth; d++) {
    const inBooked = bookedRanges.some(([s, e]) => s <= e ? d >= s && d <= e : d >= s || d <= e);
    if (maintenanceDays.includes(d)) result[d] = "maintenance";
    else if (inBooked) result[d] = "booked";
    else result[d] = "available";
  }
  return result;
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

const mono = { fontFamily: "'DM Mono', monospace" } as const;
const display = { fontFamily: "'Barlow Condensed', sans-serif" } as const;
const sans = { fontFamily: "'DM Sans', sans-serif" } as const;

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────

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

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────────

const ACCOUNTS: Record<string, { role: Role; name: string }> = {
  "john@company.com":  { role: "customer", name: "John" },
  "sarah@company.com": { role: "admin",    name: "Sarah" },
};

function LoginModal({ onLogin, onClose }: { onLogin: (role: Role, name: string) => void; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const account = ACCOUNTS[email.toLowerCase().trim()];
    if (!account) { setError("Invalid credentials. Please check your email."); return; }
    if (!password) { setError("Password is required."); return; }
    onLogin(account.role, account.name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border w-full max-w-md" style={sans}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="text-xl font-black text-foreground" style={display}>SIGN IN</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder="you@company.com" required autoFocus
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
              placeholder="••••••••" required
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit"
            className="w-full py-3 font-bold text-sm tracking-widest uppercase bg-primary hover:brightness-110 text-primary-foreground transition-all mt-1">
            Sign In
          </button>
          <p className="text-xs text-muted-foreground text-center" style={mono}>
            Customer: john@company.com · Admin: sarah@company.com
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── CUSTOMER ONBOARDING ──────────────────────────────────────────────────────


function MachineCalendar({ machine, onClose, onAddToCart }: { machine: EquipmentItem; onClose: () => void; onAddToCart: (item: CartItem) => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [startDay, setStartDay] = useState<number | null>(null);
  const [endDay, setEndDay] = useState<number | null>(null);

  const calData = useMemo(() => generateCalendarData(machine.id, year, month), [machine.id, year, month]);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const handleDayClick = (d: number) => {
    if (calData[d] === "booked" || calData[d] === "maintenance") return;
    if (!startDay || (startDay && endDay)) { setStartDay(d); setEndDay(null); }
    else { if (d < startDay) setStartDay(d); else setEndDay(d); }
  };

  const isInRange = (d: number) => !!(startDay && endDay && d >= startDay && d <= endDay);
  const totalDays = startDay && endDay ? endDay - startDay + 1 : 0;

  const dayClass = (d: number) => {
    const s = calData[d];
    if (s === "booked") return "bg-amber-500/15 text-amber-400/60 cursor-not-allowed";
    if (s === "maintenance") return "bg-red-500/15 text-red-400/60 cursor-not-allowed";
    if (d === startDay || d === endDay) return "bg-primary text-primary-foreground cursor-pointer";
    if (isInRange(d)) return "bg-primary/20 text-primary cursor-pointer";
    return "text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-card border border-border w-full max-w-xl max-h-[92vh] overflow-y-auto" style={sans}>
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-0.5" style={mono}>{machine.category}</p>
            <h2 className="text-xl font-black text-foreground" style={display}>{machine.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">${machine.daily.toLocaleString()}/day · {machine.location}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4 pb-1 text-xs text-muted-foreground">
          {!startDay ? "Click a day to set your start date." : !endDay ? "Now click an end date." : `Selected: ${MONTH_NAMES[month]} ${startDay}–${endDay}, ${year}`}
        </div>

        <div className="flex gap-4 px-5 py-2 flex-wrap">
          {[{ cls: "bg-green-500/20", label: "Available" }, { cls: "bg-amber-500/20", label: "Booked" }, { cls: "bg-red-500/20", label: "Maintenance" }, { cls: "bg-primary", label: "Selected" }].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 ${cls}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-2">
          <button onClick={prevMonth} className="p-1.5 border border-border hover:border-primary/50 hover:text-primary text-muted-foreground transition-colors"><ChevronLeft size={15} /></button>
          <span className="font-black text-foreground" style={display}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 border border-border hover:border-primary/50 hover:text-primary text-muted-foreground transition-colors"><ChevronRight size={15} /></button>
        </div>

        <div className="grid grid-cols-7 px-5 gap-1 mb-1">
          {DAY_LABELS.map(d => <div key={d} className="text-center text-xs text-muted-foreground py-1" style={mono}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 px-5 gap-1 pb-4">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            return (
              <button key={d} onClick={() => handleDayClick(d)}
                className={`aspect-square flex items-center justify-center text-sm font-medium transition-all duration-100 ${dayClass(d)}`}>
                {d}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-px bg-border mx-5 mb-4">
          {[
            { label: "Start Date", value: startDay ? `${MONTH_NAMES[month].slice(0, 3)} ${startDay}` : "—", color: "text-foreground" },
            { label: "End Date", value: endDay ? `${MONTH_NAMES[month].slice(0, 3)} ${endDay}` : "—", color: "text-foreground" },
            { label: "Total Cost", value: totalDays ? `$${(totalDays * machine.daily).toLocaleString()}` : "—", color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-secondary/40 px-3 py-3 text-center">
              <p className={`text-lg font-black ${color}`} style={display}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all">Cancel</button>
          <button onClick={() => { if (startDay && endDay) { onAddToCart({ equipment: machine, startDay, endDay, month, year }); onClose(); } }}
            disabled={!startDay || !endDay}
            className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CHATBOT ──────────────────────────────────────────────────────────────────

function Chatbot({ onSelectEquipment }: { onSelectEquipment: (e: EquipmentItem) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "bot", text: "Hi! I'm your equipment assistant. I can help you find the right machine for your job. Ready to get started?" },
  ]);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<ChatState>({ step: "greeting", task: "", load: null, location: "" });
  const [suggestions, setSuggestions] = useState<string[]>(["Yes, help me find equipment!"]);
  const [recommended, setRecommended] = useState<EquipmentItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const { reply, nextState, suggestions: nextSugg, recommended: rec } = getBotResponse(chatState, text);
    setMessages(prev => [...prev, { from: "user", text }, { from: "bot", text: reply }]);
    setChatState(nextState);
    setSuggestions(nextSugg ?? []);
    setRecommended(rec ?? []);
    setInput("");
  };

  return (
    <>
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center shadow-2xl hover:brightness-110 transition-all duration-200">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-card border border-border shadow-2xl flex flex-col" style={{ height: 480, ...sans }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
            <div className="w-8 h-8 bg-primary flex items-center justify-center"><Bot size={16} className="text-primary-foreground" /></div>
            <div>
              <p className="text-sm font-black text-foreground" style={display}>EQUIPMENT ASSISTANT</p>
              <p className="text-xs text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" /> Online</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.from === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 flex items-center justify-center shrink-0 ${m.from === "bot" ? "bg-primary" : "bg-secondary"}`}>
                  {m.from === "bot" ? <Bot size={13} className="text-primary-foreground" /> : <User size={13} className="text-muted-foreground" />}
                </div>
                <div className={`max-w-[80%] px-3 py-2 text-xs leading-relaxed ${m.from === "bot" ? "bg-secondary/60 text-foreground" : "bg-primary text-primary-foreground"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {recommended.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                {recommended.map(eq => (
                  <div key={eq.id} className="border border-border bg-secondary/40 p-3">
                    <p className="text-xs font-black text-foreground mb-0.5" style={display}>{eq.name}</p>
                    <p className="text-xs text-muted-foreground mb-2">${eq.daily.toLocaleString()}/day · {eq.category}</p>
                    <button onClick={() => { onSelectEquipment(eq); setOpen(false); }}
                      className="w-full py-1.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all">
                      Select This Machine
                    </button>
                  </div>
                ))}
                <button onClick={() => { setChatState({ step: "greeting", task: "", load: null, location: "" }); setSuggestions(["Yes, help me find equipment!"]); setRecommended([]); setMessages(prev => [...prev, { from: "bot", text: "No problem! Let's start over." }]); }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors text-center py-1">Start over →</button>
              </div>
            )}
            {suggestions.length > 0 && recommended.length === 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="px-2.5 py-1 border border-primary/40 text-xs text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-150">{s}</button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border flex items-center gap-2 px-3 py-2.5">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
              placeholder="Type a message…" className="flex-1 bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none" />
            <button onClick={() => send(input)} className="w-7 h-7 bg-primary flex items-center justify-center hover:brightness-110 transition-all">
              <Send size={13} className="text-primary-foreground" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── CUSTOMER PORTAL ──────────────────────────────────────────────────────────

function CustomerPortal({ userName, onLogout, onHome }: { userName: string; onLogout: () => void; onHome: () => void }) {
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>(null);
  const [specsRecs, setSpecsRecs] = useState<EquipmentItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [calendarMachine, setCalendarMachine] = useState<EquipmentItem | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailItem, setDetailItem] = useState<EquipmentItem | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: userName, email: "customer@heavyrental.com",
    phone: "+1 (832) 555-0194", company: "Apex Construction LLC",
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reservationId, setReservationId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<RentalPlan | null>(null);
  const [rentalPlans, setRentalPlans] = useState<RentalPlan[]>([
    {
      id: "RNT-0041",
      paidAt: "Jun 3, 2025",
      items: [{ equipmentName: "CAT 320 Hydraulic Excavator", category: "Excavator", dailyRate: 890, days: 7, startDay: 3, endDay: 9, month: 5, year: 2025 }],
      totalCost: 6230,
      depositPaid: 1869,
      balanceDue: 4361,
      status: "Completed",
    },
    {
      id: "RNT-0038",
      paidAt: "May 14, 2025",
      items: [{ equipmentName: "Liebherr LTM 1100 Mobile Crane", category: "Crane", dailyRate: 2400, days: 3, startDay: 14, endDay: 16, month: 4, year: 2025 }],
      totalCost: 7200,
      depositPaid: 2160,
      balanceDue: 5040,
      status: "Completed",
    },
    {
      id: "RNT-0029",
      paidAt: "Mar 22, 2025",
      items: [{ equipmentName: "Komatsu D65 Bulldozer", category: "Bulldozer", dailyRate: 750, days: 6, startDay: 22, endDay: 27, month: 2, year: 2025 }],
      totalCost: 4500,
      depositPaid: 1350,
      balanceDue: 3150,
      status: "Completed",
    },
  ]);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [specUploadOpen, setSpecUploadOpen] = useState(false);

  if (!onboardingMode) {
    return (
      <CustomerOnboarding userName={userName} onDone={(mode, recs) => {
        setOnboardingMode(mode);
        if (recs) setSpecsRecs(recs);
      }} />
    );
  }

  if (specUploadOpen) {
    return (
      <CustomerOnboarding
        userName={userName}
        initialStep="upload"
        onDone={(mode, recs) => {
          setSpecUploadOpen(false);
          setOnboardingMode(mode);
          if (recs) setSpecsRecs(recs);
        }}
      />
    );
  }

  const filters = ["All", "Excavator", "Crane", "Bulldozer", "Forklift", "Boom Lift"];
  const filtered = EQUIPMENT_LIST.filter(e => {
    const matchCat = activeFilter === "All" || e.category === activeFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.location.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });
  const totalCost = cart.reduce((s, c) => s + (c.endDay - c.startDay + 1) * c.equipment.daily, 0);

  const addToCart = (item: CartItem) => {
    setCart(prev => [...prev.filter(c => c.equipment.id !== item.equipment.id), item]);
    setCartOpen(true);
  };

  const handleChatbotSelect = (eq: EquipmentItem) => {
    setHighlightId(eq.id);
    setCalendarMachine(eq);
    setTimeout(() => setHighlightId(null), 3000);
  };

  if (confirmed) {
    const depositPaid = Math.round(totalCost * 0.3) || Math.round(cart.reduce((s,c)=>(s+(c.endDay-c.startDay+1)*c.equipment.daily),0)*0.3);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" style={sans}>
        <div className="max-w-lg w-full">
          {/* Success header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <p className="text-xs text-green-400 font-semibold tracking-widest uppercase mb-2" style={mono}>Deposit Received · Equipment Held</p>
            <h2 className="text-5xl font-black text-foreground leading-none mb-2" style={display}>RESERVATION CONFIRMED!</h2>
            <p className="text-muted-foreground text-sm">Thank you, {userName.split(" ")[0]}. Your equipment has been reserved and is held exclusively for you.</p>
          </div>

          {/* Reservation card */}
          <div className="bg-card border border-primary/30 mb-4">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-primary/5">
              <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase" style={mono}>Reservation ID</p>
              <p className="text-lg font-black text-primary" style={mono}>{reservationId}</p>
            </div>
            <div className="divide-y divide-border">
              {cart.map(c => {
                const days = c.endDay - c.startDay + 1;
                const cost = days * c.equipment.daily;
                return (
                  <div key={c.equipment.id} className="px-5 py-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{c.equipment.name}</p>
                      <p className="text-xs text-muted-foreground">{MONTH_NAMES[c.month].slice(0,3)} {c.startDay}–{c.endDay}, {c.year} · {days} day{days>1?"s":""}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0" style={mono}>${cost.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-border bg-secondary/20 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Rental Cost</span>
                <span className="font-semibold text-foreground" style={mono}>${cart.reduce((s,c)=>(s+(c.endDay-c.startDay+1)*c.equipment.daily),0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-400 font-semibold">Deposit Paid (30%)</span>
                <span className="font-black text-green-400" style={mono}>−${depositPaid.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-1.5 border-t border-border">
                <span className="text-muted-foreground">Balance Due on Delivery</span>
                <span className="font-black text-foreground text-lg" style={display}>${(cart.reduce((s,c)=>(s+(c.endDay-c.startDay+1)*c.equipment.daily),0) - depositPaid).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* What's next */}
          <div className="bg-card border border-border p-5 mb-6">
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>What happens next</p>
            <div className="flex flex-col gap-3">
              {[
                { step: "01", text: "Confirmation email sent to your registered address with full booking details." },
                { step: "02", text: "Our logistics team will contact you within 2 hours to arrange delivery." },
                { step: "03", text: "Remaining balance collected on equipment delivery. Cash, card, or bank transfer accepted." },
              ].map(({ step, text }) => (
                <div key={step} className="flex gap-3">
                  <span className="text-xs font-black text-primary shrink-0 mt-0.5" style={mono}>{step}</span>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setConfirmed(false)}
            className="w-full py-3 bg-primary text-primary-foreground font-bold text-sm tracking-widest uppercase hover:brightness-110 transition-all">
            Browse More Equipment
          </button>
        </div>
      </div>
    );
  }

  // ── RENTAL PLAN DETAIL PAGE ──────────────────────────────────────────────────
  if (selectedPlan) {
    const plan = selectedPlan;
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const navBar = (
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
          <button onClick={onHome} className="text-xl font-black text-primary hover:opacity-80 transition-opacity" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></button>
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedPlan(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <div className="w-6 h-6 bg-primary/20 border border-primary/40 flex items-center justify-center">
                <User size={12} className="text-primary" />
              </div>
              <span>{userName}</span>
              <span className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10" style={mono}>CUSTOMER</span>
            </button>
            <button onClick={onLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><LogOut size={13} /> Sign out</button>
          </div>
        </div>
      </nav>
    );

    return (
      <div className="min-h-screen bg-background text-foreground" style={sans}>
        {navBar}
        <div className="max-w-4xl mx-auto px-6 py-10">
          {/* Back */}
          <button onClick={() => setSelectedPlan(null)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group">
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Profile
          </button>

          {/* Invoice header */}
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>Rental Plan</p>
              <h1 className="text-4xl font-black text-foreground leading-none mb-2" style={display}>{plan.id}</h1>
              <p className="text-sm text-muted-foreground">Issued to <span className="text-foreground font-semibold">{userName}</span> · Paid on {plan.paidAt}</p>
            </div>
            <div className="text-right shrink-0">
              <span className={`inline-block px-3 py-1 text-xs font-bold tracking-widest uppercase border mb-3 ${plan.status === "Active" ? "bg-primary/10 text-primary border-primary/30" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                {plan.status}
              </span>
              <p className="text-xs text-muted-foreground">Invoice Total</p>
              <p className="text-3xl font-black text-foreground" style={display}>${plan.totalCost.toLocaleString()}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border mb-8" />

          {/* Bill To / Plan Info */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-card border border-border p-5">
              <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>Bill To</p>
              <p className="font-bold text-foreground">{userName}</p>
              <p className="text-sm text-muted-foreground">customer@heavyrental.com</p>
              <p className="text-sm text-muted-foreground">Apex Construction LLC</p>
              <p className="text-sm text-muted-foreground">4820 Main St, Houston, TX 77002</p>
            </div>
            <div className="bg-card border border-border p-5">
              <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>Plan Details</p>
              <div className="space-y-1.5">
                {[
                  { label: "Plan No.", value: plan.id },
                  { label: "Date Issued", value: plan.paidAt },
                  { label: "Equipment", value: `${plan.items.length} unit${plan.items.length !== 1 ? "s" : ""}` },
                  { label: "Total Days", value: `${plan.items.reduce((s, i) => s + i.days, 0)} days` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground" style={mono}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Line items table */}
          <div className="border border-border mb-6">
            <div className="grid grid-cols-12 bg-muted/60 border-b border-border px-5 py-3">
              <p className="col-span-5 text-xs font-semibold text-muted-foreground uppercase tracking-widest" style={mono}>Equipment</p>
              <p className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center" style={mono}>Days</p>
              <p className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest text-right" style={mono}>Unit Price</p>
              <p className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest text-right" style={mono}>Amount</p>
            </div>
            {plan.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 px-5 py-4 border-b border-border/40 last:border-0 items-center bg-card">
                <div className="col-span-5">
                  <p className="font-semibold text-foreground">{item.equipmentName}</p>
                  <p className="text-xs text-primary mt-0.5" style={mono}>{item.category}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {MONTHS[item.month]} {item.startDay} – {MONTHS[item.month]} {item.endDay}, {item.year}
                  </p>
                </div>
                <p className="col-span-2 text-sm text-foreground text-center font-medium">{item.days}</p>
                <p className="col-span-3 text-sm text-foreground text-right">${item.dailyRate.toLocaleString()}<span className="text-xs text-muted-foreground">/day</span></p>
                <p className="col-span-2 text-base font-black text-foreground text-right" style={display}>${(item.dailyRate * item.days).toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Payment summary */}
          <div className="flex justify-end mb-8">
            <div className="w-full max-w-sm border border-border bg-card">
              <div className="px-5 py-4 space-y-2.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${plan.totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Deposit Paid (30%)</span>
                  <span className="text-green-400 font-semibold">− ${plan.depositPaid.toLocaleString()}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="text-sm font-bold text-foreground">Balance Due on Delivery</span>
                  <span className="text-lg font-black text-foreground" style={display}>${plan.balanceDue.toLocaleString()}</span>
                </div>
              </div>
              <div className="px-5 py-3 bg-muted/30 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The remaining balance is due on the day of delivery. Equipment will be held exclusively once the deposit is confirmed.
                </p>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="border-t border-border pt-6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">HEAVY RENTAL INC. · 4820 Main St, Houston TX 77002 · support@heavyrental.com</p>
            <button onClick={() => setSelectedPlan(null)}
              className="px-5 py-2 border border-border text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
              Back to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── USER PROFILE PAGE ────────────────────────────────────────────────────────
  if (profileOpen) {
    const initials = userName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

    const navBar = (
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <button onClick={onHome} className="text-xl font-black text-primary hover:opacity-80 transition-opacity" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></button>
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <div className="w-6 h-6 bg-primary/20 border border-primary/40 flex items-center justify-center">
                <User size={12} className="text-primary" />
              </div>
              <span>{userName}</span>
              <span className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10" style={mono}>CUSTOMER</span>
            </button>
            <button onClick={onLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><LogOut size={13} /> Sign out</button>
          </div>
        </div>
      </nav>
    );

    return (
      <div className="min-h-screen bg-background text-foreground" style={sans}>
        {navBar}
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Back */}
          <button onClick={() => setProfileOpen(false)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group">
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Catalog
          </button>

          {/* Header */}
          <div className="flex items-start gap-6 mb-10">
            <div className="w-20 h-20 bg-primary/20 border-2 border-primary/40 flex items-center justify-center shrink-0">
              <span className="text-3xl font-black text-primary" style={display}>{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-1" style={mono}>Customer Account</p>
              <h1 className="text-5xl font-black text-foreground leading-none mb-1" style={display}>{userName.toUpperCase()}</h1>
              <p className="text-sm text-muted-foreground">{profileForm.company} · Member since Jan 2024</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left col */}
            <div className="flex flex-col gap-5">
              {/* Personal info */}
              <div className="bg-card border border-border">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase" style={mono}>Personal Information</p>
                  {!editMode ? (
                    <button onClick={() => setEditMode(true)}
                      className="px-3 py-1 text-xs font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditMode(false)}
                        className="px-3 py-1 text-xs font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground transition-all">
                        Cancel
                      </button>
                      <button onClick={() => setEditMode(false)}
                        className="px-3 py-1 text-xs font-bold tracking-widest uppercase bg-primary text-primary-foreground hover:brightness-110 transition-all">
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
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      {editMode ? (
                        <input value={profileForm[key]}
                          onChange={e => setProfileForm(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full bg-secondary/50 border border-border px-2 py-1 text-sm text-foreground outline-none focus:border-primary/60 transition-colors" />
                      ) : (
                        <p className="text-sm font-medium text-foreground">{profileForm[key]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="bg-card border border-border p-5">
                <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4" style={mono}>Account Stats</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Plans", value: rentalPlans.length },
                    { label: "Days Rented", value: rentalPlans.reduce((s, r) => s + r.items.reduce((x, i) => x + i.days, 0), 0) },
                    { label: "Total Spent", value: `$${rentalPlans.reduce((s, r) => s + r.depositPaid, 0).toLocaleString()}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-secondary/40 border border-border px-3 py-3">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-2xl font-black text-foreground" style={display}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right col */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Rental Plans */}
              <div className="bg-card border border-border">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase" style={mono}>Rental Plan</p>
                  <span className="text-xs text-muted-foreground">{rentalPlans.length} {rentalPlans.length === 1 ? "plan" : "plans"}</span>
                </div>
                {rentalPlans.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-muted-foreground text-sm">No rental plans yet.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Rental plans are created after you complete a payment.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {rentalPlans.map(plan => (
                      <button key={plan.id} onClick={() => { setProfileOpen(false); setSelectedPlan(plan); }}
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors text-left group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-black text-foreground tracking-wide" style={mono}>{plan.id}</p>
                            <span className={`px-1.5 py-0.5 text-xs font-semibold border ${plan.status === "Active" ? "bg-primary/10 text-primary border-primary/30" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                              {plan.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {plan.items.map(i => i.equipmentName).join(", ")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {plan.items.reduce((s, i) => s + i.days, 0)} days · Paid {plan.paidAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="text-lg font-black text-foreground" style={display}>${plan.totalCost.toLocaleString()}</p>
                          </div>
                          <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
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

  // ── EQUIPMENT DETAIL PAGE ────────────────────────────────────────────────────
  if (detailItem) {
    const inCart = cart.some(c => c.equipment.id === detailItem.id);
    const SPEC_ROWS: [string, string][] = [
      ["Category", detailItem.category],
      ["Year", String(detailItem.year)],
      ["Max Capacity", `${detailItem.tons} tonnes`],
      ["Max Load", String(detailItem.maxLoad)],
      ["Location", detailItem.location],
      ["Daily Rate", `$${detailItem.daily.toLocaleString()}`],
      ["Weekly Rate", `$${detailItem.weekly.toLocaleString()}`],
      ["Availability", detailItem.available ? "Available Now" : "Currently On Rent"],
    ];
    return (
      <div className="min-h-screen bg-background text-foreground" style={sans}>
        {calendarMachine && <MachineCalendar machine={calendarMachine} onClose={() => setCalendarMachine(null)} onAddToCart={(item) => { addToCart(item); setDetailItem(null); }} />}
        {/* Nav */}
        <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
            <button onClick={onHome} className="text-xl font-black text-primary hover:opacity-80 transition-opacity" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></button>
            <div className="flex items-center gap-4">
              <button onClick={() => setProfileOpen(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                <div className="w-6 h-6 bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:border-primary transition-colors">
                  <User size={12} className="text-primary" />
                </div>
                <span>{userName}</span>
                <span className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10 group-hover:bg-primary/20 transition-colors" style={mono}>CUSTOMER</span>
              </button>
              <button onClick={() => setSpecUploadOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/40 bg-primary/5 text-xs font-bold tracking-widest uppercase text-primary hover:bg-primary/15 hover:border-primary/70 transition-all" style={mono}>
                <Upload size={13} /> Upload Specs
              </button>
              <button onClick={() => setCartOpen(o => !o)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-all">
                <ShoppingCart size={15} />
                {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">{cart.length}</span>}
              </button>
              <button onClick={onLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><LogOut size={13} /> Sign out</button>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Breadcrumb */}
          <button onClick={() => setDetailItem(null)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group">
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Equipment Catalog
          </button>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: image + gallery */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <div className="relative aspect-video bg-muted overflow-hidden border border-border">
                <img src={`https://images.unsplash.com/${detailItem.img}?w=900&h=520&fit=crop&auto=format`}
                  alt={detailItem.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className={`px-2.5 py-1 text-xs font-bold border ${detailItem.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                    {detailItem.available ? "● Available" : "● On Rent"}
                  </span>
                  {inCart && <span className="px-2.5 py-1 text-xs font-bold bg-primary text-primary-foreground">In Cart</span>}
                </div>
              </div>
              {/* Thumbnail strip — same image at different crops for demo */}
              <div className="grid grid-cols-3 gap-2">
                {["?w=300&h=180&fit=crop&crop=entropy", "?w=300&h=180&fit=crop&crop=center", "?w=300&h=180&fit=crop&crop=faces,edges"].map((q, i) => (
                  <div key={i} className="aspect-video bg-muted overflow-hidden border border-border opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                    <img src={`https://images.unsplash.com/${detailItem.img}${q}&auto=format`} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Ideal For */}
              <div className="bg-card border border-border p-5">
                <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>Ideal For</p>
                <div className="flex flex-wrap gap-2">
                  {detailItem.idealFor.map(use => (
                    <span key={use} className="px-3 py-1 text-xs bg-primary/10 text-primary border border-primary/20 font-semibold">{use}</span>
                  ))}
                </div>
              </div>

            </div>

            {/* Right: details + CTA */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div>
                <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-1" style={mono}>{detailItem.category}</p>
                <h1 className="text-4xl font-black text-foreground leading-none mb-3" style={display}>{detailItem.name}</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">{detailItem.desc}</p>
              </div>

              {/* Pricing */}
              <div className="bg-card border border-border p-5">
                <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>Pricing</p>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Daily rate</p>
                    <p className="text-3xl font-black text-foreground" style={display}>${detailItem.daily.toLocaleString()}</p>
                  </div>
                  <div className="w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Weekly rate</p>
                    <p className="text-3xl font-black text-foreground" style={display}>${detailItem.weekly.toLocaleString()}</p>
                    <p className="text-xs text-green-400 mt-0.5">Save {Math.round((1 - detailItem.weekly / (detailItem.daily * 7)) * 100)}% vs daily</p>
                  </div>
                </div>
              </div>

              {/* Specs table */}
              <div className="bg-card border border-border">
                <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase px-5 pt-4 pb-3 border-b border-border" style={mono}>Specifications</p>
                <div className="divide-y divide-border">
                  {SPEC_ROWS.map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className={`text-xs font-semibold text-right ${label === "Availability" ? (detailItem.available ? "text-green-400" : "text-amber-400") : "text-foreground"}`} style={mono}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2" style={mono}>Features & Tags</p>
                <div className="flex flex-wrap gap-2">
                  {detailItem.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 text-xs bg-secondary/60 text-muted-foreground border border-border" style={mono}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col gap-3 sticky top-20">
                <button
                  disabled={!detailItem.available}
                  onClick={() => setCalendarMachine(detailItem)}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground text-sm font-black tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <Calendar size={16} /> Select Rental Dates
                </button>
                {!detailItem.available && (
                  <p className="text-xs text-center text-amber-400">This machine is currently on rent. Check back soon.</p>
                )}
                <button onClick={() => setDetailItem(null)}
                  className="w-full py-3 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground hover:border-primary/30 transition-all">
                  ← Back to Catalog
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {calendarMachine && <MachineCalendar machine={calendarMachine} onClose={() => setCalendarMachine(null)} onAddToCart={addToCart} />}

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <button onClick={onHome} className="text-xl font-black text-primary hover:opacity-80 transition-opacity" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></button>
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <div className="w-6 h-6 bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:border-primary transition-colors">
                <User size={12} className="text-primary" />
              </div>
              <span>{userName}</span>
              <span className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10 group-hover:bg-primary/20 transition-colors" style={mono}>CUSTOMER</span>
            </button>
            <button onClick={() => setSpecUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/40 bg-primary/5 text-xs font-bold tracking-widest uppercase text-primary hover:bg-primary/15 hover:border-primary/70 transition-all" style={mono}>
              <Upload size={13} /> Upload Specs
            </button>
            <button onClick={() => setCartOpen(o => !o)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-all">
              <ShoppingCart size={15} />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">{cart.length}</span>
              )}
            </button>
            <button onClick={onLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>
            {onboardingMode === "browse" ? "Browsing · No pressure" : onboardingMode === "specs" ? "Based on your specs" : `Welcome back, ${userName.split(" ")[0]}`}
          </p>
          <h1 className="text-5xl font-black text-foreground leading-none" style={display}>
            {onboardingMode === "specs" ? "YOUR RECOMMENDATIONS" : "SELECT YOUR EQUIPMENT"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {onboardingMode === "specs"
              ? "Matched from your uploaded specs. Select dates on any machine to add it to your cart."
              : "Browse available machines, pick your dates, and submit your rental request."}
          </p>
        </div>

        {/* Specs recommendation banner */}
        {onboardingMode === "specs" && specsRecs.length > 0 && (
          <div className="mb-8 border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-primary flex items-center justify-center"><CheckCircle size={12} className="text-primary-foreground" /></div>
              <p className="text-xs font-semibold text-primary tracking-widest uppercase" style={mono}>Top {specsRecs.length} matches from your specs</p>
              <button onClick={() => setOnboardingMode("know")} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                Show all equipment
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {specsRecs.map((eq, i) => (
                <div key={eq.id} className={`flex items-center gap-3 p-3 bg-card border ${i === 0 ? "border-primary/50" : "border-border"}`}>
                  <div className="w-14 h-14 bg-muted overflow-hidden shrink-0">
                    <img src={`https://images.unsplash.com/${eq.img}?w=120&h=120&fit=crop&auto=format`} alt={eq.name}
                      className="w-full h-full object-cover opacity-80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {i === 0 && <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 font-bold tracking-wider inline-block mb-1">BEST MATCH</span>}
                    <p className="text-xs text-primary font-semibold" style={mono}>{eq.category}</p>
                    <p className="text-sm font-black text-foreground leading-tight truncate" style={display}>{eq.name}</p>
                    <p className="text-xs text-muted-foreground">${eq.daily.toLocaleString()}/day</p>
                  </div>
                  <button onClick={() => setCalendarMachine(eq)}
                    className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all">
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6 items-start">
          {/* Equipment grid */}
          <div className="flex-1 min-w-0">
            {/* Search bar */}
            <div className="flex items-center gap-2 bg-card border border-border px-4 py-2.5 mb-4 focus-within:border-primary/50 transition-colors">
              <Search size={15} className="text-muted-foreground shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, category, location, or tag…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Category filters */}
            <div className="flex gap-2 flex-wrap mb-6">
              {filters.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all border ${activeFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}>{f}</button>
              ))}
            </div>
            {/* Result count */}
            {(searchQuery || activeFilter !== "All") && (
              <p className="text-xs text-muted-foreground mb-4" style={mono}>
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                {searchQuery && <> for "<span className="text-foreground">{searchQuery}</span>"</>}
                {activeFilter !== "All" && <> in <span className="text-foreground">{activeFilter}</span></>}
                {(searchQuery || activeFilter !== "All") && (
                  <button onClick={() => { setSearchQuery(""); setActiveFilter("All"); }}
                    className="ml-2 text-primary hover:text-primary/80 underline underline-offset-2">clear</button>
                )}
              </p>
            )}
            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="py-20 text-center border border-dashed border-border">
                <Search size={28} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-foreground mb-1">No equipment found</p>
                <p className="text-sm text-muted-foreground">Try a different keyword or category.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(item => {
                const inCart = cart.some(c => c.equipment.id === item.id);
                return (
                  <div key={item.id}
                    className={`group bg-card border flex flex-col transition-all duration-300 ${highlightId === item.id ? "border-primary shadow-lg shadow-primary/10" : inCart ? "border-primary/40" : "border-border hover:border-primary/30"}`}>
                    {/* Clickable image area → detail page */}
                    <button onClick={() => setDetailItem(item)} className="relative aspect-video bg-muted overflow-hidden text-left w-full">
                      <img src={`https://images.unsplash.com/${item.img}?w=600&h=340&fit=crop&auto=format`} alt={item.name}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-black/70 text-white text-xs font-bold tracking-widest uppercase px-4 py-2 border border-white/20">View Details</span>
                      </div>
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold border ${item.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                          {item.available ? "Available" : "Booked"}
                        </span>
                        {inCart && <span className="px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">In Cart</span>}
                      </div>
                    </button>
                    <div className="p-4 flex flex-col flex-1">
                      <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-0.5" style={mono}>{item.category}</p>
                      <button onClick={() => setDetailItem(item)} className="text-left">
                        <h3 className="font-black text-lg text-foreground leading-tight mb-1 hover:text-primary transition-colors" style={display}>{item.name}</h3>
                      </button>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{item.desc}</p>
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {[`${item.tons}t`, `${item.year}`, item.location.split(",")[0]].map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-secondary/60 text-muted-foreground" style={mono}>{t}</span>
                        ))}
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">From / day</p>
                          <p className="text-2xl font-black text-foreground" style={display}>${item.daily.toLocaleString()}</p>
                        </div>
                        <div className="flex flex-col gap-1.5 items-end">
                          <button disabled={!item.available} onClick={() => setCalendarMachine(item)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                            <Calendar size={13} /> Select Dates
                          </button>
                          <button onClick={() => setDetailItem(item)}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2">
                            View full details →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart */}
          {cartOpen && (
            <div className="w-72 shrink-0 bg-card border border-border sticky top-20">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="font-black text-foreground text-lg" style={display}>RENTAL PLAN</p>
                <button onClick={() => setCartOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
              </div>
              {cart.length === 0 ? (
                <div className="p-6 text-center">
                  <ShoppingCart size={28} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-muted-foreground">No equipment selected yet.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col divide-y divide-border">
                    {cart.map(c => (
                      <div key={c.equipment.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground leading-tight">{c.equipment.name}</p>
                          <button onClick={() => setCart(prev => prev.filter(x => x.equipment.id !== c.equipment.id))}
                            className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"><Trash2 size={13} /></button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{MONTH_NAMES[c.month].slice(0, 3)} {c.startDay}–{c.endDay} · {c.endDay - c.startDay + 1} days</p>
                        <p className="text-sm font-bold text-primary" style={mono}>${((c.endDay - c.startDay + 1) * c.equipment.daily).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">Total Estimate</span>
                      <span className="text-xl font-black text-foreground" style={display}>${totalCost.toLocaleString()}</span>
                    </div>
                    <button onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                      className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all">
                      Proceed to Deposit
                    </button>
                    <p className="text-xs text-muted-foreground text-center mt-2">30% deposit required to hold your reservation.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <Chatbot onSelectEquipment={handleChatbotSelect} />
      {checkoutOpen && (
        <DepositCheckout
          cart={cart}
          totalCost={totalCost}
          userName={userName}
          onClose={() => setCheckoutOpen(false)}
          onPaid={(rid) => {
            const cost = cart.reduce((s, c) => s + (c.endDay - c.startDay + 1) * c.equipment.daily, 0);
            const dep = Math.round(cost * 0.3);
            const newPlan: RentalPlan = {
              id: rid,
              paidAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              items: cart.map(c => ({
                equipmentName: c.equipment.name,
                category: c.equipment.category,
                dailyRate: c.equipment.daily,
                days: c.endDay - c.startDay + 1,
                startDay: c.startDay,
                endDay: c.endDay,
                month: c.month,
                year: c.year,
              })),
              totalCost: cost,
              depositPaid: dep,
              balanceDue: cost - dep,
              status: "Active",
            };
            setRentalPlans(prev => [newPlan, ...prev]);
            setReservationId(rid);
            setCheckoutOpen(false);
            setConfirmed(true);
            setCart([]);
          }}
        />
      )}
    </div>
  );
}

// ─── EMPLOYEE DASHBOARD ───────────────────────────────────────────────────────

// ─── DEPOSIT CHECKOUT ─────────────────────────────────────────────────────────


function CheckoutInputField({
  label, value, onChange, placeholder, maxLen, error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLen?: number;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLen}
        className={`w-full bg-secondary/50 border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors ${error ? "border-red-500/60" : "border-border"}`} />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function DepositCheckout({
  cart, totalCost, userName, onClose, onPaid,
}: {
  cart: CartItem[];
  totalCost: number;
  userName: string;
  onClose: () => void;
  onPaid: (reservationId: string) => void;
}) {
  const deposit = Math.round(totalCost * 0.3);
  const [step, setStep] = useState<"summary" | "payment" | "processing">("summary");
  const [card, setCard] = useState({ number: "", name: userName, expiry: "", cvv: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState<"card" | "bank">("card");

  const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExpiry = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? d.slice(0,2)+"/"+d.slice(2) : d; };

  const validate = () => {
    const e: Record<string, string> = {};
    if (payMethod === "card") {
      if (card.number.replace(/\s/g,"").length < 16) e.number = "Enter a valid 16-digit card number";
      if (!card.name.trim()) e.name = "Name on card is required";
      if (card.expiry.length < 5) e.expiry = "Enter expiry as MM/YY";
      if (card.cvv.length < 3) e.cvv = "Enter 3 or 4 digit CVV";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = () => {
    if (!validate()) return;
    setStep("processing");
    setTimeout(() => {
      const rid = `RNT-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      onPaid(rid);
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border w-full sm:max-w-xl max-h-[95vh] overflow-y-auto" style={sans}>

        {/* Processing overlay */}
        {step === "processing" && (
          <div className="absolute inset-0 bg-card/95 z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-foreground">Processing your deposit…</p>
            <p className="text-xs text-muted-foreground">Please do not close this window</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p className="text-xs text-primary font-semibold tracking-widest uppercase" style={mono}>
              {step === "summary" ? "Step 1 of 2 · Review" : "Step 2 of 2 · Payment"}
            </p>
            <h2 className="text-2xl font-black text-foreground" style={display}>
              {step === "summary" ? "BOOKING SUMMARY" : "PAY DEPOSIT"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>

        {/* Step 1 — Summary */}
        {step === "summary" && (
          <div className="p-6 flex flex-col gap-5">
            <div className="bg-secondary/30 border border-border">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase" style={mono}>Reserved Equipment</p>
              </div>
              <div className="divide-y divide-border">
                {cart.map(c => {
                  const days = c.endDay - c.startDay + 1;
                  return (
                    <div key={c.equipment.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.equipment.name}</p>
                        <p className="text-xs text-muted-foreground">{MONTH_NAMES[c.month].slice(0,3)} {c.startDay}–{c.endDay}, {c.year} · {days} day{days>1?"s":""}</p>
                      </div>
                      <p className="text-sm font-bold text-foreground shrink-0" style={mono}>${(days * c.equipment.daily).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Rental Value</span>
                <span className="font-semibold text-foreground" style={mono}>${totalCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm pb-2 border-b border-border">
                <span className="text-muted-foreground">Remaining balance (on delivery)</span>
                <span className="font-semibold text-foreground" style={mono}>${(totalCost - deposit).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">Deposit Due Now</p>
                  <p className="text-xs text-muted-foreground">30% of total — holds your reservation</p>
                </div>
                <p className="text-3xl font-black text-primary" style={display}>${deposit.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 px-4 py-3 flex gap-3">
              <CheckCircle size={15} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">Your equipment will be held exclusively for you once your deposit is confirmed. The remaining balance is due on the day of delivery.</p>
            </div>

            <button onClick={() => setStep("payment")}
              className="w-full py-3 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all flex items-center justify-center gap-2">
              Continue to Payment →
            </button>
          </div>
        )}

        {/* Step 2 — Payment */}
        {step === "payment" && (
          <div className="p-6 flex flex-col gap-5">
            {/* Deposit badge */}
            <div className="flex items-center justify-between bg-secondary/40 border border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">Amount to pay now</p>
              <p className="text-2xl font-black text-primary" style={display}>${deposit.toLocaleString()}</p>
            </div>

            {/* Payment method toggle */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2" style={mono}>Payment Method</p>
              <div className="flex gap-2">
                {([["card", "Credit / Debit Card"], ["bank", "Bank Transfer"]] as const).map(([m, label]) => (
                  <button key={m} type="button" onClick={() => setPayMethod(m)}
                    className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase border transition-all ${payMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === "card" ? (
              <div className="flex flex-col gap-4">
                <CheckoutInputField label="Card Number" value={card.number}
                  onChange={v => setCard(p => ({ ...p, number: fmtCard(v) }))} placeholder="1234 5678 9012 3456" error={errors.number} />
                <CheckoutInputField label="Name on Card" value={card.name}
                  onChange={v => setCard(p => ({ ...p, name: v }))} placeholder={userName} error={errors.name} />
                <div className="grid grid-cols-2 gap-4">
                  <CheckoutInputField label="Expiry (MM/YY)" value={card.expiry}
                    onChange={v => setCard(p => ({ ...p, expiry: fmtExpiry(v) }))} placeholder="08/27" maxLen={5} error={errors.expiry} />
                  <CheckoutInputField label="CVV" value={card.cvv}
                    onChange={v => setCard(p => ({ ...p, cvv: v.replace(/\D/g,"").slice(0,4) }))} placeholder="•••" maxLen={4} error={errors.cvv} />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Payments are encrypted and processed securely. We do not store card details.
                </p>
              </div>
            ) : (
              <div className="bg-secondary/30 border border-border p-4 flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-1" style={mono}>Bank Transfer Details</p>
                {[["Bank", "First National Industrial Bank"], ["Account Name", "Heavy Rental LLC"], ["Account No.", "8821-004-7193"], ["Routing No.", "021000089"], ["Reference", `DEP-${userName.split(" ")[0].toUpperCase()}-${deposit}`]].map(([l, v]) => (
                  <div key={l} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{l}</span>
                    <span className="text-xs font-semibold text-foreground" style={mono}>{v}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">Transfer the deposit amount and click confirm. Your reservation will be activated once payment clears (1–2 business days).</p>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={() => setStep("summary")}
                className="flex-1 py-2.5 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground transition-all">
                ← Back
              </button>
              <button onClick={handlePay}
                className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all">
                {payMethod === "card" ? `Pay $${deposit.toLocaleString()} Deposit` : "Confirm Transfer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ASSET RECORD TYPES ───────────────────────────────────────────────────────

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

const CATEGORIES_LIST = ["Excavator", "Crane", "Bulldozer", "Forklift", "Boom Lift", "Dump Truck", "Compactor"];
// ─── EMPLOYEE DASHBOARD ─────────────────────────────────────────────────────

function EmployeeDashboard({ userName, onLogout, onHome }: { userName: string; onLogout: () => void; onHome: () => void }) {
  const [tab, setTab] = useState<"dashboard" | "assets">("dashboard");
  const [assets, setAssets] = useState<AssetRecord[]>(
    EQUIPMENT_LIST.map(e => ({
      ...e,
      tags: e.tags.join(", "),
      serialNo: `SN-${e.category.slice(0, 3).toUpperCase()}-${e.year}-${String(e.id).padStart(4, "0")}`,
      lastService: "2025-05-12",
      nextService: "2025-08-12",
      condition: (["Excellent", "Good", "Good", "Fair"][e.id % 4]) as AssetRecord["condition"],
      photo: `https://images.unsplash.com/photo-${e.img}?w=400&q=80`,
    }))
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [toast, setToast] = useState<string | null>(null);

  const totalRevenue = assets.reduce((s, e) => s + e.revenue, 0);
  const avgUtilization = assets.length ? Math.round(assets.reduce((s, e) => s + e.utilization, 0) / assets.length) : 0;
  const totalHours = assets.reduce((s, e) => s + e.hoursThisMonth, 0);
  const utilizationData = assets.map(e => ({ name: e.name.split(" ").slice(0, 2).join(" "), utilization: e.utilization, target: 80 }));

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleSave = (a: AssetRecord) => {
    setAssets(prev => prev.some(x => x.id === a.id) ? prev.map(x => x.id === a.id ? a : x) : [...prev, a]);
    setFormOpen(false);
    setEditingAsset(null);
    showToast(editingAsset ? "Asset updated successfully." : "New asset added to fleet.");
  };

  const handleDelete = (id: number) => {
    setAssets(prev => prev.filter(x => x.id !== id));
    setDeleteId(null);
    showToast("Asset removed from fleet.");
  };

  const filteredAssets = assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.serialNo.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || a.category === filterCat;
    const matchStatus = filterStatus === "All" || (filterStatus === "Available" ? a.available : !a.available);
    return matchSearch && matchCat && matchStatus;
  });

  const conditionColor = (c: AssetRecord["condition"]) => ({
    Excellent: "text-green-400 bg-green-500/10 border-green-500/30",
    Good: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    Fair: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    "Needs Repair": "text-red-400 bg-red-500/10 border-red-500/30",
  }[c]);

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
          onClose={() => { setFormOpen(false); setEditingAsset(null); }}
        />
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 max-w-sm w-full" style={sans}>
            <p className="font-black text-xl text-foreground mb-2" style={display}>REMOVE ASSET?</p>
            <p className="text-sm text-muted-foreground mb-6">This will permanently remove the asset record from the fleet. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-border text-muted-foreground text-xs font-bold tracking-wider uppercase hover:text-foreground transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2 bg-red-500 text-white text-xs font-bold tracking-wider uppercase hover:bg-red-600 transition-all">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button onClick={onHome} className="text-xl font-black text-primary hover:opacity-80 transition-opacity" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></button>
            <span className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10 uppercase tracking-wider" style={mono}>Employee</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Live</div>
            <span className="text-sm text-muted-foreground">{userName}</span>
            <button onClick={onLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><LogOut size={13} /> Sign out</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-0 border-t border-border">
          {[
            { key: "dashboard", icon: BarChart2, label: "Dashboard" },
            { key: "assets", icon: Wrench, label: "Asset Records" },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key as "dashboard" | "assets")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── DASHBOARD TAB ── */}
      {tab === "dashboard" && (
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="mb-10">
            <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>Fleet Management · July 2025</p>
            <h1 className="text-5xl font-black text-foreground leading-none" style={display}>FLEET PERFORMANCE</h1>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { icon: Activity, label: "Avg Utilization", value: `${avgUtilization}%`, sub: "+4% vs last month", accent: true },
              { icon: DollarSign, label: "Total Revenue", value: `$${(totalRevenue / 1000).toFixed(0)}K`, sub: "This month" },
              { icon: Truck, label: "Operating Hours", value: totalHours.toLocaleString(), sub: "Across all machines" },
              { icon: AlertTriangle, label: "Maintenance Alerts", value: "2", sub: "Action required" },
            ].map(({ icon: Icon, label, value, sub, accent }) => (
              <div key={label} className={`p-5 border flex flex-col gap-3 ${accent ? "bg-primary border-primary" : "bg-card border-border"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold tracking-wider uppercase ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`} style={mono}>{label}</span>
                  <Icon size={16} className={accent ? "text-primary-foreground/70" : "text-muted-foreground"} />
                </div>
                <p className={`text-4xl font-black leading-none ${accent ? "text-primary-foreground" : "text-foreground"}`} style={display}>{value}</p>
                <p className={`text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</p>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 bg-card border border-border p-6">
              <p className="text-xs text-muted-foreground mb-1" style={mono}>PER-MACHINE</p>
              <h3 className="text-xl font-black text-foreground mb-5" style={display}>UTILIZATION RATE</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart id="emp-util-bar" data={utilizationData} barGap={6}>
                  <XAxis dataKey="name" tick={{ fill: "#8a8478", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#8a8478", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={(p) => <ChartTip active={p.active} payload={p.payload as readonly ChartTipPayloadItem[] | undefined} label={typeof p.label === "string" || typeof p.label === "number" ? p.label : undefined} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="utilization" fill="#f5a623" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="target" fill="rgba(255,255,255,0.06)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border p-6">
              <p className="text-xs text-muted-foreground mb-1" style={mono}>FLEET STATUS</p>
              <h3 className="text-xl font-black text-foreground mb-4" style={display}>DISTRIBUTION</h3>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart id="emp-status-pie">
                  <Pie data={STATUS_DIST} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {STATUS_DIST.map((entry, i) => <Cell key={`emp-sd-${i}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={(p) => <ChartTip active={p.active} payload={p.payload as readonly ChartTipPayloadItem[] | undefined} label={typeof p.label === "string" || typeof p.label === "number" ? p.label : undefined} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-2">
                {STATUS_DIST.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5" style={{ background: color }} /><span className="text-xs text-muted-foreground">{name}</span></div>
                    <span className="text-xs font-semibold text-foreground" style={mono}>{value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4 mb-8">
            <div className="bg-card border border-border p-6">
              <p className="text-xs text-muted-foreground mb-1" style={mono}>6-MONTH TREND</p>
              <h3 className="text-xl font-black text-foreground mb-4" style={display}>UTILIZATION</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart id="emp-util-line" data={MONTHLY_UTILIZATION}>
                  <XAxis dataKey="month" tick={{ fill: "#8a8478", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[50, 100]} tick={{ fill: "#8a8478", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={(p) => <ChartTip active={p.active} payload={p.payload as readonly ChartTipPayloadItem[] | undefined} label={typeof p.label === "string" || typeof p.label === "number" ? p.label : undefined} />} />
                  <Line type="monotone" dataKey="utilization" stroke="#f5a623" strokeWidth={2} dot={{ fill: "#f5a623", r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border p-6">
              <p className="text-xs text-muted-foreground mb-1" style={mono}>6-MONTH TREND</p>
              <h3 className="text-xl font-black text-foreground mb-4" style={display}>REVENUE</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart id="emp-revenue-bar" data={MONTHLY_UTILIZATION}>
                  <XAxis dataKey="month" tick={{ fill: "#8a8478", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#8a8478", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={(p) => <ChartTip active={p.active} payload={p.payload as readonly ChartTipPayloadItem[] | undefined} label={typeof p.label === "string" || typeof p.label === "number" ? p.label : undefined} />} />
                  <Bar dataKey="revenue" fill="#f5a623" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5" style={mono}>ALL MACHINES</p>
                <h3 className="text-xl font-black text-foreground" style={display}>MACHINE BREAKDOWN</h3>
              </div>
              <button onClick={() => setTab("assets")}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-semibold">
                Manage assets <ArrowRight size={13} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Machine", "Category", "Location", "Utilization", "Op Hours", "Revenue", "Status"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase" style={mono}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((e, i) => (
                    <tr key={e.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                      <td className="px-5 py-3"><p className="font-semibold text-foreground text-sm">{e.name}</p><p className="text-xs text-muted-foreground">{e.year}</p></td>
                      <td className="px-5 py-3 text-muted-foreground text-sm">{e.category}</td>
                      <td className="px-5 py-3 text-muted-foreground text-sm">{e.location}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${e.utilization}%`, background: e.utilization >= 80 ? "#f5a623" : e.utilization >= 60 ? "#fbbf24" : "#f87171" }} />
                          </div>
                          <span className="text-xs font-semibold text-foreground" style={mono}>{e.utilization}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-foreground" style={mono}>{e.hoursThisMonth}h</td>
                      <td className="px-5 py-3 text-sm font-semibold text-foreground" style={mono}>${e.revenue.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold border ${e.available ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
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
      )}

      {/* ── ASSET RECORDS TAB ── */}
      {tab === "assets" && (
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>Fleet Registry</p>
              <h1 className="text-5xl font-black text-foreground leading-none" style={display}>ASSET RECORDS</h1>
              <p className="text-muted-foreground mt-2 text-sm">{assets.length} assets registered · {assets.filter(a => a.available).length} available</p>
            </div>
            <button onClick={() => { setEditingAsset(null); setFormOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all shrink-0">
              + Add New Asset
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 flex-1 min-w-48">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or serial no…"
                className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full" />
              {search && <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>}
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors">
              <option value="All">All Categories</option>
              {CATEGORIES_LIST.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-card border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors">
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="On Rent">On Rent</option>
            </select>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Assets", value: assets.length, color: "text-foreground" },
              { label: "Available", value: assets.filter(a => a.available).length, color: "text-green-400" },
              { label: "On Rent", value: assets.filter(a => !a.available).length, color: "text-amber-400" },
              { label: "Need Service", value: assets.filter(a => a.condition === "Needs Repair").length, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-border px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground" style={mono}>{label}</span>
                <span className={`text-2xl font-black ${color}`} style={display}>{value}</span>
              </div>
            ))}
          </div>

          {/* Asset table */}
          {filteredAssets.length === 0 ? (
            <div className="bg-card border border-border p-16 text-center">
              <Wrench size={32} className="text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="text-foreground font-semibold mb-1">No assets found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="bg-card border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["", "Asset", "Serial No.", "Category", "Location", "Daily Rate", "Condition", "Status", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap" style={mono}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((a, i) => (
                      <tr key={a.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                        <td className="pl-4 pr-2 py-3 w-14">
                          {a.photo ? (
                            <img src={a.photo} alt={a.name} className="w-12 h-10 object-cover border border-border shrink-0" />
                          ) : (
                            <div className="w-12 h-10 bg-secondary border border-border flex items-center justify-center shrink-0">
                              <Truck size={16} className="text-muted-foreground opacity-40" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.year} · {a.tons}t capacity</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground" style={mono}>{a.serialNo}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{a.category}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{a.location}</td>
                        <td className="px-4 py-3 font-semibold text-foreground" style={mono}>${a.daily.toLocaleString()}/day</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold border ${conditionColor(a.condition)}`}>{a.condition}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold border ${a.available ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
                            {a.available ? "Available" : "On Rent"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditingAsset(a); setFormOpen(true); }}
                              className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold">
                              Edit
                            </button>
                            <button onClick={() => setDeleteId(a.id)}
                              className="px-3 py-1 border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all font-semibold">
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
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("portal");
  const [user, setUser] = useState<{ name: string; role: Role } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");

  const handleLogin = (role: Role, name: string) => { setUser({ name, role }); setShowLogin(false); setView(role === "customer" ? "customer" : role === "admin" ? "admin" : "dashboard"); };
  const handleLogout = () => { setUser(null); setView("portal"); };

  if (view === "customer" && user) return <CustomerPortal userName={user.name} onLogout={handleLogout} onHome={handleLogout} />;
  if (view === "dashboard" && user) return <EmployeeDashboard userName={user.name} onLogout={handleLogout} onHome={handleLogout} />;
  if (view === "admin" && user) return <AdminDashboard userName={user.name} onLogout={handleLogout} onHome={handleLogout} />;
  if (view === "safety")   return <SafetyPage   onHome={() => setView("portal")} />;
  if (view === "about")    return <AboutPage    onHome={() => setView("portal")} />;
  if (view === "projects") return <ProjectsPage onHome={() => setView("portal")} />;

  const filters = ["All", "Excavator", "Crane", "Bulldozer", "Forklift"];
  const filtered = activeFilter === "All" ? EQUIPMENT_LIST : EQUIPMENT_LIST.filter(e => e.category === activeFilter);

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {showLogin && <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}

      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <span className="text-2xl font-black tracking-tight text-primary" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></span>
          <div className="hidden md:flex items-center gap-8">
            {["Equipment", "Projects", "Safety", "About"].map(l => (
              <a key={l} href="#" onClick={(e) => {
                e.preventDefault();
                if (l === "Equipment") document.getElementById("equipment-section")?.scrollIntoView({ behavior: "smooth" });
                else if (l === "Projects") setView("projects");
                else if (l === "Safety") setView("safety");
                else if (l === "About")  setView("about");
              }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => setShowLogin(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 hover:border-primary/40 transition-all">
              <User size={14} /> Sign In
            </button>
          </div>
          <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-card border-t border-border px-6 py-4 flex flex-col gap-4">
            {["Equipment", "Projects", "Safety", "About"].map(l => <a key={l} href="#" onClick={(e) => { e.preventDefault(); setMobileOpen(false); if (l === "Equipment") document.getElementById("equipment-section")?.scrollIntoView({ behavior: "smooth" }); else if (l === "Projects") setView("projects"); else if (l === "Safety") setView("safety"); else if (l === "About") setView("about"); }} className="text-sm text-muted-foreground">{l}</a>)}
            <button onClick={() => { setShowLogin(true); setMobileOpen(false); }}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold w-full">Sign In</button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-end overflow-hidden pt-16">
        <div className="absolute inset-0 bg-background">
          <img src="https://images.unsplash.com/photo-1653315917834-04a6d84e132e?w=1800&h=1000&fit=crop&auto=format"
            alt="Excavator silhouetted at sunset" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pb-20 w-full">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-px w-8 bg-primary" />
              <span className="text-primary text-xs font-semibold tracking-widest uppercase" style={mono}>Heavy Equipment Rentals</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black leading-none tracking-tight text-foreground mb-6" style={display}>
              THE RIGHT<br />MACHINE.<br /><span className="text-primary">RIGHT NOW.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed">
              Access over 1,200 pieces of certified heavy equipment — excavators, cranes, forklifts, and more — delivered to your jobsite within 48 hours.
            </p>
            <div className="flex items-center gap-6">
              {STATS.slice(0, 3).map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-lg font-black text-primary" style={display}>{s.value}</span>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-2" style={mono}>Browse by Type</p>
              <h2 className="text-4xl md:text-5xl font-black text-foreground" style={display}>OUR FLEET</h2>
            </div>
            <button onClick={() => document.getElementById("equipment-section")?.scrollIntoView({ behavior: "smooth" })} className="hidden md:flex items-center gap-2 text-sm text-primary hover:gap-3 transition-all duration-200">
              View all equipment <ArrowRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES.map(cat => (
              <div key={cat.label} onClick={() => { setActiveFilter(cat.label === "All" ? "All" : cat.label); document.getElementById("equipment-section")?.scrollIntoView({ behavior: "smooth" }); }}
                className="group relative overflow-hidden cursor-pointer border border-border hover:border-primary/50 transition-all duration-300 bg-card">
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img src={`https://images.unsplash.com/${cat.img}?w=400&h=300&fit=crop&auto=format`} alt={cat.label}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-base font-bold text-foreground leading-tight" style={display}>{cat.label}</p>
                  <p className="text-xs text-primary" style={mono}>{cat.count} units</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Equipment preview */}
      <section id="equipment-section" className="py-20 bg-muted/30 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-2" style={mono}>Available Now</p>
              <h2 className="text-4xl md:text-5xl font-black text-foreground" style={display}>FEATURED EQUIPMENT</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              {filters.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all border ${activeFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map(item => (
              <div key={item.id} className="group bg-card border border-border hover:border-primary/40 transition-all duration-300 flex flex-col">
                <div className="relative aspect-video bg-muted overflow-hidden">
                  <img src={`https://images.unsplash.com/${item.img}?w=600&h=340&fit=crop&auto=format`} alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold border ${item.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                      {item.available ? "Available" : "Booked"}
                    </span>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-0.5" style={mono}>{item.category}</p>
                  <h3 className="font-black text-lg text-foreground leading-tight mb-3" style={display}>{item.name}</h3>
                  <div className="mt-auto flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">From / day</p>
                      <p className="text-2xl font-black text-foreground" style={display}>${item.daily.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setShowLogin(true)}
                      className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all">Book Now</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(0,0,0,.3) 40px,rgba(0,0,0,.3) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(0,0,0,.3) 40px,rgba(0,0,0,.3) 41px)" }} />
        <div className="relative max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black text-primary-foreground leading-none" style={display}>READY TO RENT?</h2>
            <p className="text-primary-foreground/70 mt-1 text-sm">Sign in to book equipment, track orders, and manage your fleet.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={() => setShowLogin(true)} className="px-6 py-3 bg-primary-foreground text-primary font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all">Sign In as Customer</button>
            <button onClick={() => setShowLogin(true)} className="px-6 py-3 border-2 border-primary-foreground text-primary-foreground font-bold text-sm tracking-widest uppercase hover:bg-primary-foreground/10 transition-all">Employee Login</button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-3" style={mono}>Client Stories</p>
            <h2 className="text-5xl font-black text-foreground" style={display}>TRUSTED ON SITE</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className={`p-8 border flex flex-col ${i === 1 ? "bg-primary border-primary" : "bg-card border-border"}`}>
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} size={14} className={i === 1 ? "text-primary-foreground fill-primary-foreground" : "text-primary fill-primary"} />
                  ))}
                </div>
                <p className={`text-base leading-relaxed flex-1 mb-8 ${i === 1 ? "text-primary-foreground" : "text-foreground"}`}>"{t.quote}"</p>
                <div>
                  <p className={`font-black text-lg leading-tight ${i === 1 ? "text-primary-foreground" : "text-foreground"}`} style={display}>{t.name}</p>
                  <p className={`text-xs mt-0.5 ${i === 1 ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <span className="text-3xl font-black tracking-tight text-primary mb-4 block" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></span>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-5">The industrial equipment rental platform for contractors who move fast.</p>
              <div className="flex flex-col gap-2">
                <a href="tel:+18005551234" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"><Phone size={14} className="text-primary" /> 1-800-555-1234</a>
                <a href="mailto:fleet@heavyrental.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"><Mail size={14} className="text-primary" /> fleet@heavyrental.com</a>
              </div>
            </div>
            {[
              { title: "Equipment", links: ["Excavators", "Cranes", "Bulldozers", "Forklifts", "Dump Trucks"] },
              { title: "Services", links: ["Daily Rental", "Long-Term Lease", "Operator Supply", "Maintenance", "Transport"] },
              { title: "Company", links: ["About Us", "Safety Standards", "Certifications", "Careers", "Press"] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-xs font-semibold text-foreground tracking-widest uppercase mb-4" style={mono}>{col.title}</p>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map(link => <li key={link}><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">© 2025 Heavy Rental. All rights reserved.</p>
            <div className="flex gap-6">
              {["Privacy", "Terms", "Insurance"].map(l => <a key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l}</a>)}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
