import type { Equipment } from "./types";

// Maintenance-tracking fields layered on top of catalog data; no API resource
// backs these, so they stay client-only-synthesized, deterministic per equipment id.
export interface AssetRecord {
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

export function deriveAssetRecord(e: Equipment): AssetRecord {
  return {
    ...e,
    tags: e.tags.join(", "),
    serialNo: `SN-${e.category.slice(0, 3).toUpperCase()}-${e.year}-${String(e.id).padStart(4, "0")}`,
    lastService: "2025-05-12",
    nextService: "2025-08-12",
    condition: (["Excellent", "Good", "Good", "Fair"][e.id % 4]) as AssetRecord["condition"],
    photo: `https://images.unsplash.com/photo-${e.img}?w=400&q=80`,
  };
}
