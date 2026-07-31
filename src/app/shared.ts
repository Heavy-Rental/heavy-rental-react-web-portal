// ─── SHARED TYPES ─────────────────────────────────────────────────────────────

export type Role = "customer" | "employee" | "admin";
export type View = "portal" | "customer" | "dashboard" | "admin";
export type OnboardingMode = "know" | "browse" | "specs" | null;

export interface CartItem {
  equipment: EquipmentItem;
  startDay: number;
  endDay: number;
  month: number;
  year: number;
}

// ─── EQUIPMENT DATA ───────────────────────────────────────────────────────────

export const EQUIPMENT_LIST = [
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

export type EquipmentItem = typeof EQUIPMENT_LIST[0];

// ─── CHART / ANALYTICS DATA ───────────────────────────────────────────────────

export const MONTHLY_UTILIZATION = [
  { month: "Feb", utilization: 68, revenue: 189000 },
  { month: "Mar", utilization: 74, revenue: 214000 },
  { month: "Apr", utilization: 79, revenue: 231000 },
  { month: "May", utilization: 85, revenue: 258000 },
  { month: "Jun", utilization: 88, revenue: 271000 },
  { month: "Jul", utilization: 76, revenue: 243000 },
];

export const STATUS_DIST = [
  { name: "Rented Out", value: 68, color: "#f5a623" },
  { name: "Available", value: 22, color: "#4ade80" },
  { name: "Maintenance", value: 7, color: "#f87171" },
  { name: "In Transit", value: 3, color: "#60a5fa" },
];

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

export const mono = { fontFamily: "'DM Mono', monospace" } as const;
export const display = { fontFamily: "'Barlow Condensed', sans-serif" } as const;
export const sans = { fontFamily: "'DM Sans', sans-serif" } as const;
