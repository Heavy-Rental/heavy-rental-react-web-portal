import type { ConditionType, Equipment } from "./types";

export type { ConditionType };

// Formats the raw enum for display: "NEEDS_REPAIR" -> "Needs Repair".
export function formatCondition(c: ConditionType): string {
  return c.split("_").map(w => w[0] + w.slice(1).toLowerCase()).join(" ");
}

// Maintenance-tracking fields layered on top of catalog data; no API resource
// backs these, so they stay client-only-synthesized, deterministic per equipment id.
export interface AssetRecord {
  id: number;
  name: string;
  category: string;
  purchaseYear: number;
  location: string;
  baseDailyRate: number;
  minDailyRate: number;
  maxDailyRate: number;
  weekly: number;
  capacity: number;
  platformHeight: number | null;
  available: boolean;
  utilization: number;
  hoursThisMonth: number;
  revenue: number;
  tags: string;
  desc: string;
  serialno: string;
  condition: ConditionType;
  lastConditionUpdatedAt: string;
  photo: string | null;
}

export function deriveAssetRecord(e: Equipment): AssetRecord {
  return {
    ...e,
    tags: e.tags.join(", "),
    serialno: `SN-${e.category.slice(0, 3).toUpperCase()}-${e.purchaseYear}-${String(e.id).padStart(4, "0")}`,
    condition: (["EXCELLENT", "GOOD", "GOOD", "FAIR"][e.id % 4]) as ConditionType,
    lastConditionUpdatedAt: "2025-08-01T09:00:00+08:00",
    photo: `https://images.unsplash.com/photo-${e.img}?w=400&q=80`,
  };
}
